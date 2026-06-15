import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

export const generateTokens = (userId: number, username: string, sessionMinutes?: number) => {
  const accessExpiry  = sessionMinutes ? `${sessionMinutes}m` : (process.env.JWT_EXPIRES_IN  || '15m');
  const refreshExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  const sign = (payload: object, secret: string, expiry: string) =>
    jwt.sign(payload, secret, { expiresIn: expiry } as jwt.SignOptions);
  return {
    accessToken:  sign({ id: userId, username }, process.env.JWT_SECRET!,         accessExpiry),
    refreshToken: sign({ id: userId, username }, process.env.JWT_REFRESH_SECRET!,  refreshExpiry),
  };
};

export const authService = {
  async login(username: string, password: string, ipAddress?: string) {
    const user = await prisma.user.findFirst({
      where: { OR: [{ username }, { email: username }] },
      include: { permissions: true },
    });

    // Fetch security policy
    const settings = await prisma.settings.findFirst();
    const maxAttempts  = settings?.maxLoginAttempts  ?? 5;
    const lockoutMins  = settings?.lockoutMinutes    ?? 30;
    const sessionMins  = settings?.sessionTimeoutMinutes ?? 15;

    if (!user) throw new AppError('Invalid username or password', 401);

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppError(`Account locked due to too many failed attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`, 403);
    }

    if (!user.isActive) throw new AppError('Account is inactive. Contact your administrator.', 403);

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      const newCount = user.failedLoginCount + 1;
      const shouldLock = newCount >= maxAttempts;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: newCount,
          ...(shouldLock ? { lockedUntil: new Date(Date.now() + lockoutMins * 60 * 1000) } : {}),
        },
      });
      if (shouldLock) {
        throw new AppError(`Too many failed attempts. Account locked for ${lockoutMins} minutes.`, 403);
      }
      const remaining = maxAttempts - newCount;
      throw new AppError(
        `Invalid username or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`,
        401
      );
    }

    // Successful login — reset counters
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const { accessToken, refreshToken } = generateTokens(user.id, user.username, sessionMins);
    const { password: _, ...safeUser } = user;
    return { accessToken, refreshToken, user: safeUser };
  },

  async refresh(refreshToken: string) {
    let payload: { id: number; username: string };
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as typeof payload;
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id, isActive: true } });
    if (!user) throw new AppError('User not found', 401);

    const settings = await prisma.settings.findFirst();
    const sessionMins = settings?.sessionTimeoutMinutes ?? 15;

    return generateTokens(user.id, user.username, sessionMins);
  },

  async me(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permissions: true },
      omit: { password: true } as any,
    });
    if (!user) throw new AppError('User not found', 404);
    return user;
  },

  cookieOptions: {
    access:  { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 },
    refresh: { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 },
  },
};
