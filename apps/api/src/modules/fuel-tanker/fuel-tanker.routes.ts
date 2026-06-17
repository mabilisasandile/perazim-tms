import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { fuelTankerService } from './fuel-tanker.service';
import {
  createTankerSchema, updateTankerSchema,
  createCompartmentSchema, updateCompartmentSchema,
  createDeliverySchema, updateDeliveryStatusSchema, updateStopSchema,
  createLoadSchema,
} from './fuel-tanker.schema';

const router = Router();
router.use(authenticate);

// ─── Tankers ──────────────────────────────────────────────────────────────────
router.get('/tankers',     async (_req, res, next) => { try { res.json(await fuelTankerService.findAllTankers()); } catch (e) { next(e); } });
router.get('/tankers/:id', async (req,  res, next) => { try { res.json(await fuelTankerService.findTankerById(+req.params.id)); } catch (e) { next(e); } });
router.post('/tankers',    async (req,  res, next) => { try { res.status(201).json(await fuelTankerService.createTanker(createTankerSchema.parse(req.body))); } catch (e) { next(e); } });
router.put('/tankers/:id', async (req,  res, next) => { try { res.json(await fuelTankerService.updateTanker(+req.params.id, updateTankerSchema.parse(req.body))); } catch (e) { next(e); } });
router.delete('/tankers/:id', async (req, res, next) => { try { await fuelTankerService.deleteTanker(+req.params.id); res.json({ message: 'Tanker deleted' }); } catch (e) { next(e); } });

// ─── Compartments (Tank Allocation) ──────────────────────────────────────────
router.post('/compartments',    async (req, res, next) => { try { res.status(201).json(await fuelTankerService.createCompartment(createCompartmentSchema.parse(req.body))); } catch (e) { next(e); } });
router.put('/compartments/:id', async (req, res, next) => { try { res.json(await fuelTankerService.updateCompartment(+req.params.id, updateCompartmentSchema.parse(req.body))); } catch (e) { next(e); } });
router.delete('/compartments/:id', async (req, res, next) => { try { await fuelTankerService.deleteCompartment(+req.params.id); res.json({ message: 'Compartment removed' }); } catch (e) { next(e); } });

// ─── Deliveries ───────────────────────────────────────────────────────────────
router.get('/deliveries', async (req, res, next) => {
  try {
    const tankerId = req.query.tankerId ? +req.query.tankerId : undefined;
    const status   = req.query.status as string | undefined;
    res.json(await fuelTankerService.findAllDeliveries(tankerId, status));
  } catch (e) { next(e); }
});
router.get('/deliveries/:id',  async (req, res, next) => { try { res.json(await fuelTankerService.findDeliveryById(+req.params.id)); } catch (e) { next(e); } });
router.post('/deliveries',     async (req, res, next) => { try { res.status(201).json(await fuelTankerService.createDelivery(createDeliverySchema.parse(req.body))); } catch (e) { next(e); } });
router.delete('/deliveries/:id', async (req, res, next) => { try { await fuelTankerService.deleteDelivery(+req.params.id); res.json({ message: 'Delivery deleted' }); } catch (e) { next(e); } });
router.patch('/deliveries/:id/status', async (req, res, next) => {
  try { res.json(await fuelTankerService.updateDeliveryStatus(+req.params.id, updateDeliveryStatusSchema.parse(req.body))); } catch (e) { next(e); }
});
router.patch('/deliveries/:id/stops/:stopId', async (req, res, next) => {
  try { res.json(await fuelTankerService.updateStop(+req.params.id, +req.params.stopId, updateStopSchema.parse(req.body))); } catch (e) { next(e); }
});

// ─── Loads ────────────────────────────────────────────────────────────────────
router.get('/loads',     async (req, res, next) => { try { const tid = req.query.tankerId ? +req.query.tankerId : undefined; res.json(await fuelTankerService.findAllLoads(tid)); } catch (e) { next(e); } });
router.post('/loads',    async (req, res, next) => { try { res.status(201).json(await fuelTankerService.createLoad(createLoadSchema.parse(req.body))); } catch (e) { next(e); } });
router.delete('/loads/:id', async (req, res, next) => { try { await fuelTankerService.deleteLoad(+req.params.id); res.json({ message: 'Load record deleted' }); } catch (e) { next(e); } });

export default router;
