import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from './errorHandler';

export interface CustomerRequest extends Request {
  customer?: { id: number; email: string; name: string };
}

export const authenticateCustomer = async (
  req: CustomerRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.cookies?.customerAccessToken ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) throw new AppError('Not authenticated', 401);

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      email: string;
      role: string;
    };

    if (payload.role !== 'customer') throw new AppError('Not authenticated', 401);

    const customer = await prisma.customer.findUnique({
      where: { id: payload.id, isActive: true },
    });
    if (!customer) throw new AppError('Not authenticated', 401);

    req.customer = { id: customer.id, email: customer.email, name: customer.name };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Invalid or expired token', 401));
  }
};
