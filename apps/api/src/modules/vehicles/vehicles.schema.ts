import { z } from 'zod';

export const createVehicleSchema = z.object({
  registrationNo:     z.string().min(1, 'Registration number is required'),
  name:               z.string().min(1, 'Vehicle name is required'),
  chassisNo:          z.string().min(1, 'Chassis number is required'),
  engineNo:           z.string().min(1, 'Engine number is required'),
  apiUsername:        z.string().optional(),
  groupId:            z.number().int().positive().optional().nullable(),
  registrationExpiry: z.string().optional().nullable(),
  isActive:           z.boolean().default(true),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export type CreateVehicleDto = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleDto = z.infer<typeof updateVehicleSchema>;
