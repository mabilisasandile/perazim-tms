import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

export const inspectionsService = {
  async getCategories() {
    return prisma.inspectionCategory.findMany({
      where: { isActive: true },
      include: { items: { where: { isActive: true }, orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });
  },

  async createCategory(data: { name: string; order?: number }) {
    return prisma.inspectionCategory.create({ data, include: { items: true } });
  },

  async updateCategory(id: number, data: { name?: string; isActive?: boolean; order?: number }) {
    return prisma.inspectionCategory.update({ where: { id }, data, include: { items: true } });
  },

  async deleteCategory(id: number) {
    const cat = await prisma.inspectionCategory.findUnique({ where: { id }, include: { _count: { select: { items: true } } } });
    if (!cat) throw new AppError('Category not found', 404);
    return prisma.inspectionCategory.delete({ where: { id } });
  },

  async createItem(categoryId: number, data: { name: string; order?: number }) {
    // Verify category exists
    const cat = await prisma.inspectionCategory.findUnique({ where: { id: categoryId } });
    if (!cat) throw new AppError('Category not found', 404);
    return prisma.inspectionItem.create({ data: { ...data, categoryId } });
  },

  async updateItem(id: number, data: { name?: string; isActive?: boolean; order?: number }) {
    return prisma.inspectionItem.update({ where: { id }, data });
  },

  async deleteItem(id: number) {
    const item = await prisma.inspectionItem.findUnique({ where: { id } });
    if (!item) throw new AppError('Item not found', 404);
    return prisma.inspectionItem.delete({ where: { id } });
  },

  async findAll(filters: { tripId?: number; driverId?: number }) {
    return prisma.inspection.findMany({
      where: {
        ...(filters.tripId   ? { tripId:   filters.tripId   } : {}),
        ...(filters.driverId ? { driverId: filters.driverId } : {}),
      },
      include: {
        driver: { select: { id: true, name: true } },
        trip:   { select: { id: true, trackingCode: true, fromLocation: true, toLocation: true } },
        images: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: number) {
    const insp = await prisma.inspection.findUnique({
      where: { id },
      include: {
        driver: true,
        trip:   true,
        images: true,
      },
    });
    if (!insp) throw new AppError('Inspection not found', 404);
    return insp;
  },

  async create(data: { tripId: number; driverId: number; data: any; remarks?: string }) {
    return prisma.inspection.create({
      data,
      include: { driver: { select: { name: true } }, images: true },
    });
  },

  async update(id: number, data: { data?: any; remarks?: string }) {
    await this.findById(id);
    return prisma.inspection.update({ where: { id }, data, include: { images: true } });
  },

  async remove(id: number) {
    await this.findById(id);
    return prisma.inspection.delete({ where: { id } });
  },

  async addImage(data: { tripId: number; driverId: number; inspectionId?: number; filename: string; path: string }) {
    return prisma.inspectionImage.create({ data });
  },

  async getImages(filters: { tripId?: number; driverId?: number; inspectionId?: number }) {
    return prisma.inspectionImage.findMany({
      where: {
        ...(filters.tripId      ? { tripId:      filters.tripId      } : {}),
        ...(filters.driverId    ? { driverId:    filters.driverId    } : {}),
        ...(filters.inspectionId ? { inspectionId: filters.inspectionId } : {}),
      },
      include: {
        driver: { select: { name: true } },
        trip:   { select: { trackingCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async deleteImage(id: number) {
    const img = await prisma.inspectionImage.findUnique({ where: { id } });
    if (!img) throw new AppError('Image not found', 404);
    return prisma.inspectionImage.delete({ where: { id } });
  },
};
