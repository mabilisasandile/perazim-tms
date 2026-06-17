import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { notificationService } from './notification.service';

const router = Router();
const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.use(authenticate);

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get('/stats', wrap(async (_req, res) => {
  res.json(await notificationService.getStats());
}));

// ─── Notification Log ─────────────────────────────────────────────────────────

router.get('/', wrap(async (req, res) => {
  const { type, channel, status, from, to, limit } = req.query as Record<string, string>;
  res.json(await notificationService.listNotifications({
    type:    type    || undefined,
    channel: channel || undefined,
    status:  status  || undefined,
    from:    from    || undefined,
    to:      to      || undefined,
    limit:   limit   ? Number(limit) : undefined,
  }));
}));

// ─── Per-Type Channel Settings ────────────────────────────────────────────────

router.get('/settings', wrap(async (_req, res) => {
  res.json(await notificationService.getSettings());
}));

router.put('/settings/:type', wrap(async (req, res) => {
  const { emailEnabled, smsEnabled, whatsappEnabled } = req.body;
  res.json(await notificationService.updateSetting(req.params.type, {
    emailEnabled, smsEnabled, whatsappEnabled,
  }));
}));

// ─── Twilio Config ────────────────────────────────────────────────────────────

router.get('/twilio', wrap(async (_req, res) => {
  res.json(await notificationService.getTwilioConfig());
}));

router.put('/twilio', wrap(async (req, res) => {
  res.json(await notificationService.updateTwilioConfig(req.body));
}));

router.post('/twilio/test', wrap(async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: 'phone is required' });
  res.json(await notificationService.testTwilio(phone));
}));

// ─── WhatsApp Config ──────────────────────────────────────────────────────────

router.get('/whatsapp', wrap(async (_req, res) => {
  res.json(await notificationService.getWhatsAppConfig());
}));

router.put('/whatsapp', wrap(async (req, res) => {
  res.json(await notificationService.updateWhatsAppConfig(req.body));
}));

router.post('/whatsapp/test', wrap(async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: 'phone is required' });
  res.json(await notificationService.testWhatsApp(phone));
}));

export default router;
