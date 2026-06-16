import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateTripDto, UpdateTripDto } from './trips.schema';
import { TripStatus } from '@prisma/client';

export const tripsService = {
  async findAll(filters?: { vehicleId?: number; driverId?: number; status?: TripStatus }) {
    return prisma.trip.findMany({
      where: filters,
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        vehicle: { select: { id: true, name: true, registrationNo: true } },
        driver: { select: { id: true, name: true, mobile: true, email: true } },
        trailer: { select: { id: true, registrationNo: true } },
        payment: true,
        legs: { include: { driver: { select: { id: true, name: true } } }, orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: number) {
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: true,
        driver: true,
        trailer: true,
        payment: true,
        legs: { include: { driver: true }, orderBy: { order: 'asc' } },
        expenses: true,
        inspections: { include: { images: true } },
      },
    });
    if (!trip) throw new AppError('Trip not found', 404);
    return trip;
  },

  async findByTrackingCode(code: string) {
    const trip = await prisma.trip.findUnique({
      where: { trackingCode: code },
      include: {
        customer: { select: { name: true, phone: true } },
        vehicle: { select: { name: true, registrationNo: true } },
        driver: { select: { name: true, mobile: true } },
        legs: { orderBy: { order: 'asc' } },
        positions: { orderBy: { recordedAt: 'desc' }, take: 1 },
      },
    });
    if (!trip) throw new AppError('Trip not found', 404);
    return trip;
  },

  async create(data: CreateTripDto, createdById: number) {
    const { legs, ...tripData } = data;

    const settings = await prisma.settings.findFirst();
    const vatRate = settings?.vat ?? 15;
    const amount = tripData.amount ?? 0;
    const vatAmount = amount * vatRate / 100;
    const totalAmount = amount + vatAmount;

    const { startDate, endDate, ...restTripData } = tripData;

    return prisma.$transaction(async (tx) => {
      const trip = await tx.trip.create({
        data: {
          ...restTripData,
          startDate: new Date(startDate),
          endDate:   endDate ? new Date(endDate) : null,
          vatAmount,
          totalAmount,
          createdById,
        },
      });

      // Create legs
      const legsToCreate = legs?.length
        ? legs.map((leg, i) => ({ ...leg, tripId: trip.id, order: i + 1, status: 'pending' }))
        : [{
            tripId: trip.id,
            driverId: tripData.driverId,
            startLocation: tripData.fromLocation,
            endLocation: tripData.toLocation,
            scheduledAt: tripData.startDate ? new Date(tripData.startDate) : null,
            order: 1,
            status: 'pending',
          }];

      await tx.tripLeg.createMany({ data: legsToCreate });

      return tx.trip.findUnique({
        where: { id: trip.id },
        include: { legs: true },
      });
    });
  },

  async update(id: number, data: UpdateTripDto) {
    await this.findById(id);
    return prisma.trip.update({
      where: { id },
      data,
    });
  },

  async updateStatus(id: number, status: TripStatus) {
    await this.findById(id);
    return prisma.trip.update({ where: { id }, data: { status } });
  },

  async remove(id: number) {
    await this.findById(id);
    return prisma.trip.delete({ where: { id } });
  },

  async getDriverTrips(driverId: number) {
    return prisma.trip.findMany({
      where: { driverId },
      include: {
        customer: { select: { name: true } },
        vehicle: { select: { name: true, registrationNo: true } },
        legs: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },
};
