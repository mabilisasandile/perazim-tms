import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from './errorHandler';

export interface DriverRequest extends Request {
  driver?: { id: number; email: string; name: string };
}

export const authenticateDriver = async (
  req: DriverRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.cookies?.driverAccessToken ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) throw new AppError('Not authenticated', 401);

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      email: string;
      role: string;
    };

    if (payload.role !== 'driver') throw new AppError('Not authenticated', 401);

    const driver = await prisma.driver.findUnique({
      where: { id: payload.id, isActive: true },
    });
    if (!driver) throw new AppError('Not authenticated', 401);

    req.driver = { id: driver.id, email: driver.email, name: driver.name };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Invalid or expired token', 401));
  }
};
