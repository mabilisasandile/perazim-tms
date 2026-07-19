import { z } from 'zod';
import { BookingStatus } from '@prisma/client';

// One vehicle entry within a multi-vehicle booking. Each entry becomes its
// own Trip record, grouped together under a single Booking.
export const bookingVehicleSchema = z.object({
  vehicleId:  z.number().int().positive(),
  driverId:   z.number().int().positive(),
  trailerId:  z.number().int().positive().optional().nullable(),

  fromLocation: z.string().min(1),
  toLocation:   z.string().min(1),
  startDate:    z.string().min(1),
  endDate:      z.string().optional().nullable(),

  amount: z.number().min(0).optional(),

  // Customer's vehicle being transported
  customerVehicleMake:         z.string().optional(),
  customerVehicleColour:       z.string().optional(),
  customerVehicleRegistration: z.string().optional(),
  customerVehicleVin:          z.string().optional(),
  customerVehicleStock:        z.string().optional(),
  customerVehicleEngine:       z.string().optional(),
  vehicleCondition:            z.enum(['Runner', 'Non-Runner']).optional().nullable(),
});

export const createBookingSchema = z.object({
  customerId: z.number().int().positive(),
  notes:      z.string().optional(),
  sendConfirmationEmail: z.boolean().optional(),
  // At least one vehicle is required; multiple vehicles are grouped under
  // this single booking document / booking number.
  vehicles: z.array(bookingVehicleSchema).min(1, 'At least one vehicle is required'),
});

export const updateBookingStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus),
});

export type CreateBookingDto      = z.infer<typeof createBookingSchema>;
export type BookingVehicleDto     = z.infer<typeof bookingVehicleSchema>;
export type UpdateBookingStatusDto = z.infer<typeof updateBookingStatusSchema>;
