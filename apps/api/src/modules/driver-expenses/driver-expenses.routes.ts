import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/authenticate';
import { driverExpensesService } from './driver-expenses.service';
import { z } from 'zod';

/**
 * @swagger
 * tags:
 *   name: DriverExpenses
 *   description: Expense tracking per driver
 */
const router = Router();
router.use(authenticate);

const createSchema = z.object({
  driverId:    z.coerce.number().int().positive(),
  description: z.string().min(1),
  amount:      z.coerce.number().positive(),
  date:        z.string().min(1),
});

router.get('/', requirePermission('driverList'), async (req, res, next) => {
  try {
    const filters = {
      driverId: req.query.driverId ? +req.query.driverId : undefined,
      month:    req.query.month as string | undefined,
    };
    res.json(await driverExpensesService.findAll(filters));
  } catch(e) { next(e); }
});

router.get('/:id',    requirePermission('driverList'), async (req, res, next) => { try { res.json(await driverExpensesService.findById(+req.params.id)); }                                        catch(e) { next(e); } });
router.post('/',      requirePermission('driverEdit'), async (req, res, next) => { try { res.status(201).json(await driverExpensesService.create(createSchema.parse(req.body))); }               catch(e) { next(e); } });
router.put('/:id',    requirePermission('driverEdit'), async (req, res, next) => { try { res.json(await driverExpensesService.update(+req.params.id, req.body)); }                                catch(e) { next(e); } });
router.delete('/:id', requirePermission('driverEdit'), async (req, res, next) => { try { await driverExpensesService.remove(+req.params.id); res.json({ message: 'Record deleted' }); }         catch(e) { next(e); } });

export default router;
