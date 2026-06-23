import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateCustomerDto, UpdateCustomerDto } from './customers.schema';
import bcrypt from 'bcryptjs';
import { notificationService } from '../notifications/notification.service';

export const customersService = {
  async findAll() {
    return prisma.customer.findMany({
      include: { _count: { select: { trips: true, quotations: true } } },
      orderBy: { name: 'asc' },
    });
  },

  async findById(id: number) {
    const c = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { trips: true, quotations: true } },
        trips: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, trackingCode: true, status: true,
            fromLocation: true, toLocation: true,
            startDate: true, totalAmount: true,
          },
        },
        quotations: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, number: true, status: true, createdAt: true },
        },
      },
    });
    if (!c) throw new AppError('Customer not found', 404);
    const { password: _, resetToken: __, ...safe } = c;
    return safe;
  },

  async create(data: CreateCustomerDto) {
    const customer = await prisma.customer.create({
      data,
      include: { _count: { select: { trips: true, quotations: true } } },
    });
    if (customer.email) {
      notificationService.sendWelcomeEmail(customer.email, customer.name, 'customer').catch(() => {});
    }
    return customer;
  },

  async update(id: number, data: UpdateCustomerDto) {
    await this.findById(id);
    return prisma.customer.update({ where: { id }, data });
  },

  async remove(id: number) {
    const c = await prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { trips: true } } },
    });
    if (!c) throw new AppError('Customer not found', 404);
    if (c._count.trips > 0)
      throw new AppError('Cannot delete a customer with existing trips. Deactivate instead.', 409);
    return prisma.customer.delete({ where: { id } });
  },

  async setPortalPassword(id: number, password: string) {
    await this.findById(id);
    const hashed = await bcrypt.hash(password, 12);
    return prisma.customer.update({ where: { id }, data: { password: hashed } });
  },

  async getTrips(id: number) {
    await this.findById(id);
    return prisma.trip.findMany({
      where: { customerId: id },
      include: {
        vehicle: { select: { name: true, registrationNo: true } },
        driver:  { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },
};
