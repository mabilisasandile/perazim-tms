import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

export const geofencesService = {
  async findAll() {
    return prisma.geofence.findMany({
      include: {
        vehicles: {
          include: {
            vehicle: { select: { id: true, name: true, registrationNo: true } },
          },
        },
        _count: { select: { events: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: number) {
    const gf = await prisma.geofence.findUnique({
      where: { id },
      include: {
        vehicles: {
          include: { vehicle: { select: { id: true, name: true, registrationNo: true } } },
        },
        events: {
          orderBy: { occurredAt: 'desc' },
          take: 50,
          include: { vehicle: { select: { name: true, registrationNo: true } } },
        },
      },
    });
    if (!gf) throw new AppError('Geofence not found', 404);
    return gf;
  },

  async create(data: { name: string; description?: string; area: any; vehicleIds?: number[] }) {
    const { vehicleIds, ...rest } = data;
    return prisma.geofence.create({
      data: {
        ...rest,
        vehicles: vehicleIds?.length
          ? { create: vehicleIds.map(vehicleId => ({ vehicleId })) }
          : undefined,
      },
      include: {
        vehicles: { include: { vehicle: { select: { id: true, name: true, registrationNo: true } } } },
      },
    });
  },

  async update(id: number, data: { name?: string; description?: string; area?: any; vehicleIds?: number[] }) {
    await this.findById(id);
    const { vehicleIds, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      if (vehicleIds !== undefined) {
        // Replace vehicle assignments
        await tx.geofenceVehicle.deleteMany({ where: { geofenceId: id } });
        if (vehicleIds.length > 0) {
          await tx.geofenceVehicle.createMany({
            data: vehicleIds.map(vehicleId => ({ geofenceId: id, vehicleId })),
          });
        }
      }
      return tx.geofence.update({
        where: { id },
        data: rest,
        include: {
          vehicles: { include: { vehicle: { select: { id: true, name: true, registrationNo: true } } } },
        },
      });
    });
  },

  async remove(id: number) {
    const gf = await prisma.geofence.findUnique({ where: { id } });
    if (!gf) throw new AppError('Geofence not found', 404);
    return prisma.geofence.delete({ where: { id } });
  },

  async getEvents(geofenceId: number, limit = 100) {
    return prisma.geofenceEvent.findMany({
      where: { geofenceId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      include: {
        vehicle: { select: { id: true, name: true, registrationNo: true } },
        geofence: { select: { name: true } },
      },
    });
  },

  async recordEvent(data: {
    vehicleId: number;
    geofenceId: number;
    eventType: 'entered' | 'exited';
    latitude: number;
    longitude: number;
  }) {
    return prisma.geofenceEvent.create({ data });
  },
};
