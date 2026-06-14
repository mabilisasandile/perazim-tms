import { z } from 'zod';
export const createInvoiceSchema = z.object({
  customerId:          z.coerce.number().int().positive(),
  amount:              z.coerce.number().min(0),
  vatRate:             z.coerce.number().min(0).default(15),
  dueDate:             z.string().optional().nullable(),
  notes:               z.string().optional(),
  vehicleDescription:  z.string().optional(),
  vehicleCondition:    z.enum(['Runner', 'Non-Runner']).optional().nullable(),
});
export const updateStatusSchema = z.object({ status: z.enum(['unpaid', 'paid', 'overdue']) });
export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;
