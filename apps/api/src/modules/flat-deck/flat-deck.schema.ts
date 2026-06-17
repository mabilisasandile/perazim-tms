import { z } from 'zod';

export const TRAILER_TYPES = ['FLAT_12M', 'SUPERLINK_FLAT_DECK', 'TAUTLINER', 'LOWBED'] as const;
export const SPECIAL_REQS  = ['STANDARD', 'OVERSIZED', 'HAZARDOUS', 'FRAGILE', 'HEAVY_LIFT'] as const;
export const JOB_STATUSES  = ['PLANNED', 'LOADING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] as const;

// ─── Cargo item (nested in job) ───────────────────────────────────────────────

const cargoItemSchema = z.object({
  description:        z.string().min(1),
  quantity:           z.coerce.number().int().positive().default(1),
  weightPerUnit:      z.coerce.number().positive(),
  lengthM:            z.coerce.number().positive().optional().nullable(),
  widthM:             z.coerce.number().positive().optional().nullable(),
  heightM:            z.coerce.number().positive().optional().nullable(),
  specialRequirement: z.enum(SPECIAL_REQS).default('STANDARD'),
  notes:              z.string().optional(),
});

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const createJobSchema = z.object({
  trailerType: z.enum(TRAILER_TYPES),
  trailerId:   z.coerce.number().int().positive().optional().nullable(),
  vehicleId:   z.coerce.number().int().positive().optional().nullable(),
  driverName:  z.string().optional(),
  origin:      z.string().min(1),
  destination: z.string().min(1),
  plannedDate: z.string().min(1),
  notes:       z.string().optional(),
  cargo:       z.array(cargoItemSchema).min(1),
});

export const updateJobSchema = z.object({
  trailerId:   z.coerce.number().int().positive().optional().nullable(),
  vehicleId:   z.coerce.number().int().positive().optional().nullable(),
  driverName:  z.string().optional(),
  origin:      z.string().min(1).optional(),
  destination: z.string().min(1).optional(),
  plannedDate: z.string().optional(),
  notes:       z.string().optional(),
});

export const updateJobStatusSchema = z.object({
  status: z.enum(JOB_STATUSES),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export const createRouteSchema = z.object({
  name:            z.string().min(1),
  origin:          z.string().min(1),
  destination:     z.string().min(1),
  distanceKm:      z.coerce.number().positive().optional().nullable(),
  maxWeightTonnes: z.coerce.number().positive().optional().nullable(),
  maxHeightM:      z.coerce.number().positive().optional().nullable(),
  maxLengthM:      z.coerce.number().positive().optional().nullable(),
  allows12mFlat:   z.boolean().default(true),
  allowsSuperlink: z.boolean().default(true),
  allowsTautliner: z.boolean().default(true),
  allowsLowbed:    z.boolean().default(true),
  notes:           z.string().optional(),
});

export const updateRouteSchema = createRouteSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ─── Compatibility check ──────────────────────────────────────────────────────

export const compatibilityCheckSchema = z.object({
  routeId:      z.coerce.number().int().positive(),
  trailerType:  z.enum(TRAILER_TYPES),
  totalWeightKg: z.coerce.number().nonnegative().optional(),
  maxHeightM:   z.coerce.number().positive().optional().nullable(),
  maxLengthM:   z.coerce.number().positive().optional().nullable(),
});

export type CreateJobDto            = z.infer<typeof createJobSchema>;
export type UpdateJobDto            = z.infer<typeof updateJobSchema>;
export type UpdateJobStatusDto      = z.infer<typeof updateJobStatusSchema>;
export type CreateRouteDto          = z.infer<typeof createRouteSchema>;
export type UpdateRouteDto          = z.infer<typeof updateRouteSchema>;
export type CompatibilityCheckDto   = z.infer<typeof compatibilityCheckSchema>;
