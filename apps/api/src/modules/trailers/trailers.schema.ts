import { z } from 'zod';

export const createTrailerSchema = z.object({
  registrationNo: z.string().min(1),
  make:           z.string().optional(),
  type:           z.string().optional(),
  chassisNo:      z.string().optional(),
  loadCapacity:   z.coerce.number().optional(),
  colour:         z.string().optional(),
  licenseExpiry:  z.string().optional().nullable(),
  isActive:       z.boolean().default(true),
});
export const updateTrailerSchema = createTrailerSchema.partial();
export type CreateTrailerDto = z.infer<typeof createTrailerSchema>;
export type UpdateTrailerDto = z.infer<typeof updateTrailerSchema>;
