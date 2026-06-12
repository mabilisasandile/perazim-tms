import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { customersService } from './customers.service';
import { createCustomerSchema, updateCustomerSchema } from './customers.schema';
import { z } from 'zod';

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management
 */
const router = Router();
router.use(authenticate);

router.get('/',                    async (_req, res, next) => { try { res.json(await customersService.findAll()); }                                                              catch(e) { next(e); } });
router.get('/:id',                 async (req,  res, next) => { try { res.json(await customersService.findById(+req.params.id)); }                                               catch(e) { next(e); } });
router.get('/:id/trips',           async (req,  res, next) => { try { res.json(await customersService.getTrips(+req.params.id)); }                                               catch(e) { next(e); } });
router.post('/',                   async (req,  res, next) => { try { res.status(201).json(await customersService.create(createCustomerSchema.parse(req.body))); }               catch(e) { next(e); } });
router.put('/:id',                 async (req,  res, next) => { try { res.json(await customersService.update(+req.params.id, updateCustomerSchema.parse(req.body))); }           catch(e) { next(e); } });
router.delete('/:id',              async (req,  res, next) => { try { await customersService.remove(+req.params.id); res.json({ message: 'Customer deleted' }); }               catch(e) { next(e); } });
router.put('/:id/portal-password', async (req,  res, next) => {
  try {
    const { password } = z.object({ password: z.string().min(8) }).parse(req.body);
    await customersService.setPortalPassword(+req.params.id, password);
    res.json({ message: 'Portal password set' });
  } catch(e) { next(e); }
});

export default router;
