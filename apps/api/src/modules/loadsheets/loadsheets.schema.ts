import { z } from 'zod';

export const createLoadSheetSchema = z.object({
  truckId:   z.coerce.number().int().positive(),
  trailerId: z.coerce.number().int().positive().optional().nullable(),
  driverId:  z.coerce.number().int().positive(),
  route:     z.string().min(1),
  capacity:  z.coerce.number().int().min(1).max(100),
  notes:     z.string().optional(),
});

export const updateLoadSheetSchema = z.object({
  trailerId: z.coerce.number().int().positive().optional().nullable(),
  route:     z.string().min(1).optional(),
  capacity:  z.coerce.number().int().min(1).max(100).optional(),
  notes:     z.string().optional().nullable(),
});

export const updateLoadSheetStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED']),
});

export const addVehicleSchema = z.object({
  tripId:          z.coerce.number().int().positive(),
  pickupLocation:  z.string().min(1),
  deliveryLocation: z.string().min(1),
  vehicleCondition: z.enum(['Runner', 'Non-Runner']).optional(),
});

export const updateVehicleStatusSchema = z.object({
  status: z.enum(['YET_TO_START', 'ONGOING', 'COMPLETED']),
  lat:    z.coerce.number().optional(),
  lng:    z.coerce.number().optional(),
});

export type CreateLoadSheetInput    = z.infer<typeof createLoadSheetSchema>;
export type UpdateLoadSheetInput    = z.infer<typeof updateLoadSheetSchema>;
export type AddVehicleInput         = z.infer<typeof addVehicleSchema>;
export type UpdateVehicleStatusInput = z.infer<typeof updateVehicleStatusSchema>;
