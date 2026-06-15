import { Router } from 'express';
import { authenticate, AuthRequest, requireRole } from '../../middleware/authenticate';
import { usersService, createUserSchema, updateUserSchema } from './users.service';
import { z } from 'zod';
import { ROLES, ROLE_KEYS, ROLE_PERMISSIONS } from '../../lib/roles';
import { auditService, getIp } from '../audit-trail/audit.service';

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Admin user management
 */
const router = Router();
router.use(authenticate);

// List available roles with their default permissions
router.get('/roles', (_req, res) => {
  res.json(
    ROLE_KEYS.map(key => ({
      key,
      label: ROLES[key],
      permissions: ROLE_PERMISSIONS[key],
    }))
  );
});

router.get('/',    async (_req, res, next) => { try { res.json(await usersService.findAll()); }           catch(e) { next(e); } });
router.get('/:id', async (req,  res, next) => { try { res.json(await usersService.findById(+req.params.id)); } catch(e) { next(e); } });

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const user = await usersService.create(createUserSchema.parse(req.body));
    res.status(201).json(user);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'USER_CREATED',
      entityType: 'USER',
      entityId:   (user as any)?.id,
      newValue:   user,
    });
  } catch(e) { next(e); }
});

router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const oldUser = await usersService.findById(id);
    const user = await usersService.update(id, updateUserSchema.parse(req.body));
    res.json(user);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'USER_UPDATED',
      entityType: 'USER',
      entityId:   id,
      oldValue:   oldUser,
      newValue:   user,
    });
  } catch(e) { next(e); }
});

router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const oldUser = await usersService.findById(id);
    await usersService.remove(id);
    res.json({ message: 'User deleted' });
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'USER_DELETED',
      entityType: 'USER',
      entityId:   id,
      oldValue:   oldUser,
    });
  } catch(e) { next(e); }
});

// Assign role (auto-applies default permissions)
router.put('/:id/role', requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const { role } = z.object({ role: z.enum(ROLE_KEYS as [string, ...string[]]) }).parse(req.body);
    const oldUser = await usersService.findById(id);
    const user = await usersService.assignRole(id, role);
    res.json(user);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'USER_ROLE_ASSIGNED',
      entityType: 'USER',
      entityId:   id,
      oldValue:   { role: (oldUser as any).role },
      newValue:   { role },
    });
  } catch(e) { next(e); }
});

// Fine-tune individual permissions
router.put('/:id/permissions', requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const permissions = z.record(z.boolean()).parse(req.body);
    const result = await usersService.updatePermissions(id, permissions);
    res.json(result);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'USER_PERMISSIONS_UPDATED',
      entityType: 'USER',
      entityId:   id,
      newValue:   permissions,
    });
  } catch(e) { next(e); }
});

// Unlock a locked account
router.post('/:id/unlock', requireRole('SUPER_ADMIN', 'ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    await usersService.unlock(id);
    res.json({ message: 'Account unlocked' });
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'USER_UNLOCKED',
      entityType: 'USER',
      entityId:   id,
    });
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
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'USER_PASSWORD_CHANGED',
      entityType: 'USER',
      entityId:   req.user!.id,
    });
  } catch(e) { next(e); }
});

export default router;
