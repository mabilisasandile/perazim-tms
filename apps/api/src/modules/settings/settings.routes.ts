import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authenticate';
import { settingsService } from './settings.service';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.get('/',           async (_req, res, next) => { try { res.json(await settingsService.get()); }          catch(e) { next(e); } });
router.put('/',           async (req,  res, next) => { try { res.json(await settingsService.update(req.body)); } catch(e) { next(e); } });
router.get('/smtp',       async (_req, res, next) => { try { res.json(await settingsService.getSmtp()); }       catch(e) { next(e); } });
router.put('/smtp',       async (req,  res, next) => { try { res.json(await settingsService.updateSmtp(req.body)); } catch(e) { next(e); } });
router.post('/smtp/test', async (_req, res, next) => { try { res.json(await settingsService.testSmtp()); }     catch(e) { next(e); } });

// Security policy — only admins may modify
router.get('/security',  async (_req, res, next) => { try { res.json(await settingsService.getSecurityPolicy()); } catch(e) { next(e); } });

const securitySchema = z.object({
  minPasswordLength:     z.coerce.number().int().min(6).max(64).optional(),
  requireUppercase:      z.boolean().optional(),
  requireNumbers:        z.boolean().optional(),
  requireSpecialChars:   z.boolean().optional(),
  sessionTimeoutMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  maxLoginAttempts:      z.coerce.number().int().min(1).max(20).optional(),
  lockoutMinutes:        z.coerce.number().int().min(1).max(1440).optional(),
});

router.put('/security', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = securitySchema.parse(req.body);
    res.json(await settingsService.updateSecurityPolicy(data));
  } catch(e) { next(e); }
});

export default router;
