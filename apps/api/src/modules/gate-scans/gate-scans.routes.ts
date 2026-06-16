import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { gateScansService } from './gate-scans.service';
import { createGateScanSchema } from './gate-scans.schema';
import { auditService, getIp } from '../audit-trail/audit.service';
import { AuthRequest } from '../../middleware/authenticate';

const router = Router();
router.use(authenticate);

router.get('/stats',        async (_req, res, next) => {
  try { res.json(await gateScansService.getStats());       } catch (e) { next(e); }
});

router.get('/on-premises',  async (_req, res, next) => {
  try { res.json(await gateScansService.getOnPremises());  } catch (e) { next(e); }
});

router.get('/by-code/:code', async (req, res, next) => {
  try { res.json(await gateScansService.findByTrackingCode(req.params.code)); } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    const { scanType, gateName, from, to } = req.query;
    res.json(await gateScansService.findAll({
      scanType: scanType as string | undefined,
      gateName: gateName as string | undefined,
      from:     from     as string | undefined,
      to:       to       as string | undefined,
    }));
  } catch (e) { next(e); }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createGateScanSchema.parse(req.body);
    const scan = await gateScansService.create(data);
    res.status(201).json(scan);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: `GATE_${data.scanType}`,
      entityType: 'GATE_SCAN',
      entityId:   scan.id,
      newValue:   scan,
    });
  } catch (e) { next(e); }
});

export default router;
