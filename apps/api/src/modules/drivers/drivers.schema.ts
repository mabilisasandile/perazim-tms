import { z } from 'zod';

export const createDriverSchema = z.object({
  name:              z.string().min(1),
  mobile:            z.string().min(1),
  email:             z.string().email(),
  age:               z.coerce.number().int().positive().optional(),
  address:           z.string().optional(),
  licenseNo:         z.string().min(1),
  licenseExpiry:     z.string().optional().nullable(),
  dateOfJoining:     z.string().optional().nullable(),
  totalExperience:   z.string().optional(),
  reference:         z.string().optional(),
  isActive:          z.boolean().default(true),
  assignedVehicleId: z.coerce.number().int().positive().optional().nullable(),
  assignedTrailerId: z.coerce.number().int().positive().optional().nullable(),
});

export const updateDriverSchema = createDriverSchema.partial();
export type CreateDriverDto = z.infer<typeof createDriverSchema>;
export type UpdateDriverDto = z.infer<typeof updateDriverSchema>;
