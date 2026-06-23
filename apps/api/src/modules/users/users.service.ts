import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ROLE_KEYS, ROLE_PERMISSIONS, isValidRole } from '../../lib/roles';
import { notificationService } from '../notifications/notification.service';

const permissionsSchema = z.object({
  vehicleList:        z.boolean().optional(),
  vehicleView:        z.boolean().optional(),
  vehicleEdit:        z.boolean().optional(),
  vehicleAdd:         z.boolean().optional(),
  vehicleGroup:       z.boolean().optional(),
  vehicleGroupAdd:    z.boolean().optional(),
  vehicleGroupAction: z.boolean().optional(),
  driverList:         z.boolean().optional(),
  driverEdit:         z.boolean().optional(),
  driverAdd:          z.boolean().optional(),
  tripList:           z.boolean().optional(),
  tripEdit:           z.boolean().optional(),
  tripAdd:            z.boolean().optional(),
  customerList:       z.boolean().optional(),
  customerEdit:       z.boolean().optional(),
  customerAdd:        z.boolean().optional(),
  fuelList:           z.boolean().optional(),
  fuelEdit:           z.boolean().optional(),
  fuelAdd:            z.boolean().optional(),
  reminderList:       z.boolean().optional(),
  reminderDelete:     z.boolean().optional(),
  reminderAdd:        z.boolean().optional(),
  incomeExpenseList:  z.boolean().optional(),
  incomeExpenseEdit:  z.boolean().optional(),
});

export const createUserSchema = z.object({
  name:        z.string().min(1),
  email:       z.string().email(),
  username:    z.string().min(3),
  password:    z.string().min(8),
  role:        z.enum(ROLE_KEYS as [string, ...string[]]).default('ADMIN'),
  isActive:    z.boolean().default(true),
  permissions: permissionsSchema.optional(),
});

export const updateUserSchema = z.object({
  name:        z.string().min(1).optional(),
  email:       z.string().email().optional(),
  username:    z.string().min(3).optional(),
  password:    z.string().min(8).optional(),
  role:        z.enum(ROLE_KEYS as [string, ...string[]]).optional(),
  isActive:    z.boolean().optional(),
  permissions: permissionsSchema.optional(),
});

async function validatePassword(password: string): Promise<void> {
  const settings = await prisma.settings.findFirst();
  const minLen     = settings?.minPasswordLength  ?? 8;
  const needUpper  = settings?.requireUppercase   ?? false;
  const needNum    = settings?.requireNumbers     ?? false;
  const needSpec   = settings?.requireSpecialChars ?? false;

  const errors: string[] = [];
  if (password.length < minLen)                errors.push(`at least ${minLen} characters`);
  if (needUpper  && !/[A-Z]/.test(password))  errors.push('an uppercase letter');
  if (needNum    && !/[0-9]/.test(password))  errors.push('a number');
  if (needSpec   && !/[^A-Za-z0-9]/.test(password)) errors.push('a special character');

  if (errors.length > 0) {
    throw new AppError(`Password must contain ${errors.join(', ')}.`, 400);
  }
}

export const usersService = {
  async findAll() {
    return prisma.user.findMany({
      select: {
        id: true, name: true, email: true, username: true, role: true,
        isActive: true, createdAt: true, lastLoginAt: true,
        failedLoginCount: true, lockedUntil: true,
        permissions: true,
      },
      orderBy: { name: 'asc' },
    });
  },

  async findById(id: number) {
    const u = await prisma.user.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!u) throw new AppError('User not found', 404);
    const { password: _, ...safe } = u;
    return safe;
  },

  async create(data: z.infer<typeof createUserSchema>) {
    const { permissions, password, role, ...rest } = data;
    await validatePassword(password);
    const hashed = await bcrypt.hash(password, 12);

    // Default permissions come from the role; custom overrides on top
    const rolePerms = isValidRole(role) ? ROLE_PERMISSIONS[role] : {};
    const finalPerms = { ...rolePerms, ...(permissions ?? {}) };

    const user = await prisma.user.create({
      data: {
        ...rest,
        password: hashed,
        role,
        passwordChangedAt: new Date(),
        permissions: { create: finalPerms },
      },
      include: { permissions: true },
    });
    const { password: __, ...safe } = user;
    if (safe.email) {
      notificationService.sendWelcomeEmail(safe.email, safe.name, 'user', safe.role).catch(() => {});
    }
    return safe;
  },

  async update(id: number, data: z.infer<typeof updateUserSchema>) {
    await this.findById(id);
    const { permissions, password, role, ...rest } = data;

    const updateData: any = { ...rest };
    if (password) {
      await validatePassword(password);
      updateData.password = await bcrypt.hash(password, 12);
      updateData.passwordChangedAt = new Date();
    }
    if (role) updateData.role = role;

    // If role changed and no explicit permissions override, apply role defaults
    if (role && !permissions && isValidRole(role)) {
      await prisma.userPermissions.upsert({
        where:  { userId: id },
        update: ROLE_PERMISSIONS[role],
        create: { userId: id, ...ROLE_PERMISSIONS[role] },
      });
    }

    if (permissions) {
      await prisma.userPermissions.upsert({
        where:  { userId: id },
        update: permissions,
        create: { userId: id, ...permissions },
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { permissions: true },
    });
    const { password: _, ...safe } = updated;
    return safe;
  },

  async assignRole(id: number, role: string) {
    if (!isValidRole(role)) throw new AppError('Invalid role', 400);
    await this.findById(id);
    const perms = ROLE_PERMISSIONS[role];
    await prisma.userPermissions.upsert({
      where:  { userId: id },
      update: perms,
      create: { userId: id, ...perms },
    });
    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      include: { permissions: true },
    });
    const { password: _, ...safe } = updated;
    return safe;
  },

  async updatePermissions(id: number, permissions: Record<string, boolean>) {
    await this.findById(id);
    return prisma.userPermissions.upsert({
      where:  { userId: id },
      update: permissions,
      create: { userId: id, ...permissions },
    });
  },

  async unlock(id: number) {
    await this.findById(id);
    return prisma.user.update({
      where: { id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  },

  async remove(id: number) {
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) throw new AppError('User not found', 404);
    return prisma.user.delete({ where: { id } });
  },

  async changePassword(id: number, currentPassword: string, newPassword: string) {
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) throw new AppError('User not found', 404);
    const valid = await bcrypt.compare(currentPassword, u.password);
    if (!valid) throw new AppError('Current password is incorrect', 400);
    await validatePassword(newPassword);
    const hashed = await bcrypt.hash(newPassword, 12);
    return prisma.user.update({ where: { id }, data: { password: hashed, passwordChangedAt: new Date() } });
  },
};
