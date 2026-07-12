import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/authenticate';
import { vehiclesService } from './vehicles.service';
import { createVehicleSchema, updateVehicleSchema } from './vehicles.schema';

/**
 * @swagger
 * tags:
 *   name: Vehicles
 *   description: Fleet vehicle management
 */
const router = Router();
router.use(authenticate);

router.get('/',          requirePermission('vehicleList'),        async (_req, res, next) => { try { res.json(await vehiclesService.findAll());               } catch(e) { next(e); } });
router.get('/groups',    requirePermission('vehicleGroup'),       async (_req, res, next) => { try { res.json(await vehiclesService.getGroups());             } catch(e) { next(e); } });
router.get('/:id',       requirePermission('vehicleView'),        async (req,  res, next) => { try { res.json(await vehiclesService.findById(+req.params.id)); } catch(e) { next(e); } });
router.post('/',         requirePermission('vehicleAdd'),         async (req,  res, next) => { try { res.status(201).json(await vehiclesService.create(createVehicleSchema.parse(req.body))); } catch(e) { next(e); } });
router.put('/:id',       requirePermission('vehicleEdit'),        async (req,  res, next) => { try { res.json(await vehiclesService.update(+req.params.id, updateVehicleSchema.parse(req.body))); } catch(e) { next(e); } });
router.delete('/:id',    requirePermission('vehicleEdit'),        async (req,  res, next) => { try { await vehiclesService.remove(+req.params.id); res.json({ message: 'Vehicle deleted' }); } catch(e) { next(e); } });
router.post('/groups',   requirePermission('vehicleGroupAdd'),    async (req,  res, next) => { try { res.status(201).json(await vehiclesService.createGroup(req.body.name)); } catch(e) { next(e); } });
router.delete('/groups/:id', requirePermission('vehicleGroupAction'), async (req, res, next) => { try { await vehiclesService.deleteGroup(+req.params.id); res.json({ message: 'Group deleted' }); } catch(e) { next(e); } });

export default router;
