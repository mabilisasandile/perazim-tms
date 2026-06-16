import { z } from 'zod';

export const createWarehouseSchema = z.object({
  name:         z.string().min(1),
  location:     z.string().min(1),
  capacity:     z.coerce.number().int().positive(),
  contactName:  z.string().optional(),
  contactPhone: z.string().optional(),
  isActive:     z.boolean().default(true),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

export const allocateVehicleSchema = z.object({
  tripId:    z.coerce.number().int().positive(),
  arrivedAt: z.string().optional(),
  notes:     z.string().optional(),
});

export const updateVehicleStatusSchema = z.object({
  status:      z.enum(['IN_STORAGE', 'AWAITING_DISPATCH', 'DISPATCHED']),
  dispatchedAt: z.string().optional(),
  notes:       z.string().optional(),
});

export const transferVehicleSchema = z.object({
  toWarehouseId: z.coerce.number().int().positive(),
  notes:         z.string().optional(),
});

export type CreateWarehouseDto     = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseDto     = z.infer<typeof updateWarehouseSchema>;
export type AllocateVehicleDto     = z.infer<typeof allocateVehicleSchema>;
export type UpdateVehicleStatusDto = z.infer<typeof updateVehicleStatusSchema>;
export type TransferVehicleDto     = z.infer<typeof transferVehicleSchema>;
