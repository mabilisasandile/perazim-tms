import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../../middleware/authenticate';
import { collectionsService } from './collections.service';

// ── Multer setup ───────────────────────────────────────────────────────────────

const uploadDir = path.join(process.cwd(), 'uploads', 'collections');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname) || '.jpg'}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase()) &&
               /jpeg|jpg|png|webp|octet-stream/.test(file.mimetype);
    if (ok) cb(null, true); else cb(new Error('Only image files are allowed') as any, false);
  },
});

// ── Validation schema ──────────────────────────────────────────────────────────

const createSchema = z.object({
  tripId:              z.coerce.number().int().positive(),
  collectorFirstName:  z.string().min(1),
  collectorLastName:   z.string().min(1),
  collectorPhone:      z.string().min(1),
  collectorEmail:      z.string().email().optional().or(z.literal('')),
  relationshipToOwner: z.string().optional(),
  idType:              z.string().min(1),
  idNumber:            z.string().min(1),
  signature:           z.string().min(1),
  gpsLatitude:         z.coerce.number().optional(),
  gpsLongitude:        z.coerce.number().optional(),
  gpsAccuracy:         z.coerce.number().optional(),
  collectedAt:         z.coerce.date().optional(),
  notes:               z.string().optional(),
});

// ── Routes ─────────────────────────────────────────────────────────────────────

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try { res.json(await collectionsService.findAll()); } catch (e) { next(e); }
});

router.get('/trip/:tripId', async (req, res, next) => {
  try {
    const rec = await collectionsService.findByTripId(+req.params.tripId);
    if (!rec) return res.status(404).json({ error: 'No collection record for this trip' });
    res.json(rec);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await collectionsService.findById(+req.params.id)); } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    if (data.collectorEmail === '') data.collectorEmail = undefined;
    res.status(201).json(await collectionsService.create(data));
  } catch (e) { next(e); }
});

// Upload ID document photo
router.post('/:id/id-photo', upload.single('idPhoto'), async (req: any, res, next) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'No image uploaded' });
    const updated = await collectionsService.setIdPhoto(
      +req.params.id,
      `/uploads/collections/${file.filename}`,
    );
    res.json(updated);
  } catch (e) { next(e); }
});

// Upload selfie photo
router.post('/:id/selfie', upload.single('selfie'), async (req: any, res, next) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'No image uploaded' });
    const updated = await collectionsService.setSelfie(
      +req.params.id,
      `/uploads/collections/${file.filename}`,
    );
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await collectionsService.remove(+req.params.id);
    res.json({ message: 'Collection record deleted' });
  } catch (e) { next(e); }
});

export default router;
