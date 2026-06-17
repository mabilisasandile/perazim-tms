import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { payrollService } from './payroll.service';

const router = Router();
const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.use(authenticate);

// ─── Settings ─────────────────────────────────────────────────────────────────

router.get('/settings', wrap(async (_req, res) => {
  res.json(await payrollService.getSettings());
}));

router.put('/settings', wrap(async (req, res) => {
  res.json(await payrollService.updateSettings(req.body));
}));

// ─── Driver Configs ───────────────────────────────────────────────────────────

router.get('/driver-configs', wrap(async (_req, res) => {
  res.json(await payrollService.allDriverConfigs());
}));

router.get('/driver-configs/:driverId', wrap(async (req, res) => {
  res.json(await payrollService.getDriverConfig(Number(req.params.driverId)));
}));

router.put('/driver-configs/:driverId', wrap(async (req, res) => {
  res.json(await payrollService.upsertDriverConfig(Number(req.params.driverId), req.body));
}));

// ─── Generate Entry ───────────────────────────────────────────────────────────

router.post('/generate', wrap(async (req, res) => {
  const { driverId, periodType, periodStart } = req.body;
  if (!driverId || !periodType || !periodStart) {
    return res.status(400).json({ message: 'driverId, periodType and periodStart are required' });
  }
  const entry = await payrollService.generateEntry(Number(driverId), periodType, periodStart);
  return res.status(201).json(entry);
}));

// ─── Entries ──────────────────────────────────────────────────────────────────

router.get('/', wrap(async (req, res) => {
  const { driverId, periodType, status, from, to } = req.query as Record<string, string>;
  res.json(await payrollService.listEntries({
    driverId:   driverId   ? Number(driverId)  : undefined,
    periodType: periodType || undefined,
    status:     status     || undefined,
    from:       from       || undefined,
    to:         to         || undefined,
  }));
}));

router.get('/:id', wrap(async (req, res) => {
  res.json(await payrollService.getEntry(Number(req.params.id)));
}));

router.patch('/:id/manuals', wrap(async (req, res) => {
  res.json(await payrollService.updateManuals(Number(req.params.id), req.body));
}));

router.patch('/:id/status', wrap(async (req, res) => {
  const { status, approvedBy, paymentMethod, paymentRef } = req.body;
  res.json(await payrollService.updateStatus(Number(req.params.id), status, { approvedBy, paymentMethod, paymentRef }));
}));

router.delete('/:id', wrap(async (req, res) => {
  await payrollService.deleteEntry(Number(req.params.id));
  res.json({ message: 'Entry deleted' });
}));

// ─── Reports ──────────────────────────────────────────────────────────────────

router.get('/reports/performance', wrap(async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  if (!from || !to) return res.status(400).json({ message: 'from and to are required' });
  res.json(await payrollService.getPerformanceReport(from, to));
}));

router.get('/reports/payroll', wrap(async (req, res) => {
  const { periodType, periodStart } = req.query as Record<string, string>;
  if (!periodType || !periodStart) return res.status(400).json({ message: 'periodType and periodStart are required' });
  res.json(await payrollService.getPayrollReport(periodType, periodStart));
}));

export default router;
