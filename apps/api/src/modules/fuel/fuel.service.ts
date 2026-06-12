import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateFuelDto } from './fuel.schema';

export const fuelService = {
  async findAll(vehicleId?: number) {
    return prisma.fuel.findMany({
      where: vehicleId ? { vehicleId } : {},
      include: {
        vehicle: { select: { id: true, name: true, registrationNo: true } },
        driver:  { select: { id: true, name: true } },
      },
      orderBy: { fillDate: 'desc' },
    });
  },
  async create(data: CreateFuelDto) {
    const totalCost = data.litres * data.costPerLitre;
    return prisma.fuel.create({
      data: { ...data, totalCost, fillDate: new Date(data.fillDate) },
      include: { vehicle: { select: { name: true, registrationNo: true } }, driver: { select: { name: true } } },
    });
  },
  async remove(id: number) {
    const f = await prisma.fuel.findUnique({ where: { id } });
    if (!f) throw new AppError('Fuel record not found', 404);
    return prisma.fuel.delete({ where: { id } });
  },
};
