import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { loadsheetsService } from './loadsheets.service';
import { z } from 'zod';

/**
 * @swagger
 * tags:
 *   name: LoadSheets
 *   description: Driver load sheet management
 */
const router = Router();
router.use(authenticate);

const createSchema = z.object({
  driverId:  z.coerce.number().int().positive(),
  vehicleId: z.coerce.number().int().positive(),
  trailerId: z.coerce.number().int().positive().optional().nullable(),
  data:      z.any(),
  notes:     z.string().optional(),
});

const updateSchema = z.object({
  trailerId: z.coerce.number().int().positive().optional().nullable(),
  data:      z.any().optional(),
  notes:     z.string().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const filters = {
      driverId:  req.query.driverId  ? +req.query.driverId  : undefined,
      vehicleId: req.query.vehicleId ? +req.query.vehicleId : undefined,
    };
    res.json(await loadsheetsService.findAll(filters));
  } catch(e) { next(e); }
});

router.get('/:id',    async (req, res, next) => { try { res.json(await loadsheetsService.findById(+req.params.id)); }                                               catch(e) { next(e); } });
router.post('/',      async (req, res, next) => { try { res.status(201).json(await loadsheetsService.create(createSchema.parse(req.body))); }                       catch(e) { next(e); } });
router.put('/:id',    async (req, res, next) => { try { res.json(await loadsheetsService.update(+req.params.id, updateSchema.parse(req.body))); }                   catch(e) { next(e); } });
router.delete('/:id', async (req, res, next) => { try { await loadsheetsService.remove(+req.params.id); res.json({ message: 'Load sheet deleted' }); }             catch(e) { next(e); } });

export default router;
