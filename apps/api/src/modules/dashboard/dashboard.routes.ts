import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { dashboardService } from './dashboard.service';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /dashboard:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get dashboard statistics
 *     responses:
 *       200:
 *         description: Dashboard stats, chart data, vehicle statuses
 */
router.get('/', async (_req, res, next) => {
  try {
    const data = await dashboardService.getStats();
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
