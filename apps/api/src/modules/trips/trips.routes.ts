import { Router } from 'express';
import { tripsController } from './trips.controller';
import { authenticate } from '../../middleware/authenticate';

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
router.get('/', tripsController.list);
router.get('/:id', tripsController.get);
router.post('/', tripsController.create);
router.put('/:id', tripsController.update);
router.patch('/:id/status', tripsController.updateStatus);
router.delete('/:id', tripsController.remove);

export default router;
