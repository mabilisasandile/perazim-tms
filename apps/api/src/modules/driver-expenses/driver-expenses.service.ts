import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

export const driverExpensesService = {
  async findAll(filters: { driverId?: number; month?: string }) {
    const where: any = {};
    if (filters.driverId) where.driverId = filters.driverId;
    if (filters.month) {
      const [year, m] = filters.month.split('-').map(Number);
      where.date = {
        gte: new Date(year, m - 1, 1),
        lt:  new Date(year, m, 1),
      };
    }
    return prisma.driverExpense.findMany({
      where,
      include: { driver: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });
  },

  async findById(id: number) {
    const de = await prisma.driverExpense.findUnique({
      where: { id },
      include: { driver: { select: { id: true, name: true } } },
    });
    if (!de) throw new AppError('Record not found', 404);
    return de;
  },

  async create(data: { driverId: number; description: string; amount: number; date: string }) {
    return prisma.driverExpense.create({
      data: { ...data, amount: data.amount, date: new Date(data.date) },
      include: { driver: { select: { id: true, name: true } } },
    });
  },

  async update(id: number, data: { description?: string; amount?: number; date?: string }) {
    await this.findById(id);
    return prisma.driverExpense.update({
      where: { id },
      data: {
        ...data,
        ...(data.date ? { date: new Date(data.date) } : {}),
      },
    });
  },

  async remove(id: number) {
    await this.findById(id);
    return prisma.driverExpense.delete({ where: { id } });
  },
};
