import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateBookingDto } from './bookings.schema';
import { BookingStatus } from '@prisma/client';
import { notificationService } from '../notifications/notification.service';

/**
 * Generates a human-readable, per-year sequential booking number, e.g.
 * "BK-2026-00001". This replaces relying on Trip.trackingCode (a random
 * cuid) as the customer-facing booking reference.
 */
async function generateBookingNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BK-${year}-`;
  const count = await prisma.booking.count({
    where: { bookingNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(5, '0')}`;
}

const bookingInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  trips: {
    include: {
      vehicle: { select: { id: true, name: true, registrationNo: true } },
      driver:  { select: { id: true, name: true, mobile: true } },
      trailer: { select: { id: true, registrationNo: true } },
    },
  },
  invoices: {
    select: { id: true, number: true, status: true, total: true, tripId: true },
  },
};

export const bookingsService = {
  async findAll(customerId?: number) {
    return prisma.booking.findMany({
      where: customerId ? { customerId } : undefined,
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: number) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });
    if (!booking) throw new AppError('Booking not found', 404);
    return booking;
  },

  async create(data: CreateBookingDto, createdById: number) {
    const { customerId, notes, vehicles, sendConfirmationEmail } = data;

    const settings = await prisma.settings.findFirst();
    const vatRate = settings?.vat ?? 15;
    const bookingNumber = await generateBookingNumber();

    const bookingId = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: { bookingNumber, customerId, notes, createdById },
      });

      for (const v of vehicles) {
        const amount = v.amount ?? 0;
        const vatAmount = amount * vatRate / 100;
        const totalAmount = amount + vatAmount;

        const trip = await tx.trip.create({
          data: {
            bookingId:   booking.id,
            customerId,
            vehicleId:   v.vehicleId,
            driverId:    v.driverId,
            trailerId:   v.trailerId ?? null,
            fromLocation: v.fromLocation,
            toLocation:   v.toLocation,
            startDate:    new Date(v.startDate),
            endDate:      v.endDate ? new Date(v.endDate) : null,
            amount,
            vatAmount,
            totalAmount,
            customerVehicleMake:         v.customerVehicleMake,
            customerVehicleColour:       v.customerVehicleColour,
            customerVehicleRegistration: v.customerVehicleRegistration,
            customerVehicleVin:          v.customerVehicleVin,
            customerVehicleStock:        v.customerVehicleStock,
            customerVehicleEngine:       v.customerVehicleEngine,
            vehicleCondition:            v.vehicleCondition,
            createdById,
          },
        });

        await tx.tripLeg.create({
          data: {
            tripId:        trip.id,
            driverId:      v.driverId,
            startLocation: v.fromLocation,
            endLocation:   v.toLocation,
            scheduledAt:   new Date(v.startDate),
            order:         1,
            status:        'pending',
          },
        });
      }

      return booking.id;
    });

    const full = await this.findById(bookingId);

    // Fire-and-forget confirmation + driver-allocation emails, one per
    // vehicle/trip in the booking (reuses the existing per-trip templates).
    if (sendConfirmationEmail !== false) {
      for (const trip of full.trips) {
        prisma.trip.findUnique({
          where: { id: trip.id },
          include: { customer: true, driver: true },
        }).then(fullTrip => {
          if (!fullTrip) return;
          notificationService.dispatch('BOOKING_UPDATE', { trip: fullTrip }).catch(() => {});
          if (fullTrip.driverId) {
            notificationService.dispatch('TRIP_ALLOCATION', { trip: fullTrip }).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    return full;
  },

  async updateStatus(id: number, status: BookingStatus) {
    await this.findById(id);
    return prisma.booking.update({ where: { id }, data: { status }, include: bookingInclude });
  },

  async remove(id: number) {
    await this.findById(id);
    // Trips remain (bookingId is optional), but detach them from the deleted booking.
    await prisma.$transaction([
      prisma.trip.updateMany({ where: { bookingId: id }, data: { bookingId: null } }),
      prisma.booking.delete({ where: { id } }),
    ]);
    return { message: 'Booking deleted' };
  },
};
