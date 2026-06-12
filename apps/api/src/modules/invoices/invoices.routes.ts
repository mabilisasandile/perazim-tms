import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { invoicesService } from './invoices.service';
import { createInvoiceSchema } from './invoices.schema';

/**
 * @swagger
 * tags:
 *   name: Invoices
 *   description: Invoice management
 */
const router = Router();
router.use(authenticate);

router.get('/stats',          async (_req, res, next) => { try { res.json(await invoicesService.getStats()); }                                                                        catch(e) { next(e); } });
router.get('/',               async (req,  res, next) => { try { res.json(await invoicesService.findAll(req.query.status as string | undefined)); }                                   catch(e) { next(e); } });
router.get('/:id',            async (req,  res, next) => { try { res.json(await invoicesService.findById(+req.params.id)); }                                                          catch(e) { next(e); } });
router.post('/',              async (req,  res, next) => { try { res.status(201).json(await invoicesService.create(createInvoiceSchema.parse(req.body))); }                           catch(e) { next(e); } });
router.patch('/:id/status',   async (req,  res, next) => { try { res.json(await invoicesService.updateStatus(+req.params.id, req.body.status)); }                                    catch(e) { next(e); } });
router.post('/mark-overdue',  async (_req, res, next) => { try { res.json(await invoicesService.markOverdue()); }                                                                     catch(e) { next(e); } });
router.delete('/:id',         async (req,  res, next) => { try { await invoicesService.remove(+req.params.id); res.json({ message: 'Invoice deleted' }); }                          catch(e) { next(e); } });

export default router;
