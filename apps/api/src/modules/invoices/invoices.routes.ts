import { Router } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate';
import { invoicesService } from './invoices.service';
import { createInvoiceSchema } from './invoices.schema';
import { auditService, getIp } from '../audit-trail/audit.service';

/**
 * @swagger
 * tags:
 *   name: Invoices
 *   description: Invoice management
 */
const router = Router();
router.use(authenticate);

router.get('/stats',         async (_req, res, next) => { try { res.json(await invoicesService.getStats()); }                                                                        catch(e) { next(e); } });
router.get('/',              async (req,  res, next) => { try { res.json(await invoicesService.findAll(req.query.status as string | undefined)); }                                   catch(e) { next(e); } });
router.get('/:id',           async (req,  res, next) => { try { res.json(await invoicesService.findById(+req.params.id)); }                                                          catch(e) { next(e); } });

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const inv = await invoicesService.create(createInvoiceSchema.parse(req.body));
    res.status(201).json(inv);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId:   (inv as any)?.id,
      newValue:   inv,
    });
  } catch(e) { next(e); }
});

router.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const oldInv = await invoicesService.findById(id);
    const inv = await invoicesService.updateStatus(id, req.body.status);
    res.json(inv);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'INVOICE_STATUS_UPDATED',
      entityType: 'INVOICE',
      entityId:   id,
      oldValue:   { status: oldInv.status },
      newValue:   { status: req.body.status },
    });
  } catch(e) { next(e); }
});

router.post('/mark-overdue', async (_req, res, next) => { try { res.json(await invoicesService.markOverdue()); } catch(e) { next(e); } });

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const oldInv = await invoicesService.findById(id);
    await invoicesService.remove(id);
    res.json({ message: 'Invoice deleted' });
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'INVOICE_DELETED',
      entityType: 'INVOICE',
      entityId:   id,
      oldValue:   oldInv,
    });
  } catch(e) { next(e); }
});

export default router;
