import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { fuelService } from './fuel.service';
import { createFuelSchema } from './fuel.schema';

const router = Router();
router.use(authenticate);
router.get('/',       async (req,  res, next) => { try { res.json(await fuelService.findAll(req.query.vehicleId ? +req.query.vehicleId : undefined)); } catch(e) { next(e); } });
router.post('/',      async (req,  res, next) => { try { res.status(201).json(await fuelService.create(createFuelSchema.parse(req.body))); } catch(e) { next(e); } });
router.delete('/:id', async (req,  res, next) => { try { await fuelService.remove(+req.params.id); res.json({ message: 'Record deleted' }); } catch(e) { next(e); } });
export default router;
