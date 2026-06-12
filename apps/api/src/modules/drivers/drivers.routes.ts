import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { driversService } from './drivers.service';
import { createDriverSchema, updateDriverSchema } from './drivers.schema';

const router = Router();
router.use(authenticate);
router.get('/',       async (_req, res, next) => { try { res.json(await driversService.findAll()); } catch(e) { next(e); } });
router.get('/:id',    async (req,  res, next) => { try { res.json(await driversService.findById(+req.params.id)); } catch(e) { next(e); } });
router.post('/',      async (req,  res, next) => { try { res.status(201).json(await driversService.create(createDriverSchema.parse(req.body))); } catch(e) { next(e); } });
router.put('/:id',    async (req,  res, next) => { try { res.json(await driversService.update(+req.params.id, updateDriverSchema.parse(req.body))); } catch(e) { next(e); } });
router.delete('/:id', async (req,  res, next) => { try { await driversService.remove(+req.params.id); res.json({ message: 'Driver deleted' }); } catch(e) { next(e); } });
export default router;
