import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { auditService } from './audit.service';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { username, actionType, entityType, from, to, page, limit } = req.query as Record<string, string>;
    const result = await auditService.findAll({
      username,
      actionType,
      entityType,
      from,
      to,
      page:  page  ? Number(page)  : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
