import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { tripsController } from './trips.controller';
import { authenticate, requirePermission } from '../../middleware/authenticate';

const uploadDir = path.join(process.cwd(), 'uploads', 'trips');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    if (ok) cb(null, true); else cb(new Error('Only image files are allowed') as any, false);
  },
});

const pictureFields = Array.from({ length: 8 }, (_, i) => ({ name: `picture${i + 1}`, maxCount: 1 }));

/**
 * @swagger
 * tags:
 *   name: Trips
 *   description: Trip management
 */
const router = Router();

// Public — no auth required (QR code scans)
router.get('/track/:code', tripsController.tracking);

router.use(authenticate);

/**
 * @swagger
 * /trips:
 *   get:
 *     tags: [Trips]
 *     summary: List all trips
 *     parameters:
 *       - in: query
 *         name: vehicleId
 *         schema: { type: integer }
 *       - in: query
 *         name: driverId
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, IN_PROGRESS, COMPLETED, CANCELLED] }
 *     responses:
 *       200:
 *         description: Array of trips
 */
router.get('/', requirePermission('tripList'), tripsController.list);
router.get('/:id', requirePermission('tripList'), tripsController.get);
router.post('/', requirePermission('tripAdd'), tripsController.create);
router.post('/:id/pictures', requirePermission('tripEdit'), upload.fields(pictureFields), tripsController.uploadPictures);
router.put('/:id', requirePermission('tripEdit'), tripsController.update);
router.patch('/:id/status', requirePermission('tripEdit'), tripsController.updateStatus);
router.delete('/:id', requirePermission('tripEdit'), tripsController.remove);

export default router;
