import { z } from 'zod';
export const createFuelSchema = z.object({
  vehicleId:    z.coerce.number().int().positive(),
  driverId:     z.coerce.number().int().positive().optional().nullable(),
  litres:       z.coerce.number().positive(),
  costPerLitre: z.coerce.number().positive(),
  odometer:     z.coerce.number().optional().nullable(),
  fillDate:     z.string().min(1),
  notes:        z.string().optional(),
});
export type CreateFuelDto = z.infer<typeof createFuelSchema>;
