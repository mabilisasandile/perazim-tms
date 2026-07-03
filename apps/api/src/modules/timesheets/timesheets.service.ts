import { prisma } from '../../lib/prisma';

export const timesheetsService = {
  async findAll() {
    return prisma.timesheet.findMany({
      include: { driver: { select: { id: true, name: true } } },
      orderBy: { clockIn: 'desc' },
    });
  },
};
