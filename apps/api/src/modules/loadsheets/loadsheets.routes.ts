import { Router } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate';
import { auditService, getIp } from '../audit-trail/audit.service';
import { loadsheetsService } from './loadsheets.service';
import {
  createLoadSheetSchema,
  updateLoadSheetSchema,
  updateLoadSheetStatusSchema,
  addVehicleSchema,
  updateVehicleStatusSchema,
} from './loadsheets.schema';

/**
 * @swagger
 * tags:
 *   name: LoadSheets
 *   description: Automated Load Sheet Management
 */

const router = Router();
router.use(authenticate);

// ── Dashboard ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /load-sheets/dashboard:
 *   get:
 *     summary: Load sheet operational dashboard
 *     tags: [LoadSheets]
 */
router.get('/dashboard', async (_req, res, next) => {
  try {
    res.json(await loadsheetsService.getDashboard());
  } catch (e) { next(e); }
});

// ── List ───────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /load-sheets:
 *   get:
 *     summary: List load sheets
 *     tags: [LoadSheets]
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      status:   req.query.status   as string | undefined,
      driverId: req.query.driverId ? +req.query.driverId : undefined,
      truckId:  req.query.truckId  ? +req.query.truckId  : undefined,
      from:     req.query.from     as string | undefined,
      to:       req.query.to       as string | undefined,
      page:     req.query.page     ? +req.query.page     : undefined,
      limit:    req.query.limit    ? +req.query.limit    : undefined,
    };
    res.json(await loadsheetsService.findAll(filters));
  } catch (e) { next(e); }
});

// ── Get single ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /load-sheets/{id}:
 *   get:
 *     summary: Get load sheet detail
 *     tags: [LoadSheets]
 */
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await loadsheetsService.findById(+req.params.id));
  } catch (e) { next(e); }
});

// ── PDF ─────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /load-sheets/{id}/pdf:
 *   get:
 *     summary: Generate printable load sheet HTML/PDF
 *     tags: [LoadSheets]
 */
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const html = await loadsheetsService.generatePdfHtml(+req.params.id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) { next(e); }
});

// ── Create ─────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /load-sheets:
 *   post:
 *     summary: Create a new load sheet
 *     tags: [LoadSheets]
 */
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const ls = await loadsheetsService.create(createLoadSheetSchema.parse(req.body));
    res.status(201).json(ls);

    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'LOADSHEET_CREATED',
      entityType: 'LOADSHEET',
      entityId:   (ls as any).id,
      newValue:   ls,
    });
  } catch (e) { next(e); }
});

// ── Update header ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /load-sheets/{id}:
 *   put:
 *     summary: Update load sheet header (route, trailer, capacity, notes)
 *     tags: [LoadSheets]
 */
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id    = +req.params.id;
    const old   = await loadsheetsService.findById(id);
    const ls    = await loadsheetsService.update(id, updateLoadSheetSchema.parse(req.body));
    res.json(ls);

    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'LOADSHEET_UPDATED',
      entityType: 'LOADSHEET',
      entityId:   id,
      oldValue:   old,
      newValue:   ls,
    });
  } catch (e) { next(e); }
});

// ── Update status ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /load-sheets/{id}/status:
 *   patch:
 *     summary: Update load sheet status
 *     tags: [LoadSheets]
 */
router.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const id     = +req.params.id;
    const { status } = updateLoadSheetStatusSchema.parse(req.body);
    const old    = await loadsheetsService.findById(id);
    const ls     = await loadsheetsService.updateStatus(id, status);
    res.json(ls);

    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'LOADSHEET_STATUS_CHANGED',
      entityType: 'LOADSHEET',
      entityId:   id,
      oldValue:   { status: (old as any).status },
      newValue:   { status },
    });
  } catch (e) { next(e); }
});

// ── Delete load sheet ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /load-sheets/{id}:
 *   delete:
 *     summary: Delete a load sheet (must not be IN_TRANSIT)
 *     tags: [LoadSheets]
 */
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id  = +req.params.id;
    const old = await loadsheetsService.findById(id);
    await loadsheetsService.remove(id);
    res.json({ message: 'Load sheet deleted' });

    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'LOADSHEET_DELETED',
      entityType: 'LOADSHEET',
      entityId:   id,
      oldValue:   old,
    });
  } catch (e) { next(e); }
});

// ── Add vehicle ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /load-sheets/{id}/vehicles:
 *   post:
 *     summary: Add a vehicle (trip/booking) to a load sheet
 *     tags: [LoadSheets]
 */
router.post('/:id/vehicles', async (req: AuthRequest, res, next) => {
  try {
    const loadSheetId = +req.params.id;
    const lsv = await loadsheetsService.addVehicle(loadSheetId, addVehicleSchema.parse(req.body));
    res.status(201).json(lsv);

    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'LOADSHEET_VEHICLE_ADDED',
      entityType: 'LOADSHEET',
      entityId:   loadSheetId,
      newValue:   lsv,
    });
  } catch (e) { next(e); }
});

// ── Update vehicle status ────────────────────────────────────────────────────────

/**
 * @swagger
 * /load-sheets/{id}/vehicles/{vehicleId}/status:
 *   patch:
 *     summary: Update individual vehicle status (YET_TO_START | ONGOING | COMPLETED)
 *     tags: [LoadSheets]
 */
router.patch('/:id/vehicles/:vehicleId/status', async (req: AuthRequest, res, next) => {
  try {
    const loadSheetId = +req.params.id;
    const vehicleId   = +req.params.vehicleId;
    const input       = updateVehicleStatusSchema.parse(req.body);

    const updated = await loadsheetsService.updateVehicleStatus(
      vehicleId,
      input,
      req.user!.username,
    );
    res.json(updated);

    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'LOADSHEET_VEHICLE_STATUS_CHANGED',
      entityType: 'LOADSHEET',
      entityId:   loadSheetId,
      newValue:   { vehicleId, status: input.status },
    });
  } catch (e) { next(e); }
});

// ── Remove vehicle ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /load-sheets/{id}/vehicles/{vehicleId}:
 *   delete:
 *     summary: Remove a vehicle from a load sheet (only if YET_TO_START)
 *     tags: [LoadSheets]
 */
router.delete('/:id/vehicles/:vehicleId', async (req: AuthRequest, res, next) => {
  try {
    const loadSheetId = +req.params.id;
    const vehicleId   = +req.params.vehicleId;
    await loadsheetsService.removeVehicle(vehicleId);
    res.json({ message: 'Vehicle removed from load sheet' });

    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'LOADSHEET_VEHICLE_REMOVED',
      entityType: 'LOADSHEET',
      entityId:   loadSheetId,
      newValue:   { vehicleId },
    });
  } catch (e) { next(e); }
});

export default router;
