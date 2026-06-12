import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
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

    req.user = {
      id: user.id,
      username: user.username,
      permissions: user.permissions
        ? Object.fromEntries(
            Object.entries(user.permissions).filter(
              ([k]) => k !== 'id' && k !== 'userId'
            )
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
    if (!req.user?.permissions[permission]) {
      return next(new AppError('You do not have permission to do this', 403));
    }
    next();
  };
};
