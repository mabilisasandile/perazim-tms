import { Router } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate';
import { loadsheetsService } from './loadsheets.service';
import { z } from 'zod';
import { auditService, getIp } from '../audit-trail/audit.service';

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

router.get('/:id', async (req, res, next) => { try { res.json(await loadsheetsService.findById(+req.params.id)); } catch(e) { next(e); } });

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const ls = await loadsheetsService.create(createSchema.parse(req.body) as Parameters<typeof loadsheetsService.create>[0]);
    res.status(201).json(ls);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'WAREHOUSE_LOADSHEET_CREATED',
      entityType: 'WAREHOUSE',
      entityId:   (ls as any)?.id,
      newValue:   ls,
    });
  } catch(e) { next(e); }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const oldLs = await loadsheetsService.findById(id);
    const ls = await loadsheetsService.update(id, updateSchema.parse(req.body));
    res.json(ls);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'WAREHOUSE_LOADSHEET_UPDATED',
      entityType: 'WAREHOUSE',
      entityId:   id,
      oldValue:   oldLs,
      newValue:   ls,
    });
  } catch(e) { next(e); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const oldLs = await loadsheetsService.findById(id);
    await loadsheetsService.remove(id);
    res.json({ message: 'Load sheet deleted' });
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'WAREHOUSE_LOADSHEET_DELETED',
      entityType: 'WAREHOUSE',
      entityId:   id,
      oldValue:   oldLs,
    });
  } catch(e) { next(e); }
});

export default router;
