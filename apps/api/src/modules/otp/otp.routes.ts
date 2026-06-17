import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../../middleware/authenticate';
import { otpService } from './otp.service';

const router = Router();
router.use(authenticate);

// Send OTP to customer email for a given trip
router.post('/send', async (req: AuthRequest, res, next) => {
  try {
    const { tripId } = z.object({ tripId: z.coerce.number().int().positive() }).parse(req.body);
    res.json(await otpService.send(tripId));
  } catch (e) { next(e); }
});

// Verify OTP code entered by driver
router.post('/verify', async (req: AuthRequest, res, next) => {
  try {
    const { tripId, code } = z.object({
      tripId: z.coerce.number().int().positive(),
      code: z.string().length(6, 'OTP must be exactly 6 digits'),
    }).parse(req.body);
    res.json(await otpService.verify(tripId, code));
  } catch (e) { next(e); }
});

// Admin bypass — allow completion without OTP (ADMIN / SUPER_ADMIN only)
router.post('/bypass', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const { tripId, reason } = z.object({
      tripId: z.coerce.number().int().positive(),
      reason: z.string().min(5, 'Bypass reason must be at least 5 characters'),
    }).parse(req.body);
    res.json(await otpService.bypass(tripId, req.user!.id, reason));
  } catch (e) { next(e); }
});

// Get current OTP status for a trip
router.get('/status/:tripId', async (req, res, next) => {
  try {
    res.json(await otpService.getStatus(+req.params.tripId));
  } catch (e) { next(e); }
});

export default router;
