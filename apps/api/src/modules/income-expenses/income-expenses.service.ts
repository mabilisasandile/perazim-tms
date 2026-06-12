import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

export const incomeExpensesService = {
  async findAll(filters: { vehicleId?: number; type?: 'INCOME' | 'EXPENSE'; month?: string }) {
    const where: any = {};
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.type)      where.type      = filters.type;
    if (filters.month) {
      const [year, m] = filters.month.split('-').map(Number);
      where.date = {
        gte: new Date(year, m - 1, 1),
        lt:  new Date(year, m, 1),
      };
    }
    return prisma.incomeExpense.findMany({
      where,
      include: { vehicle: { select: { id: true, name: true, registrationNo: true } } },
      orderBy: { date: 'desc' },
    });
  },

  async findById(id: number) {
    const ie = await prisma.incomeExpense.findUnique({
      where: { id },
      include: { vehicle: { select: { name: true, registrationNo: true } } },
    });
    if (!ie) throw new AppError('Record not found', 404);
    return ie;
  },

  async create(data: { vehicleId?: number; type: 'INCOME' | 'EXPENSE'; description: string; amount: number; date: string }) {
    return prisma.incomeExpense.create({
      data: { ...data, amount: data.amount, date: new Date(data.date) },
      include: { vehicle: { select: { name: true } } },
    });
  },

  async update(id: number, data: { description?: string; amount?: number; date?: string }) {
    await this.findById(id);
    return prisma.incomeExpense.update({
      where: { id },
      data: {
        ...data,
        ...(data.date ? { date: new Date(data.date) } : {}),
      },
    });
  },

  async remove(id: number) {
    await this.findById(id);
    return prisma.incomeExpense.delete({ where: { id } });
  },

  async getSummary(vehicleId?: number) {
    const where: any = vehicleId ? { vehicleId } : {};
    const [income, expense] = await Promise.all([
      prisma.incomeExpense.aggregate({ where: { ...where, type: 'INCOME'  }, _sum: { amount: true }, _count: true }),
      prisma.incomeExpense.aggregate({ where: { ...where, type: 'EXPENSE' }, _sum: { amount: true }, _count: true }),
    ]);
    return {
      income:  { count: income._count,  total: Number(income._sum.amount  ?? 0) },
      expense: { count: expense._count, total: Number(expense._sum.amount ?? 0) },
      net:     Number(income._sum.amount ?? 0) - Number(expense._sum.amount ?? 0),
    };
  },
};
