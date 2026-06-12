import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { inspectionsService } from './inspections.service';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

/**
 * @swagger
 * tags:
 *   name: Inspections
 *   description: Vehicle inspection checklists and images
 */

// Configure multer for inspection image uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'inspections');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  },
});

const createSchema = z.object({
  tripId:    z.coerce.number().int().positive(),
  driverId:  z.coerce.number().int().positive(),
  data:      z.any(),
  remarks:   z.string().optional(),
});

const router = Router();
router.use(authenticate);

// ── Categories ──────────────────────────────────────────────────────────────
router.get('/categories',             async (_req, res, next) => { try { res.json(await inspectionsService.getCategories()); }                                          catch(e) { next(e); } });
router.post('/categories',            async (req,  res, next) => { try { res.status(201).json(await inspectionsService.createCategory(req.body)); }                     catch(e) { next(e); } });
router.put('/categories/:id',         async (req,  res, next) => { try { res.json(await inspectionsService.updateCategory(+req.params.id, req.body)); }                 catch(e) { next(e); } });
router.delete('/categories/:id',      async (req,  res, next) => { try { await inspectionsService.deleteCategory(+req.params.id); res.json({ message: 'Deleted' }); }  catch(e) { next(e); } });

// ── Items ────────────────────────────────────────────────────────────────────
router.post('/categories/:id/items',  async (req,  res, next) => { try { res.status(201).json(await inspectionsService.createItem(+req.params.id, req.body)); }        catch(e) { next(e); } });
router.put('/items/:id',              async (req,  res, next) => { try { res.json(await inspectionsService.updateItem(+req.params.id, req.body)); }                     catch(e) { next(e); } });
router.delete('/items/:id',           async (req,  res, next) => { try { await inspectionsService.deleteItem(+req.params.id); res.json({ message: 'Deleted' }); }      catch(e) { next(e); } });

// ── Inspections ──────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      tripId:   req.query.tripId   ? +req.query.tripId   : undefined,
      driverId: req.query.driverId ? +req.query.driverId : undefined,
    };
    res.json(await inspectionsService.findAll(filters));
  } catch(e) { next(e); }
});
router.get('/:id',     async (req, res, next) => { try { res.json(await inspectionsService.findById(+req.params.id)); }                                               catch(e) { next(e); } });
router.post('/',       async (req, res, next) => { try { res.status(201).json(await inspectionsService.create(createSchema.parse(req.body))); }                        catch(e) { next(e); } });
router.put('/:id',     async (req, res, next) => { try { res.json(await inspectionsService.update(+req.params.id, req.body)); }                                        catch(e) { next(e); } });
router.delete('/:id',  async (req, res, next) => { try { await inspectionsService.remove(+req.params.id); res.json({ message: 'Inspection deleted' }); }              catch(e) { next(e); } });

// ── Images ───────────────────────────────────────────────────────────────────
router.get('/images', async (req, res, next) => {
  try {
    const filters = {
      tripId:       req.query.tripId       ? +req.query.tripId       : undefined,
      driverId:     req.query.driverId     ? +req.query.driverId     : undefined,
      inspectionId: req.query.inspectionId ? +req.query.inspectionId : undefined,
    };
    res.json(await inspectionsService.getImages(filters));
  } catch(e) { next(e); }
});

router.post('/images', upload.single('image'), async (req: any, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const body = z.object({
      tripId:       z.coerce.number().int().positive(),
      driverId:     z.coerce.number().int().positive(),
      inspectionId: z.coerce.number().int().positive().optional(),
    }).parse(req.body);

    const record = await inspectionsService.addImage({
      ...body,
      filename: req.file.filename,
      path:     `/uploads/inspections/${req.file.filename}`,
    });
    res.status(201).json(record);
  } catch(e) { next(e); }
});

router.delete('/images/:id', async (req, res, next) => {
  try {
    await inspectionsService.deleteImage(+req.params.id);
    res.json({ message: 'Image deleted' });
  } catch(e) { next(e); }
});

export default router;
