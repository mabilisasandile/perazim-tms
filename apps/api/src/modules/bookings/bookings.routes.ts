import { Router } from 'express';
import { bookingsController } from './bookings.controller';
import { authenticate, requirePermission } from '../../middleware/authenticate';

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Multi-vehicle bookings (a Booking groups one or more vehicle Trips under a single booking number)
 */
const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: List all bookings
 *     parameters:
 *       - in: query
 *         name: customerId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Array of bookings, each with its trips (one per vehicle) and invoices
 */
router.get('/',    requirePermission('tripList'), bookingsController.list);
router.get('/:id', requirePermission('tripList'), bookingsController.get);

/**
 * @swagger
 * /bookings:
 *   post:
 *     tags: [Bookings]
 *     summary: Create a booking with one or more vehicles under a single booking number
 */
router.post('/', requirePermission('tripAdd'), bookingsController.create);

router.patch('/:id/status', requirePermission('tripEdit'), bookingsController.updateStatus);
router.delete('/:id', requirePermission('tripEdit'), bookingsController.remove);

export default router;
