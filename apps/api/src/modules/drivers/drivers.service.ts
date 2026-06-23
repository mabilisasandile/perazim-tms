import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateDriverDto, UpdateDriverDto } from './drivers.schema';
import bcrypt from 'bcryptjs';
import { notificationService } from '../notifications/notification.service';

export const driversService = {
  async findAll() {
    return prisma.driver.findMany({
      include: {
        assignedVehicle: { select: { id: true, name: true, registrationNo: true } },
        assignedTrailer: { select: { id: true, registrationNo: true } },
        _count: { select: { trips: true } },
      },
      orderBy: { name: 'asc' },
    });
  },

  async findById(id: number) {
    const d = await prisma.driver.findUnique({
      where: { id },
      include: {
        assignedVehicle: true,
        assignedTrailer: true,
        trips: { take: 10, orderBy: { createdAt: 'desc' }, include: { vehicle: { select: { name: true } } } },
        _count: { select: { trips: true } },
      },
    });
    if (!d) throw new AppError('Driver not found', 404);
    return d;
  },

  async create(data: CreateDriverDto) {
    const { licenseExpiry, dateOfJoining, pdpExpiry, ...rest } = data;
    const driver = await prisma.driver.create({
      data: {
        ...rest,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
        dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
        pdpExpiry:     pdpExpiry     ? new Date(pdpExpiry)     : null,
      },
    });
    if (driver.email) {
      notificationService.sendWelcomeEmail(driver.email, driver.name, 'driver').catch(() => {});
    }
    return driver;
  },

  async update(id: number, data: UpdateDriverDto) {
    await this.findById(id);
    const { licenseExpiry, dateOfJoining, pdpExpiry, ...rest } = data;
    return prisma.driver.update({
      where: { id },
      data: {
        ...rest,
        ...(licenseExpiry !== undefined && { licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null }),
        ...(dateOfJoining !== undefined && { dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null }),
        ...(pdpExpiry     !== undefined && { pdpExpiry:     pdpExpiry     ? new Date(pdpExpiry)     : null }),
      },
    });
  },

  async remove(id: number) {
    const d = await prisma.driver.findUnique({ where: { id }, include: { _count: { select: { trips: true } } } });
    if (!d) throw new AppError('Driver not found', 404);
    if (d._count.trips > 0) throw new AppError('Cannot delete driver with existing trips. Deactivate instead.', 409);
    return prisma.driver.delete({ where: { id } });
  },

  async setPortalPassword(id: number, password: string) {
    const hashed = await bcrypt.hash(password, 12);
    return prisma.driver.update({ where: { id }, data: { password: hashed } });
  },
};
