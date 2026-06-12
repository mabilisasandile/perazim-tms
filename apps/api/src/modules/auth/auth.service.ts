import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

export const generateTokens = (userId: number, username: string) => {
  const accessToken = jwt.sign(
    { id: userId, username },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refreshToken = jwt.sign(
    { id: userId, username },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
};

export const authService = {
  async login(username: string, password: string) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email: username }],
        isActive: true,
      },
      include: { permissions: true },
    });

    if (!user) throw new AppError('Invalid username or password', 401);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError('Invalid username or password', 401);

    const { accessToken, refreshToken } = generateTokens(user.id, user.username);

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

    const user = await prisma.user.findUnique({
      where: { id: payload.id, isActive: true },
    });
    if (!user) throw new AppError('User not found', 401);

    const tokens = generateTokens(user.id, user.username);
    return tokens;
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
    access: { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 },
    refresh: { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 },
  },
};
