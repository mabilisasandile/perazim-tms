import { z } from 'zod';

const fuelTypes = ['DIESEL', 'PETROL', 'PARAFFIN'] as const;

// ─── Tankers ──────────────────────────────────────────────────────────────────

export const createTankerSchema = z.object({
  name:           z.string().min(1),
  registrationNo: z.string().min(1),
  totalCapacity:  z.coerce.number().positive(),
  notes:          z.string().optional(),
});

export const updateTankerSchema = createTankerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ─── Compartments (Tank Allocation) ──────────────────────────────────────────

export const createCompartmentSchema = z.object({
  tankerId:      z.coerce.number().int().positive(),
  compartmentNo: z.coerce.number().int().positive(),
  capacity:      z.coerce.number().positive(),
  fuelType:      z.enum(fuelTypes),
  currentVolume: z.coerce.number().min(0).optional().default(0),
  notes:         z.string().optional(),
});

export const updateCompartmentSchema = z.object({
  fuelType:      z.enum(fuelTypes).optional(),
  capacity:      z.coerce.number().positive().optional(),
  currentVolume: z.coerce.number().min(0).optional(),
  notes:         z.string().optional(),
});

// ─── Deliveries (Route Planning) ─────────────────────────────────────────────

const stopSchema = z.object({
  order:        z.coerce.number().int().positive(),
  customerName: z.string().min(1),
  address:      z.string().min(1),
  fuelType:     z.enum(fuelTypes),
  plannedVolume: z.coerce.number().positive(),
  notes:        z.string().optional(),
});

export const createDeliverySchema = z.object({
  tankerId:    z.coerce.number().int().positive(),
  driverName:  z.string().optional(),
  plannedDate: z.string().min(1),
  notes:       z.string().optional(),
  stops:       z.array(stopSchema).min(1),
});

export const updateDeliverySchema = z.object({
  driverName:  z.string().optional(),
  plannedDate: z.string().optional(),
  notes:       z.string().optional(),
});

export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['PLANNED', 'LOADING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED']),
});

export const updateStopSchema = z.object({
  status:          z.enum(['PENDING', 'DELIVERED', 'SKIPPED']),
  deliveredVolume: z.coerce.number().min(0).optional(),
  notes:           z.string().optional(),
});

// ─── Loads (Load Management) ─────────────────────────────────────────────────

export const createLoadSchema = z.object({
  tankerId:      z.coerce.number().int().positive(),
  fuelType:      z.enum(fuelTypes),
  volume:        z.coerce.number().positive(),
  pricePerLitre: z.coerce.number().positive(),
  depotName:     z.string().min(1),
  driverName:    z.string().optional(),
  loadDate:      z.string().min(1),
  notes:         z.string().optional(),
});

export type CreateTankerDto    = z.infer<typeof createTankerSchema>;
export type UpdateTankerDto    = z.infer<typeof updateTankerSchema>;
export type CreateCompartmentDto = z.infer<typeof createCompartmentSchema>;
export type UpdateCompartmentDto = z.infer<typeof updateCompartmentSchema>;
export type CreateDeliveryDto  = z.infer<typeof createDeliverySchema>;
export type UpdateDeliveryStatusDto = z.infer<typeof updateDeliveryStatusSchema>;
export type UpdateStopDto      = z.infer<typeof updateStopSchema>;
export type CreateLoadDto      = z.infer<typeof createLoadSchema>;
