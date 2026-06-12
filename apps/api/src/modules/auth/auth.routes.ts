import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate, AuthRequest } from '../../middleware/authenticate';
import { authLimiter } from '../../middleware/rateLimiter';
import { usersService } from '../users/users.service';
import { z } from 'zod';

const router = Router();

router.post('/login',   authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout',  authController.logout);
router.get('/me',       authenticate, authController.me);

router.put('/change-password', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword:     z.string().min(8),
    }).parse(req.body);
    await usersService.changePassword(req.user!.id, currentPassword, newPassword);
    res.json({ message: 'Password updated' });
  } catch(e) { next(e); }
});

export default router;

// Change own password (authenticated)
import { z } from 'zod';
router.put('/change-password', authenticate, async (req: any, res, next) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword:     z.string().min(8),
    }).parse(req.body);
    const { usersService } = await import('../users/users.service');
    await usersService.changePassword(req.user!.id, currentPassword, newPassword);
    res.json({ message: 'Password updated' });
  } catch(e) { next(e); }
});
