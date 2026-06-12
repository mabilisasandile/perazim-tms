import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

export const positionsService = {
  async findAll(filters: { vehicleId?: number; tripId?: number; limit?: number }) {
    return prisma.position.findMany({
      where: {
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.tripId    ? { tripId:    filters.tripId    } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: filters.limit ?? 100,
    });
  },

  async getLatestPerVehicle() {
    // Return the most recent position for each active vehicle
    const vehicles = await prisma.vehicle.findMany({
      where: { isActive: true },
      select: { id: true, name: true, registrationNo: true },
    });

    const latestPositions = await Promise.all(
      vehicles.map(async (v) => {
        const pos = await prisma.position.findFirst({
          where: { vehicleId: v.id },
          orderBy: { recordedAt: 'desc' },
        });
        return { vehicle: v, position: pos ?? null };
      })
    );

    return latestPositions;
  },

  async create(data: {
    vehicleId:  number;
    tripId?:    number | null;
    latitude:   number;
    longitude:  number;
    altitude?:  number;
    speed?:     number;
    bearing?:   number;
    accuracy?:  number;
  }) {
    return prisma.position.create({ data });
  },

  async bulkCreate(positions: Array<{
    vehicleId:  number;
    tripId?:    number | null;
    latitude:   number;
    longitude:  number;
    altitude?:  number;
    speed?:     number;
    bearing?:   number;
    accuracy?:  number;
    recordedAt?: Date;
  }>) {
    return prisma.position.createMany({ data: positions });
  },

  async remove(id: number) {
    const pos = await prisma.position.findUnique({ where: { id } });
    if (!pos) throw new AppError('Position not found', 404);
    return prisma.position.delete({ where: { id } });
  },

  async purgeOlderThan(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return prisma.position.deleteMany({ where: { recordedAt: { lt: cutoff } } });
  },
};
