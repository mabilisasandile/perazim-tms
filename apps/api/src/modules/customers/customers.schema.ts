import { z } from 'zod';
export const createCustomerSchema = z.object({
  name:             z.string().min(1),
  email:            z.string().email(),
  phone:            z.string().optional(),
  alternativePhone: z.string().optional(),
  address:          z.string().optional(),
  companyName:      z.string().optional(),
  vatNumber:        z.string().optional(),
  contactPerson:    z.string().optional(),
  notes:            z.string().optional(),
  isActive:         z.boolean().default(true),
});
export const updateCustomerSchema = createCustomerSchema.partial();
export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
