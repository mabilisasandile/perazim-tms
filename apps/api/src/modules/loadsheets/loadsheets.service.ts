import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

export const loadsheetsService = {
  async findAll(filters: { driverId?: number; vehicleId?: number }) {
    return prisma.loadSheet.findMany({
      where: {
        ...(filters.driverId  ? { driverId:  filters.driverId  } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      },
      include: {
        driver:  { select: { id: true, name: true, mobile: true } },
        vehicle: { select: { id: true, name: true, registrationNo: true } },
        trailer: { select: { id: true, registrationNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: number) {
    const ls = await prisma.loadSheet.findUnique({
      where: { id },
      include: {
        driver:  { select: { id: true, name: true, mobile: true } },
        vehicle: { select: { id: true, name: true, registrationNo: true } },
        trailer: { select: { id: true, registrationNo: true } },
      },
    });
    if (!ls) throw new AppError('Load sheet not found', 404);
    return ls;
  },

  async create(data: {
    driverId:  number;
    vehicleId: number;
    trailerId?: number | null;
    data:      any;
    notes?:    string;
  }) {
    return prisma.loadSheet.create({
      data,
      include: {
        driver:  { select: { name: true } },
        vehicle: { select: { name: true, registrationNo: true } },
        trailer: { select: { registrationNo: true } },
      },
    });
  },

  async update(id: number, data: { data?: any; notes?: string; trailerId?: number | null }) {
    await this.findById(id);
    return prisma.loadSheet.update({
      where: { id },
      data,
      include: {
        driver:  { select: { name: true } },
        vehicle: { select: { name: true, registrationNo: true } },
        trailer: { select: { registrationNo: true } },
      },
    });
  },

  async remove(id: number) {
    await this.findById(id);
    return prisma.loadSheet.delete({ where: { id } });
  },
};
