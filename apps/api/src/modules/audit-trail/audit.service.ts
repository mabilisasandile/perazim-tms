import { prisma } from '../../lib/prisma';

export interface AuditParams {
  username: string;
  ipAddress?: string;
  actionType: string;
  entityType: string;
  entityId?: number;
  oldValue?: unknown;
  newValue?: unknown;
}

export const auditService = {
  async log(params: AuditParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          username:   params.username,
          ipAddress:  params.ipAddress ?? null,
          actionType: params.actionType,
          entityType: params.entityType,
          entityId:   params.entityId  ?? null,
          oldValue:   params.oldValue  != null ? (params.oldValue as any) : undefined,
          newValue:   params.newValue  != null ? (params.newValue as any) : undefined,
        },
      });
    } catch (err) {
      console.error('[AuditTrail] Failed to write log:', err);
    }
  },

  async findAll(filters?: {
    username?:   string;
    actionType?: string;
    entityType?: string;
    from?:       string;
    to?:         string;
    page?:       number;
    limit?:      number;
  }) {
    const page  = filters?.page  ?? 1;
    const limit = filters?.limit ?? 50;

    const where: any = {};
    if (filters?.username)   where.username   = { contains: filters.username };
    if (filters?.actionType) where.actionType = filters.actionType;
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to)   where.createdAt.lte = new Date(filters.to);
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:  (page - 1) * limit,
        take:  limit,
      }),
    ]);

    return { total, page, limit, logs };
  },
};

export function getIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]).trim();
  return req.ip ?? 'unknown';
}
