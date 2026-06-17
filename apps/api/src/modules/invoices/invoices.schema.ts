import { z } from 'zod';

export const invoiceItemSchema = z.object({
  description:      z.string().min(1),
  vehicleCondition: z.enum(['Runner', 'Non-Runner']).optional().nullable(),
  quantity:         z.coerce.number().int().min(1).default(1),
  unitPrice:        z.coerce.number().min(0),
});

export const createInvoiceSchema = z.object({
  customerId:          z.coerce.number().int().positive(),
  tripId:              z.coerce.number().int().positive().optional().nullable(),
  amount:              z.coerce.number().min(0),
  vatRate:             z.coerce.number().min(0).default(15),
  depositRequired:     z.coerce.number().min(0).optional().nullable(),
  dueDate:             z.string().optional().nullable(),
  notes:               z.string().optional(),
  vehicleDescription:  z.string().optional(),
  vehicleCondition:    z.enum(['Runner', 'Non-Runner']).optional().nullable(),
  // For bulk vehicle invoicing — if items present, amount is derived from items
  items:               z.array(invoiceItemSchema).optional(),
});

export const createInvoicePaymentSchema = z.object({
  type:      z.enum(['DEPOSIT', 'PAYMENT']).default('PAYMENT'),
  amount:    z.coerce.number().positive(),
  method:    z.enum(['payfast', 'manual', 'eft', 'cash']).default('manual'),
  reference: z.string().optional().nullable(),
  notes:     z.string().optional().nullable(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['unpaid', 'partial', 'paid', 'overdue']),
});

export type CreateInvoiceDto        = z.infer<typeof createInvoiceSchema>;
export type CreateInvoicePaymentDto = z.infer<typeof createInvoicePaymentSchema>;
export type InvoiceItemDto          = z.infer<typeof invoiceItemSchema>;
