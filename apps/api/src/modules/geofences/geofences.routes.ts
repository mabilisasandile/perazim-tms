import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { geofencesService } from './geofences.service';
import { z } from 'zod';

/**
 * @swagger
 * tags:
 *   name: Geofences
 *   description: Geofence zones and event tracking
 */
const router = Router();
router.use(authenticate);

const createSchema = z.object({
  name:        z.string().min(1),
  description: z.string().optional(),
  area:        z.any(),
  vehicleIds:  z.array(z.number().int().positive()).optional(),
});

const eventSchema = z.object({
  vehicleId:  z.coerce.number().int().positive(),
  geofenceId: z.coerce.number().int().positive(),
  eventType:  z.enum(['entered', 'exited']),
  latitude:   z.coerce.number(),
  longitude:  z.coerce.number(),
});

router.get('/',              async (_req, res, next) => { try { res.json(await geofencesService.findAll()); }                                          catch(e) { next(e); } });
router.get('/:id',           async (req,  res, next) => { try { res.json(await geofencesService.findById(+req.params.id)); }                           catch(e) { next(e); } });
router.get('/:id/events',    async (req,  res, next) => { try { res.json(await geofencesService.getEvents(+req.params.id, req.query.limit ? +req.query.limit : 100)); } catch(e) { next(e); } });
router.post('/',             async (req,  res, next) => { try { res.status(201).json(await geofencesService.create(createSchema.parse(req.body))); }    catch(e) { next(e); } });
router.put('/:id',           async (req,  res, next) => { try { res.json(await geofencesService.update(+req.params.id, createSchema.partial().parse(req.body))); } catch(e) { next(e); } });
router.delete('/:id',        async (req,  res, next) => { try { await geofencesService.remove(+req.params.id); res.json({ message: 'Geofence deleted' }); } catch(e) { next(e); } });
router.post('/events',       async (req,  res, next) => { try { res.status(201).json(await geofencesService.recordEvent(eventSchema.parse(req.body))); } catch(e) { next(e); } });

export default router;
