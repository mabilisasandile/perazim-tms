import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

export const remindersService = {
  async findAll(unreadOnly?: boolean) {
    return prisma.reminder.findMany({
      where: unreadOnly ? { isRead: false } : {},
      include: { vehicle: { select: { id: true, name: true, registrationNo: true } } },
      orderBy: { dueDate: 'asc' },
    });
  },
  async create(data: { vehicleId?: number; title: string; description?: string; dueDate: string }) {
    return prisma.reminder.create({
      data: { ...data, dueDate: new Date(data.dueDate) },
      include: { vehicle: { select: { name: true } } },
    });
  },
  async markRead(id: number) {
    const r = await prisma.reminder.findUnique({ where: { id } });
    if (!r) throw new AppError('Reminder not found', 404);
    return prisma.reminder.update({ where: { id }, data: { isRead: true } });
  },
  async remove(id: number) {
    const r = await prisma.reminder.findUnique({ where: { id } });
    if (!r) throw new AppError('Reminder not found', 404);
    return prisma.reminder.delete({ where: { id } });
  },
};
