import { z } from 'zod';

export const createDriverSchema = z.object({
  name:             z.string().min(1),
  mobile:           z.string().min(1),
  email:            z.string().email(),
  alternativePhone: z.string().optional(),
  idNumber:         z.string().optional(),
  nationality:      z.string().optional(),
  age:              z.coerce.number().int().positive().optional(),
  bloodGroup:       z.string().optional(),
  address:          z.string().optional(),
  licenseNo:        z.string().min(1),
  licenseType:      z.string().optional(),
  licenseExpiry:    z.string().optional().nullable(),
  pdpNumber:        z.string().optional(),
  pdpExpiry:        z.string().optional().nullable(),
  dateOfJoining:    z.string().optional().nullable(),
  totalExperience:  z.string().optional(),
  reference:        z.string().optional(),
  notes:            z.string().optional(),
  isActive:         z.boolean().default(true),
  assignedVehicleId: z.coerce.number().int().positive().optional().nullable(),
  assignedTrailerId: z.coerce.number().int().positive().optional().nullable(),
});

export const updateDriverSchema = createDriverSchema.partial();
export type CreateDriverDto = z.infer<typeof createDriverSchema>;
export type UpdateDriverDto = z.infer<typeof updateDriverSchema>;
