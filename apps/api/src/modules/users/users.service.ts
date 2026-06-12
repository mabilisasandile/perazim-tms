import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

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
  password:    z.string().min(6),
  isActive:    z.boolean().default(true),
  permissions: permissionsSchema.optional(),
});

export const updateUserSchema = z.object({
  name:        z.string().min(1).optional(),
  email:       z.string().email().optional(),
  username:    z.string().min(3).optional(),
  password:    z.string().min(6).optional(),
  isActive:    z.boolean().optional(),
  permissions: permissionsSchema.optional(),
});

export const usersService = {
  async findAll() {
    return prisma.user.findMany({
      select: {
        id: true, name: true, email: true, username: true,
        isActive: true, createdAt: true,
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
    const { permissions, password, ...rest } = data;
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        ...rest,
        password: hashed,
        permissions: permissions ? { create: permissions } : undefined,
      },
      include: { permissions: true },
    });
    const { password: _, ...safe } = user;
    return safe;
  },

  async update(id: number, data: z.infer<typeof updateUserSchema>) {
    await this.findById(id);
    const { permissions, password, ...rest } = data;

    const updateData: any = { ...rest };
    if (password) updateData.password = await bcrypt.hash(password, 12);

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

  async updatePermissions(id: number, permissions: Record<string, boolean>) {
    await this.findById(id);
    return prisma.userPermissions.upsert({
      where:  { userId: id },
      update: permissions,
      create: { userId: id, ...permissions },
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
    const hashed = await bcrypt.hash(newPassword, 12);
    return prisma.user.update({ where: { id }, data: { password: hashed } });
  },
};
