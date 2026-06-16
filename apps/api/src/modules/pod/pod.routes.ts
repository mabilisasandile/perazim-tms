import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../../middleware/authenticate';
import { podService } from './pod.service';

// ── Multer setup ─────────────────────────────────────────────────────────────

const uploadDir = path.join(process.cwd(), 'uploads', 'pod');
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
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase()) &&
               /jpeg|jpg|png|webp/.test(file.mimetype);
    if (ok) cb(null, true); else cb(new Error('Only image files are allowed') as any, false);
  },
});

// ── Schema ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  tripId:               z.coerce.number().int().positive(),
  receiverFirstName:    z.string().min(1),
  receiverLastName:     z.string().min(1),
  receiverPhone:        z.string().min(1),
  receiverEmail:        z.string().email().optional().or(z.literal('')),
  receiverIdNumber:     z.string().optional(),
  relationshipToOwner:  z.string().optional(),
  signature:            z.string().min(1),
  gpsLatitude:          z.coerce.number().optional(),
  gpsLongitude:         z.coerce.number().optional(),
  gpsAccuracy:          z.coerce.number().optional(),
  deliveredAt:          z.coerce.date().optional(),
  notes:                z.string().optional(),
});

// ── Routes ───────────────────────────────────────────────────────────────────

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try { res.json(await podService.findAll()); } catch (e) { next(e); }
});

router.get('/trip/:tripId', async (req, res, next) => {
  try {
    const pod = await podService.findByTripId(+req.params.tripId);
    if (!pod) return res.status(404).json({ error: 'No POD for this trip' });
    res.json(pod);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await podService.findById(+req.params.id)); } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    // Convert empty email string to undefined
    if (data.receiverEmail === '') data.receiverEmail = undefined;
    res.status(201).json(await podService.create(data));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await podService.remove(+req.params.id);
    res.json({ message: 'Proof of delivery deleted' });
  } catch (e) { next(e); }
});

// ── Photos ───────────────────────────────────────────────────────────────────

router.post('/:id/photos', upload.array('photos', 10), async (req: any, res, next) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) return res.status(400).json({ error: 'No images uploaded' });
    const podId = +req.params.id;
    const saved = await Promise.all(
      files.map(f => podService.addPhoto(podId, f.filename, `/uploads/pod/${f.filename}`))
    );
    res.status(201).json(saved);
  } catch (e) { next(e); }
});

router.delete('/photos/:id', async (req, res, next) => {
  try {
    await podService.deletePhoto(+req.params.id);
    res.json({ message: 'Photo deleted' });
  } catch (e) { next(e); }
});

export default router;
