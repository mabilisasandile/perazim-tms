import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateJobDto, UpdateJobDto, UpdateJobStatusDto,
  CreateRouteDto, UpdateRouteDto, CompatibilityCheckDto,
} from './flat-deck.schema';

// Map trailerType enum value to the route's allow-flag field name
const ALLOW_FIELD: Record<string, string> = {
  FLAT_12M:            'allows12mFlat',
  SUPERLINK_FLAT_DECK: 'allowsSuperlink',
  TAUTLINER:           'allowsTautliner',
  LOWBED:              'allowsLowbed',
};

export const flatDeckService = {
  // ─── Jobs ──────────────────────────────────────────────────────────────────

  async findAllJobs(filters?: { status?: string; trailerType?: string }) {
    return prisma.flatDeckJob.findMany({
      where: {
        ...(filters?.status      ? { status:      filters.status }      : {}),
        ...(filters?.trailerType ? { trailerType: filters.trailerType as any } : {}),
      },
      include: {
        trailer: { select: { id: true, registrationNo: true, category: true } },
        vehicle: { select: { id: true, name: true, registrationNo: true } },
        cargo:   true,
      },
      orderBy: { plannedDate: 'desc' },
    });
  },

  async findJobById(id: number) {
    const job = await prisma.flatDeckJob.findUnique({
      where: { id },
      include: {
        trailer: { select: { id: true, registrationNo: true, category: true, loadCapacity: true } },
        vehicle: { select: { id: true, name: true, registrationNo: true } },
        cargo:   { orderBy: { id: 'asc' } },
      },
    });
    if (!job) throw new AppError('Job not found', 404);
    return job;
  },

  async createJob(data: CreateJobDto) {
    const count = await prisma.flatDeckJob.count();
    const reference = `FDJ-${String(count + 1).padStart(5, '0')}`;

    const { cargo, plannedDate, ...rest } = data;

    const cargoWithTotals = cargo.map(c => ({
      ...c,
      totalWeight: c.weightPerUnit * c.quantity,
    }));
    const totalWeight = cargoWithTotals.reduce((s, c) => s + c.totalWeight, 0);

    return prisma.flatDeckJob.create({
      data: {
        ...rest,
        reference,
        plannedDate: new Date(plannedDate),
        totalWeight,
        cargo: { create: cargoWithTotals },
      },
      include: { cargo: true },
    });
  },

  async updateJob(id: number, data: UpdateJobDto) {
    await this.findJobById(id);
    const { plannedDate, ...rest } = data;
    return prisma.flatDeckJob.update({
      where: { id },
      data: {
        ...rest,
        ...(plannedDate ? { plannedDate: new Date(plannedDate) } : {}),
      },
    });
  },

  async updateJobStatus(id: number, data: UpdateJobStatusDto) {
    await this.findJobById(id);
    const update: Record<string, unknown> = { status: data.status };
    if (data.status === 'DELIVERED') update.deliveredAt = new Date();
    return prisma.flatDeckJob.update({ where: { id }, data: update });
  },

  async deleteJob(id: number) {
    const job = await this.findJobById(id);
    if (!['PLANNED', 'CANCELLED'].includes(job.status)) {
      throw new AppError('Only PLANNED or CANCELLED jobs can be deleted', 400);
    }
    return prisma.flatDeckJob.delete({ where: { id } });
  },

  // ─── Routes ────────────────────────────────────────────────────────────────

  async findAllRoutes() {
    return prisma.flatDeckRoute.findMany({ orderBy: { name: 'asc' } });
  },

  async findRouteById(id: number) {
    const route = await prisma.flatDeckRoute.findUnique({ where: { id } });
    if (!route) throw new AppError('Route not found', 404);
    return route;
  },

  async createRoute(data: CreateRouteDto) {
    return prisma.flatDeckRoute.create({ data });
  },

  async updateRoute(id: number, data: UpdateRouteDto) {
    await this.findRouteById(id);
    return prisma.flatDeckRoute.update({ where: { id }, data });
  },

  async deleteRoute(id: number) {
    await this.findRouteById(id);
    return prisma.flatDeckRoute.delete({ where: { id } });
  },

  // ─── Route Compatibility Check ─────────────────────────────────────────────

  async checkCompatibility(data: CompatibilityCheckDto) {
    const route = await this.findRouteById(data.routeId);

    const issues: string[] = [];
    const allowField = ALLOW_FIELD[data.trailerType];
    const trailerAllowed = allowField ? (route as any)[allowField] === true : true;

    if (!trailerAllowed) {
      issues.push(`${data.trailerType.replace(/_/g, ' ')} trailers are not permitted on this route.`);
    }

    if (data.totalWeightKg && route.maxWeightTonnes) {
      const weightTonnes = data.totalWeightKg / 1000;
      if (weightTonnes > route.maxWeightTonnes) {
        issues.push(`Cargo weight (${weightTonnes.toFixed(1)} t) exceeds route limit of ${route.maxWeightTonnes} t.`);
      }
    }

    if (data.maxHeightM && route.maxHeightM) {
      if (data.maxHeightM > route.maxHeightM) {
        issues.push(`Cargo height (${data.maxHeightM} m) exceeds route overhead clearance of ${route.maxHeightM} m.`);
      }
    }

    if (data.maxLengthM && route.maxLengthM) {
      if (data.maxLengthM > route.maxLengthM) {
        issues.push(`Cargo length (${data.maxLengthM} m) exceeds route length restriction of ${route.maxLengthM} m.`);
      }
    }

    return {
      compatible: issues.length === 0,
      route,
      trailerType: data.trailerType,
      issues,
    };
  },

  // ─── Stats ─────────────────────────────────────────────────────────────────

  async getStats() {
    const [byStatus, byType, recentJobs] = await Promise.all([
      prisma.flatDeckJob.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.flatDeckJob.groupBy({ by: ['trailerType'], _count: { id: true } }),
      prisma.flatDeckJob.findMany({
        where: { status: { in: ['PLANNED', 'LOADING', 'IN_TRANSIT'] } },
        include: {
          trailer: { select: { registrationNo: true } },
          vehicle: { select: { name: true } },
        },
        orderBy: { plannedDate: 'asc' },
        take: 5,
      }),
    ]);

    return { byStatus, byType, recentJobs };
  },
};
