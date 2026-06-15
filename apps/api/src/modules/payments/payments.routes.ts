import { Router } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate';
import { paymentsService } from './payments.service';
import { z } from 'zod';
import { auditService, getIp } from '../audit-trail/audit.service';

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

router.get('/summary', async (_req, res, next) => { try { res.json(await paymentsService.getSummary()); } catch(e) { next(e); } });

router.get('/', async (req, res, next) => {
  try {
    const filters = {
      tripId: req.query.tripId ? +req.query.tripId : undefined,
      status: req.query.status as string | undefined,
    };
    res.json(await paymentsService.findAll(filters));
  } catch(e) { next(e); }
});

router.get('/:id', async (req, res, next) => { try { res.json(await paymentsService.findById(+req.params.id)); } catch(e) { next(e); } });

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const payment = await paymentsService.create(createSchema.parse(req.body));
    res.status(201).json(payment);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'PAYMENT_CREATED',
      entityType: 'PAYMENT',
      entityId:   (payment as any)?.id,
      newValue:   payment,
    });
  } catch(e) { next(e); }
});

router.patch('/:id/mark-paid', async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const oldPayment = await paymentsService.findById(id);
    const { reference } = markPaidSchema.parse(req.body);
    const payment = await paymentsService.markPaid(id, reference);
    res.json(payment);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'PAYMENT_MARKED_PAID',
      entityType: 'PAYMENT',
      entityId:   id,
      oldValue:   { status: oldPayment.status },
      newValue:   { status: 'paid', reference },
    });
  } catch(e) { next(e); }
});

router.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const oldPayment = await paymentsService.findById(id);
    const { status, reference } = statusSchema.parse(req.body);
    const payment = await paymentsService.updateStatus(id, status, reference);
    res.json(payment);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'PAYMENT_STATUS_UPDATED',
      entityType: 'PAYMENT',
      entityId:   id,
      oldValue:   { status: oldPayment.status },
      newValue:   { status, reference },
    });
  } catch(e) { next(e); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const oldPayment = await paymentsService.findById(id);
    await paymentsService.remove(id);
    res.json({ message: 'Payment deleted' });
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'PAYMENT_DELETED',
      entityType: 'PAYMENT',
      entityId:   id,
      oldValue:   oldPayment,
    });
  } catch(e) { next(e); }
});

export default router;
