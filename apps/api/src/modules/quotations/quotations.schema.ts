import { z } from 'zod';
import { QuotationStatus } from '@prisma/client';

const itemSchema = z.object({
  description:  z.string().min(1),
  colour:       z.string().optional(),
  registration: z.string().optional(),
  quantity:     z.coerce.number().int().min(1).default(1),
  unitPrice:    z.coerce.number().min(0),
});

export const createQuotationSchema = z.object({
  customerId:  z.coerce.number().int().positive(),
  pickup:      z.string().min(1),
  dropoff:     z.string().min(1),
  pickupDate:  z.string().optional().nullable(),
  dropoffDate: z.string().optional().nullable(),
  information: z.string().optional(),
  items:       z.array(itemSchema).min(1),
});

export const updateStatusSchema = z.object({ status: z.nativeEnum(QuotationStatus) });
export type CreateQuotationDto = z.infer<typeof createQuotationSchema>;
