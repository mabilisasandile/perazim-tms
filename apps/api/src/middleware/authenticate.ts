import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from './errorHandler';
import { RoleKey } from '../lib/roles';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    permissions: Record<string, boolean>;
  };
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) throw new AppError('Not authenticated', 401);

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      username: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { permissions: true },
    });

    if (!user || !user.isActive) throw new AppError('Not authenticated', 401);

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppError(`Account locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`, 403);
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions
        ? Object.fromEntries(
            Object.entries(user.permissions)
              .filter(([k]) => k !== 'id' && k !== 'userId')
              .map(([k, v]) => [k, Boolean(v)])
          )
        : {},
    };

    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Invalid or expired token', 401));
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const role = req.user?.role as RoleKey;
    // Super admins bypass all permission checks
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return next();
    if (!req.user?.permissions[permission]) {
      return next(new AppError('You do not have permission to do this', 403));
    }
    next();
  };
};

export const requireRole = (...roles: RoleKey[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role as RoleKey)) {
      return next(new AppError('Insufficient role for this action', 403));
    }
    next();
  };
};
