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

/**
 * @swagger
 * /dashboard/operations:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get operations analytics (active trips, fleet utilization, warehouse occupancy, driver performance)
 *     responses:
 *       200:
 *         description: Operations analytics data
 */
router.get('/operations', async (_req, res, next) => {
  try {
    const data = await dashboardService.getOperationsStats();
    res.json(data);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /dashboard/financial:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get financial analytics (revenue trends, expense trends, outstanding payments, monthly revenue)
 *     responses:
 *       200:
 *         description: Financial analytics data
 */
router.get('/financial', async (_req, res, next) => {
  try {
    const data = await dashboardService.getFinancialStats();
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
