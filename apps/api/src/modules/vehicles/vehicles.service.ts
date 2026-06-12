import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateVehicleDto, UpdateVehicleDto } from './vehicles.schema';

export const vehiclesService = {
  async findAll() {
    return prisma.vehicle.findMany({
      include: {
        group: { select: { id: true, name: true } },
        _count: { select: { trips: true, drivers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: number) {
    const v = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        group: true,
        drivers: { select: { id: true, name: true, mobile: true, isActive: true } },
        trips: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { name: true } },
            driver: { select: { name: true } },
          },
        },
        reminders: { where: { isRead: false }, orderBy: { dueDate: 'asc' } },
        _count: { select: { trips: true } },
      },
    });
    if (!v) throw new AppError('Vehicle not found', 404);
    return v;
  },

  async create(data: CreateVehicleDto) {
    return prisma.vehicle.create({ data });
  },

  async update(id: number, data: UpdateVehicleDto) {
    await this.findById(id);
    return prisma.vehicle.update({ where: { id }, data });
  },

  async remove(id: number) {
    const v = await prisma.vehicle.findUnique({
      where: { id },
      include: { _count: { select: { trips: true } } },
    });
    if (!v) throw new AppError('Vehicle not found', 404);
    if (v._count.trips > 0)
      throw new AppError('Cannot delete a vehicle that has trips. Deactivate it instead.', 409);
    return prisma.vehicle.delete({ where: { id } });
  },

  async getGroups() {
    return prisma.vehicleGroup.findMany({ orderBy: { name: 'asc' } });
  },

  async createGroup(name: string) {
    return prisma.vehicleGroup.create({ data: { name } });
  },

  async deleteGroup(id: number) {
    const count = await prisma.vehicle.count({ where: { groupId: id } });
    if (count > 0)
      throw new AppError('Cannot delete a group that has vehicles assigned to it.', 409);
    return prisma.vehicleGroup.delete({ where: { id } });
  },
};
