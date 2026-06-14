import { z } from 'zod';
import { TripStatus, TripType } from '@prisma/client';

const tripLegSchema = z.object({
  driverId: z.number().int().positive(),
  startLocation: z.string().min(1),
  endLocation: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
});

export const createTripSchema = z.object({
  customerId: z.number().int().positive(),
  vehicleId: z.number().int().positive(),
  driverId: z.number().int().positive(),
  trailerId: z.number().int().positive().optional().nullable(),
  type: z.nativeEnum(TripType).default('SINGLE'),
  fromLocation: z.string().min(1),
  toLocation: z.string().min(1),
  fromLat: z.number().optional(),
  fromLng: z.number().optional(),
  toLat: z.number().optional(),
  toLng: z.number().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  amount: z.number().min(0).optional(),
  customerVehicleMake: z.string().optional(),
  customerVehicleColour: z.string().optional(),
  customerVehicleRegistration: z.string().optional(),
  customerVehicleVin: z.string().optional(),
  customerVehicleStock: z.string().optional(),
  customerVehicleEngine: z.string().optional(),
  vehicleCondition: z.enum(['Runner', 'Non-Runner']).optional().nullable(),
  legs: z.array(tripLegSchema).optional(),
});

export const updateTripSchema = createTripSchema.partial();

export const tripStatusSchema = z.object({
  status: z.nativeEnum(TripStatus),
});

export type CreateTripDto = z.infer<typeof createTripSchema>;
export type UpdateTripDto = z.infer<typeof updateTripSchema>;
