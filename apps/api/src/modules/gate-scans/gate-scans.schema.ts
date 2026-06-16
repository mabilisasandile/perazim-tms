import { z } from 'zod';

export const createGateScanSchema = z.object({
  scanType:      z.enum(['ENTRY', 'EXIT']),
  trackingCode:  z.string().min(1),
  tripId:        z.coerce.number().int().positive().optional(),

  driverName:    z.string().optional(),
  driverLicense: z.string().optional(),
  driverPhone:   z.string().optional(),

  towTruckReg:   z.string().optional(),
  towTruckDriver: z.string().optional(),

  officerName:   z.string().optional(),
  isApproved:    z.boolean().default(false),

  gateName:      z.string().optional(),
  scannedAt:     z.string().optional(),
  notes:         z.string().optional(),
});

export type CreateGateScanDto = z.infer<typeof createGateScanSchema>;
