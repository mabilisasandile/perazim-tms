import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { incomeExpensesService } from './income-expenses.service';
import { z } from 'zod';

/**
 * @swagger
 * tags:
 *   name: IncomeExpenses
 *   description: Income and expense tracking per vehicle
 */
const router = Router();
router.use(authenticate);

const createSchema = z.object({
  vehicleId:   z.coerce.number().int().positive().optional(),
  type:        z.enum(['INCOME', 'EXPENSE']),
  description: z.string().min(1),
  amount:      z.coerce.number().positive(),
  date:        z.string().min(1),
});

router.get('/summary', async (req, res, next) => {
  try {
    res.json(await incomeExpensesService.getSummary(req.query.vehicleId ? +req.query.vehicleId : undefined));
  } catch(e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    const filters = {
      vehicleId: req.query.vehicleId ? +req.query.vehicleId : undefined,
      type:      req.query.type as 'INCOME' | 'EXPENSE' | undefined,
      month:     req.query.month as string | undefined,
    };
    res.json(await incomeExpensesService.findAll(filters));
  } catch(e) { next(e); }
});

router.get('/:id',    async (req, res, next) => { try { res.json(await incomeExpensesService.findById(+req.params.id)); }                                                   catch(e) { next(e); } });
router.post('/',      async (req, res, next) => { try { res.status(201).json(await incomeExpensesService.create(createSchema.parse(req.body))); }                           catch(e) { next(e); } });
router.put('/:id',    async (req, res, next) => { try { res.json(await incomeExpensesService.update(+req.params.id, req.body)); }                                           catch(e) { next(e); } });
router.delete('/:id', async (req, res, next) => { try { await incomeExpensesService.remove(+req.params.id); res.json({ message: 'Record deleted' }); }                    catch(e) { next(e); } });

export default router;
