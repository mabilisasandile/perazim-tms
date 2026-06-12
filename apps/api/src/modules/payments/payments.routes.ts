import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { paymentsService } from './payments.service';
import { z } from 'zod';

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Trip payment tracking
 */
const router = Router();
router.use(authenticate);

const createSchema = z.object({
  tripId:    z.coerce.number().int().positive(),
  vehicleId: z.coerce.number().int().positive(),
  amount:    z.coerce.number().positive(),
  method:    z.enum(['payfast', 'manual', 'eft']).default('manual'),
  reference: z.string().optional(),
});

const markPaidSchema = z.object({
  reference: z.string().optional(),
});

const statusSchema = z.object({
  status:    z.enum(['pending', 'paid', 'failed']),
  reference: z.string().optional(),
});

router.get('/summary',      async (_req, res, next) => { try { res.json(await paymentsService.getSummary()); }                                                                              catch(e) { next(e); } });
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      tripId: req.query.tripId ? +req.query.tripId : undefined,
      status: req.query.status as string | undefined,
    };
    res.json(await paymentsService.findAll(filters));
  } catch(e) { next(e); }
});
router.get('/:id',          async (req,  res, next) => { try { res.json(await paymentsService.findById(+req.params.id)); }                                                                  catch(e) { next(e); } });
router.post('/',            async (req,  res, next) => { try { res.status(201).json(await paymentsService.create(createSchema.parse(req.body))); }                                          catch(e) { next(e); } });
router.patch('/:id/mark-paid', async (req, res, next) => { try { const { reference } = markPaidSchema.parse(req.body); res.json(await paymentsService.markPaid(+req.params.id, reference)); } catch(e) { next(e); } });
router.patch('/:id/status', async (req, res, next) => { try { const { status, reference } = statusSchema.parse(req.body); res.json(await paymentsService.updateStatus(+req.params.id, status, reference)); } catch(e) { next(e); } });
router.delete('/:id',       async (req,  res, next) => { try { await paymentsService.remove(+req.params.id); res.json({ message: 'Payment deleted' }); }                                   catch(e) { next(e); } });

export default router;
