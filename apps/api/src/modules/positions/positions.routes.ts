import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { positionsService } from './positions.service';
import { z } from 'zod';

/**
 * @swagger
 * tags:
 *   name: Positions
 *   description: GPS position tracking
 */
const router = Router();
router.use(authenticate);

const positionSchema = z.object({
  vehicleId:  z.coerce.number().int().positive(),
  tripId:     z.coerce.number().int().positive().optional().nullable(),
  latitude:   z.coerce.number(),
  longitude:  z.coerce.number(),
  altitude:   z.coerce.number().optional(),
  speed:      z.coerce.number().optional(),
  bearing:    z.coerce.number().optional(),
  accuracy:   z.coerce.number().optional(),
  recordedAt: z.string().datetime().optional(),
});

const bulkSchema = z.object({
  positions: z.array(positionSchema).min(1).max(500),
});

router.get('/latest', async (_req, res, next) => {
  try {
    res.json(await positionsService.getLatestPerVehicle());
  } catch(e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    const filters = {
      vehicleId: req.query.vehicleId ? +req.query.vehicleId : undefined,
      tripId:    req.query.tripId    ? +req.query.tripId    : undefined,
      limit:     req.query.limit     ? +req.query.limit     : 100,
    };
    res.json(await positionsService.findAll(filters));
  } catch(e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = positionSchema.parse(req.body);
    res.status(201).json(await positionsService.create({
      ...data,
      recordedAt: data.recordedAt ? new Date(data.recordedAt) : undefined,
    } as any));
  } catch(e) { next(e); }
});

// Bulk insert for GPS device batches
router.post('/bulk', async (req, res, next) => {
  try {
    const { positions } = bulkSchema.parse(req.body);
    const result = await positionsService.bulkCreate(
      positions.map(p => ({
        ...p,
        recordedAt: p.recordedAt ? new Date(p.recordedAt) : undefined,
      })) as any[]
    );
    res.status(201).json({ inserted: result.count });
  } catch(e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await positionsService.remove(+req.params.id);
    res.json({ message: 'Position deleted' });
  } catch(e) { next(e); }
});

// Admin: purge old positions (older than N days)
router.delete('/purge/:days', async (req, res, next) => {
  try {
    const days = +req.params.days;
    if (isNaN(days) || days < 1) return res.status(400).json({ error: 'Invalid days value' });
    const result = await positionsService.purgeOlderThan(days);
    res.json({ deleted: result.count });
  } catch(e) { next(e); }
});

export default router;
