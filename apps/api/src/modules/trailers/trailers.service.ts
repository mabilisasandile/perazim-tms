import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateTrailerDto, UpdateTrailerDto, TRAILER_STATUSES } from './trailers.schema';

const vehicleSelect = { id: true, name: true, registrationNo: true };

export const trailersService = {
  async findAll() {
    return prisma.trailer.findMany({
      include: {
        _count: { select: { trips: true } },
        assignedVehicle: { select: vehicleSelect },
      },
      orderBy: { registrationNo: 'asc' },
    });
  },

  async findById(id: number) {
    const t = await prisma.trailer.findUnique({
      where: { id },
      include: {
        assignedVehicle: { select: vehicleSelect },
        trips: { take: 5, orderBy: { createdAt: 'desc' } },
        _count: { select: { trips: true } },
      },
    });
    if (!t) throw new AppError('Trailer not found', 404);
    return t;
  },

  async getAvailability() {
    const [available, inUse, maintenance, total] = await Promise.all([
      prisma.trailer.count({ where: { status: 'Available',          isActive: true } }),
      prisma.trailer.count({ where: { status: 'In Use',             isActive: true } }),
      prisma.trailer.count({ where: { status: 'Under Maintenance',  isActive: true } }),
      prisma.trailer.count({ where: { isActive: true } }),
    ]);
    return { available, inUse, maintenance, total };
  },

  async create(data: CreateTrailerDto) {
    const { licenseExpiry, assignedVehicleId, ...rest } = data;
    return prisma.trailer.create({
      data: {
        ...rest,
        licenseExpiry:     licenseExpiry ? new Date(licenseExpiry) : null,
        assignedVehicleId: assignedVehicleId ?? null,
      },
      include: { assignedVehicle: { select: vehicleSelect } },
    });
  },

  async update(id: number, data: UpdateTrailerDto) {
    await this.findById(id);
    const { licenseExpiry, assignedVehicleId, ...rest } = data;
    return prisma.trailer.update({
      where: { id },
      data: {
        ...rest,
        ...(licenseExpiry !== undefined && { licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null }),
        ...(assignedVehicleId !== undefined && { assignedVehicleId: assignedVehicleId ?? null }),
      },
      include: { assignedVehicle: { select: vehicleSelect } },
    });
  },

  async updateStatus(id: number, status: typeof TRAILER_STATUSES[number]) {
    await this.findById(id);
    return prisma.trailer.update({ where: { id }, data: { status } });
  },

  async remove(id: number) {
    const t = await prisma.trailer.findUnique({ where: { id }, include: { _count: { select: { trips: true } } } });
    if (!t) throw new AppError('Trailer not found', 404);
    if (t._count.trips > 0) throw new AppError('Cannot delete trailer with trips. Deactivate instead.', 409);
    return prisma.trailer.delete({ where: { id } });
  },
};
