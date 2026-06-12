import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { quotationsService } from './quotations.service';
import { createQuotationSchema } from './quotations.schema';
import { QuotationStatus } from '@prisma/client';
import { z } from 'zod';

/**
 * @swagger
 * tags:
 *   name: Quotations
 *   description: Quotation management
 */
const router = Router();
router.use(authenticate);

const convertSchema = z.object({
  vehicleId:  z.coerce.number().int().positive(),
  driverId:   z.coerce.number().int().positive(),
  trailerId:  z.coerce.number().int().positive().optional(),
  startDate:  z.string().min(1),
});

router.get('/',                   async (req,  res, next) => { try { res.json(await quotationsService.findAll(req.query.customerId ? +req.query.customerId : undefined)); }                                                                  catch(e) { next(e); } });
router.get('/:id',                async (req,  res, next) => { try { res.json(await quotationsService.findById(+req.params.id)); }                                                                                                            catch(e) { next(e); } });
router.post('/',                  async (req,  res, next) => { try { res.status(201).json(await quotationsService.create(createQuotationSchema.parse(req.body))); }                                                                           catch(e) { next(e); } });
router.put('/:id',                async (req,  res, next) => { try { res.json(await quotationsService.update(+req.params.id, createQuotationSchema.partial().parse(req.body))); }                                                             catch(e) { next(e); } });
router.patch('/:id/status',       async (req,  res, next) => { try { const { status } = z.object({ status: z.nativeEnum(QuotationStatus) }).parse(req.body); res.json(await quotationsService.updateStatus(+req.params.id, status)); }       catch(e) { next(e); } });
router.post('/:id/convert',       async (req,  res, next) => { try { res.status(201).json(await quotationsService.convertToTrip(+req.params.id, convertSchema.parse(req.body))); }                                                           catch(e) { next(e); } });
router.delete('/:id',             async (req,  res, next) => { try { await quotationsService.remove(+req.params.id); res.json({ message: 'Quotation deleted' }); }                                                                           catch(e) { next(e); } });

export default router;
