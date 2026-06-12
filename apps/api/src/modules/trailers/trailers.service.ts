import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateTrailerDto, UpdateTrailerDto } from './trailers.schema';

export const trailersService = {
  async findAll() {
    return prisma.trailer.findMany({
      include: { _count: { select: { trips: true } } },
      orderBy: { registrationNo: 'asc' },
    });
  },
  async findById(id: number) {
    const t = await prisma.trailer.findUnique({ where: { id }, include: { trips: { take: 5, orderBy: { createdAt: 'desc' } } } });
    if (!t) throw new AppError('Trailer not found', 404);
    return t;
  },
  async create(data: CreateTrailerDto) {
    const { licenseExpiry, ...rest } = data;
    return prisma.trailer.create({ data: { ...rest, licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null } });
  },
  async update(id: number, data: UpdateTrailerDto) {
    await this.findById(id);
    const { licenseExpiry, ...rest } = data;
    return prisma.trailer.update({ where: { id }, data: { ...rest, ...(licenseExpiry !== undefined && { licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null }) } });
  },
  async remove(id: number) {
    const t = await prisma.trailer.findUnique({ where: { id }, include: { _count: { select: { trips: true } } } });
    if (!t) throw new AppError('Trailer not found', 404);
    if (t._count.trips > 0) throw new AppError('Cannot delete trailer with trips. Deactivate instead.', 409);
    return prisma.trailer.delete({ where: { id } });
  },
};
