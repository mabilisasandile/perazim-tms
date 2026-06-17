import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateTripDto, UpdateTripDto } from './trips.schema';
import { TripStatus } from '@prisma/client';
import { otpService } from '../otp/otp.service';
import { notificationService } from '../notifications/notification.service';
import { invoicesService } from '../invoices/invoices.service';

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

    const result = await prisma.$transaction(async (tx) => {
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

      return tx.trip.findUnique({ where: { id: trip.id }, include: { legs: true } });
    });

    // Fire-and-forget notifications after transaction completes
    if (result) {
      prisma.trip.findUnique({
        where: { id: result.id },
        include: { customer: true, driver: true },
      }).then(fullTrip => {
        if (!fullTrip) return;
        notificationService.dispatch('BOOKING_UPDATE', { trip: fullTrip }).catch(() => {});
        if (fullTrip.driverId) {
          notificationService.dispatch('TRIP_ALLOCATION', { trip: fullTrip }).catch(() => {});
        }
      }).catch(() => {});
    }

    return result;
  },

  async update(id: number, data: UpdateTripDto) {
    await this.findById(id);
    const updated = await prisma.trip.update({ where: { id }, data: data as any });
    if (updated.driverId) {
      prisma.trip.findUnique({
        where: { id },
        include: { driver: true, customer: true },
      }).then(fullTrip => {
        if (fullTrip) notificationService.dispatch('SCHEDULE_CHANGE', { trip: fullTrip }).catch(() => {});
      }).catch(() => {});
    }
    return updated;
  },

  async updateStatus(id: number, status: TripStatus) {
    const trip = await this.findById(id);

    if (status === 'COMPLETED') {
      // Require OTP authorisation
      const authorised = await otpService.isAuthorised(id);
      if (!authorised) {
        throw new AppError(
          'OTP verification is required to complete this trip. Send an OTP to the customer and verify it, or request an administrator bypass.',
          403,
        );
      }

      // Block closure if a linked invoice is still outstanding and customer is not pay-later approved
      const customer = await prisma.customer.findUnique({
        where: { id: trip.customerId },
        select: { payLaterApproved: true },
      });
      if (!customer?.payLaterApproved) {
        const hasOutstanding = await invoicesService.hasOutstandingInvoice(id);
        if (hasOutstanding) {
          throw new AppError(
            'This trip has an outstanding invoice. Settle the invoice or enable Pay-Later on the customer account before closing the trip.',
            402,
          );
        }
      }
    }

    const updated = await prisma.trip.update({ where: { id }, data: { status } });

    // Fire-and-forget notifications
    prisma.trip.findUnique({
      where: { id },
      include: { customer: true, driver: true },
    }).then(fullTrip => {
      if (!fullTrip) return;
      if (status === 'IN_PROGRESS' || status === 'COMPLETED') {
        notificationService.dispatch('DELIVERY_UPDATE', { trip: fullTrip, newStatus: status }).catch(() => {});
      }
      if (status === 'IN_PROGRESS' && fullTrip.driverId) {
        notificationService.dispatch('DISPATCH_ASSIGNMENT', { trip: fullTrip }).catch(() => {});
      }
    }).catch(() => {});

    return updated;
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
