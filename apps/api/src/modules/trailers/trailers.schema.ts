import { z } from 'zod';

export const TRAILER_CATEGORIES = ['Flat Deck', 'Superlink', 'Lowbed', 'Tautliner'] as const;
export const TRAILER_STATUSES   = ['Available', 'In Use', 'Under Maintenance']       as const;

export const createTrailerSchema = z.object({
  registrationNo:    z.string().min(1),
  make:              z.string().optional(),
  type:              z.string().optional(),
  category:          z.enum(TRAILER_CATEGORIES).optional().nullable(),
  chassisNo:         z.string().optional(),
  loadCapacity:      z.coerce.number().positive().optional().nullable(),
  colour:            z.string().optional(),
  licenseNo:         z.string().optional(),
  licenseExpiry:     z.string().optional().nullable(),
  status:            z.enum(TRAILER_STATUSES).default('Available'),
  isActive:          z.boolean().default(true),
  assignedVehicleId: z.coerce.number().int().positive().optional().nullable(),
});

export const updateTrailerSchema   = createTrailerSchema.partial();
export const updateStatusSchema    = z.object({ status: z.enum(TRAILER_STATUSES) });

export type CreateTrailerDto = z.infer<typeof createTrailerSchema>;
export type UpdateTrailerDto = z.infer<typeof updateTrailerSchema>;
