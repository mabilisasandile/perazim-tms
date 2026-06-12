import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateQuotationDto } from './quotations.schema';
import { QuotationStatus, TripStatus } from '@prisma/client';

export const quotationsService = {
  async findAll(customerId?: number) {
    return prisma.quotation.findMany({
      where: customerId ? { customerId } : {},
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: number) {
    const q = await prisma.quotation.findUnique({
      where: { id },
      include: { customer: true, items: true },
    });
    if (!q) throw new AppError('Quotation not found', 404);
    return q;
  },

  async create(data: CreateQuotationDto) {
    const { items, pickupDate, dropoffDate, ...rest } = data;
    const count = await prisma.quotation.count();
    const number = `QT-${String(count + 1).padStart(5, '0')}`;

    return prisma.quotation.create({
      data: {
        ...rest,
        number,
        pickupDate:  pickupDate  ? new Date(pickupDate)  : null,
        dropoffDate: dropoffDate ? new Date(dropoffDate) : null,
        items: {
          create: items.map(item => ({
            ...item,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { customer: true, items: true },
    });
  },

  async update(id: number, data: Partial<CreateQuotationDto>) {
    await this.findById(id);
    const { items, pickupDate, dropoffDate, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      if (items) {
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
        await tx.quotationItem.createMany({
          data: items.map(item => ({
            ...item,
            quotationId: id,
            total: item.quantity * item.unitPrice,
          })),
        });
      }

      return tx.quotation.update({
        where: { id },
        data: {
          ...rest,
          ...(pickupDate  !== undefined && { pickupDate:  pickupDate  ? new Date(pickupDate)  : null }),
          ...(dropoffDate !== undefined && { dropoffDate: dropoffDate ? new Date(dropoffDate) : null }),
        },
        include: { customer: true, items: true },
      });
    });
  },

  async updateStatus(id: number, status: QuotationStatus) {
    await this.findById(id);
    return prisma.quotation.update({ where: { id }, data: { status } });
  },

  async convertToTrip(id: number, tripData: {
    vehicleId:  number;
    driverId:   number;
    trailerId?: number;
    startDate:  string;
  }) {
    const q = await this.findById(id);
    if (q.status === 'CONVERTED') throw new AppError('Quotation already converted', 409);

    const settings = await prisma.settings.findFirst();
    const vatRate = settings?.vat ?? 15;
    const amount = q.items.reduce((s, i) => s + Number(i.total), 0);
    const vatAmount = amount * vatRate / 100;
    const totalAmount = amount + vatAmount;

    return prisma.$transaction(async (tx) => {
      const trip = await tx.trip.create({
        data: {
          customerId:   q.customerId,
          vehicleId:    tripData.vehicleId,
          driverId:     tripData.driverId,
          trailerId:    tripData.trailerId ?? null,
          fromLocation: q.pickup,
          toLocation:   q.dropoff,
          fromLat:      q.pickupLat  ?? undefined,
          fromLng:      q.pickupLng  ?? undefined,
          toLat:        q.dropoffLat ?? undefined,
          toLng:        q.dropoffLng ?? undefined,
          startDate:    new Date(tripData.startDate),
          amount,
          vatAmount,
          totalAmount,
          status:       TripStatus.PENDING,
        },
      });

      // Create a single leg
      await tx.tripLeg.create({
        data: {
          tripId:        trip.id,
          driverId:      tripData.driverId,
          startLocation: q.pickup,
          endLocation:   q.dropoff,
          scheduledAt:   new Date(tripData.startDate),
          order:         1,
          status:        'pending',
        },
      });

      await tx.quotation.update({
        where: { id },
        data: { status: 'CONVERTED', isConverted: true },
      });

      return trip;
    });
  },

  async remove(id: number) {
    await this.findById(id);
    return prisma.quotation.delete({ where: { id } });
  },
};
