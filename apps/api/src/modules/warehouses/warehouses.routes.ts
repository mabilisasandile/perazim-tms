import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { warehousesService } from './warehouses.service';
import {
  createWarehouseSchema, updateWarehouseSchema,
  allocateVehicleSchema, updateVehicleStatusSchema, transferVehicleSchema,
} from './warehouses.schema';

const router = Router();
router.use(authenticate);

// Dashboard
router.get('/dashboard', async (_req, res, next) => {
  try { res.json(await warehousesService.getDashboard()); } catch (e) { next(e); }
});

// All vehicles across all warehouses
router.get('/vehicles', async (req, res, next) => {
  try {
    const { warehouseId, status } = req.query;
    res.json(await warehousesService.findAllVehicles({
      warehouseId: warehouseId ? Number(warehouseId) : undefined,
      status:      status as string | undefined,
    }));
  } catch (e) { next(e); }
});

// Vehicle status update
router.patch('/vehicles/:id/status', async (req, res, next) => {
  try {
    const data = updateVehicleStatusSchema.parse(req.body);
    res.json(await warehousesService.updateVehicleStatus(Number(req.params.id), data));
  } catch (e) { next(e); }
});

// Vehicle transfer
router.post('/vehicles/:id/transfer', async (req, res, next) => {
  try {
    const data = transferVehicleSchema.parse(req.body);
    res.json(await warehousesService.transfer(Number(req.params.id), data));
  } catch (e) { next(e); }
});

// Warehouse CRUD
router.get('/',    async (_req, res, next) => { try { res.json(await warehousesService.findAll());                } catch (e) { next(e); } });
router.get('/:id', async (req,  res, next) => { try { res.json(await warehousesService.findById(+req.params.id)); } catch (e) { next(e); } });
router.post('/',   async (req,  res, next) => {
  try { res.status(201).json(await warehousesService.create(createWarehouseSchema.parse(req.body))); } catch (e) { next(e); }
});
router.put('/:id', async (req, res, next) => {
  try { res.json(await warehousesService.update(+req.params.id, updateWarehouseSchema.parse(req.body))); } catch (e) { next(e); }
});
router.delete('/:id', async (req, res, next) => {
  try { await warehousesService.remove(+req.params.id); res.json({ message: 'Warehouse deleted' }); } catch (e) { next(e); }
});

// Allocate a trip vehicle to a warehouse
router.post('/:id/allocate', async (req, res, next) => {
  try {
    const data = allocateVehicleSchema.parse(req.body);
    res.status(201).json(await warehousesService.allocate(+req.params.id, data));
  } catch (e) { next(e); }
});

export default router;
