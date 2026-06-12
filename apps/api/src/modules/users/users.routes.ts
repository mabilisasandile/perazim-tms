import { Router } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate';
import { usersService, createUserSchema, updateUserSchema } from './users.service';
import { z } from 'zod';

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Admin user management
 */
const router = Router();
router.use(authenticate);

router.get('/',       async (_req, res, next) => { try { res.json(await usersService.findAll()); }                                                             catch(e) { next(e); } });
router.get('/:id',    async (req,  res, next) => { try { res.json(await usersService.findById(+req.params.id)); }                                             catch(e) { next(e); } });
router.post('/',      async (req,  res, next) => { try { res.status(201).json(await usersService.create(createUserSchema.parse(req.body))); }                 catch(e) { next(e); } });
router.put('/:id',    async (req,  res, next) => { try { res.json(await usersService.update(+req.params.id, updateUserSchema.parse(req.body))); }             catch(e) { next(e); } });
router.delete('/:id', async (req,  res, next) => { try { await usersService.remove(+req.params.id); res.json({ message: 'User deleted' }); }                 catch(e) { next(e); } });

// Update permissions for a user
router.put('/:id/permissions', async (req, res, next) => {
  try {
    const permissions = z.record(z.boolean()).parse(req.body);
    res.json(await usersService.updatePermissions(+req.params.id, permissions));
  } catch(e) { next(e); }
});

// Change own password
router.put('/me/change-password', async (req: AuthRequest, res, next) => {
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
