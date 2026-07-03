import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { timesheetsService } from './timesheets.service';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try { res.json(await timesheetsService.findAll()); } catch (e) { next(e); }
});

export default router;
