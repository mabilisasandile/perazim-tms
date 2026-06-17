import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

/* ── helpers ──────────────────────────────────────────────────────────────── */

function toNum(v: any): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v);
}

function periodBounds(periodType: string, periodStartStr: string): { start: Date; end: Date } {
  const [y, m, d] = periodStartStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  let end: Date;
  if (periodType === 'WEEKLY') {
    end = new Date(Date.UTC(y, m - 1, d + 6, 23, 59, 59, 999));
  } else {
    // last day of month
    const lastDay = new Date(Date.UTC(y, m, 0));
    end = new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate(), 23, 59, 59, 999));
  }
  return { start, end };
}

/* ── service ──────────────────────────────────────────────────────────────── */

export const payrollService = {

  // ─── Settings ─────────────────────────────────────────────────────────────

  async getSettings() {
    let s = await prisma.payrollSetting.findFirst();
    if (!s) {
      s = await prisma.payrollSetting.create({
        data: { tripRateEnabled: true, defaultTripRate: 0 },
      });
    }
    return s;
  },

  async updateSettings(data: {
    baseEnabled?: boolean; defaultBaseSalary?: number | null;
    tripRateEnabled?: boolean; defaultTripRate?: number | null;
    commissionEnabled?: boolean; commissionRate?: number | null;
    currency?: string;
  }) {
    let s = await prisma.payrollSetting.findFirst();
    if (!s) {
      s = await prisma.payrollSetting.create({ data: {} });
    }
    return prisma.payrollSetting.update({ where: { id: s.id }, data });
  },

  // ─── Driver Config ────────────────────────────────────────────────────────

  async getDriverConfig(driverId: number) {
    return prisma.driverPayrollConfig.findUnique({ where: { driverId } });
  },

  async upsertDriverConfig(driverId: number, data: {
    baseSalary?: number | null; tripRate?: number | null;
    commissionRate?: number | null; notes?: string;
  }) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new AppError('Driver not found', 404);
    return prisma.driverPayrollConfig.upsert({
      where:  { driverId },
      create: { driverId, ...data },
      update: data,
    });
  },

  async allDriverConfigs() {
    const [drivers, configs, settings] = await Promise.all([
      prisma.driver.findMany({ where: { isActive: true }, select: { id: true, name: true, mobile: true }, orderBy: { name: 'asc' } }),
      prisma.driverPayrollConfig.findMany(),
      this.getSettings(),
    ]);
    const cfgMap = new Map(configs.map(c => [c.driverId, c]));
    return drivers.map(d => ({
      driver: d,
      config: cfgMap.get(d.id) ?? null,
      effective: {
        baseSalary:     toNum(cfgMap.get(d.id)?.baseSalary    ?? settings.defaultBaseSalary),
        tripRate:       toNum(cfgMap.get(d.id)?.tripRate       ?? settings.defaultTripRate),
        commissionRate: cfgMap.get(d.id)?.commissionRate ?? settings.commissionRate ?? 0,
      },
    }));
  },

  // ─── Generate Entry ───────────────────────────────────────────────────────

  async generateEntry(driverId: number, periodType: string, periodStartStr: string) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new AppError('Driver not found', 404);

    const settings = await this.getSettings();
    const driverCfg = await prisma.driverPayrollConfig.findUnique({ where: { driverId } });

    const { start, end } = periodBounds(periodType, periodStartStr);

    const effectiveTripRate    = toNum(driverCfg?.tripRate       ?? settings.defaultTripRate    ?? 0);
    const effectiveCommRate    = driverCfg?.commissionRate        ?? settings.commissionRate     ?? 0;
    const effectiveBaseSalary  = toNum(driverCfg?.baseSalary     ?? settings.defaultBaseSalary  ?? 0);

    // Completed trips in period
    const trips = await prisma.trip.findMany({
      where: { driverId, status: 'COMPLETED', endDate: { gte: start, lte: end } },
      select: { id: true, totalAmount: true },
    });

    const tripLinksData = trips.map(t => {
      const tripAmt  = toNum(t.totalAmount);
      const tripRate = settings.tripRateEnabled   ? effectiveTripRate              : 0;
      const comm     = settings.commissionEnabled ? tripAmt * (effectiveCommRate / 100) : 0;
      return {
        tripId: t.id,
        tripAmount:     Math.round(tripAmt  * 100) / 100,
        tripRate:       Math.round(tripRate * 100) / 100,
        commission:     Math.round(comm     * 100) / 100,
        driverEarnings: Math.round((tripRate + comm) * 100) / 100,
      };
    });

    const tripEarnings = tripLinksData.reduce((s, l) => s + l.tripRate,    0);
    const commissions  = tripLinksData.reduce((s, l) => s + l.commission,  0);
    const baseSalary   = settings.baseEnabled ? effectiveBaseSalary : 0;
    const grossPay     = baseSalary + tripEarnings + commissions;

    return prisma.$transaction(async tx => {
      const existing = await tx.payrollEntry.findFirst({
        where: { driverId, periodType, periodStart: start, periodEnd: end },
      });

      if (existing) {
        if (existing.status !== 'DRAFT') throw new AppError('Only DRAFT entries can be regenerated', 400);
        await tx.payrollTripLink.deleteMany({ where: { payrollEntryId: existing.id } });
        return tx.payrollEntry.update({
          where: { id: existing.id },
          data: {
            tripCount: trips.length, baseSalary, tripEarnings,
            commissions, grossPay, netPay: grossPay,
            tripLinks: { create: tripLinksData },
          },
          include: { tripLinks: { include: { trip: { select: { id: true, trackingCode: true, fromLocation: true, toLocation: true, totalAmount: true, endDate: true } } } }, driver: { select: { id: true, name: true } } },
        });
      }

      return tx.payrollEntry.create({
        data: {
          driverId, periodType, periodStart: start, periodEnd: end,
          tripCount: trips.length, baseSalary, tripEarnings,
          commissions, grossPay, netPay: grossPay,
          tripLinks: { create: tripLinksData },
        },
        include: { tripLinks: { include: { trip: { select: { id: true, trackingCode: true, fromLocation: true, toLocation: true, totalAmount: true, endDate: true } } } }, driver: { select: { id: true, name: true } } },
      });
    });
  },

  // ─── List / Get ───────────────────────────────────────────────────────────

  async listEntries(filters: {
    driverId?: number; periodType?: string; status?: string;
    from?: string; to?: string; limit?: number;
  }) {
    const where: any = {};
    if (filters.driverId)   where.driverId   = filters.driverId;
    if (filters.periodType) where.periodType = filters.periodType;
    if (filters.status)     where.status     = filters.status;
    if (filters.from || filters.to) {
      where.periodStart = {};
      if (filters.from) where.periodStart.gte = new Date(filters.from);
      if (filters.to)   where.periodStart.lte = new Date(filters.to);
    }
    return prisma.payrollEntry.findMany({
      where,
      include: { driver: { select: { id: true, name: true, mobile: true, email: true } } },
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
      take: filters.limit ?? 500,
    });
  },

  async getEntry(id: number) {
    const e = await prisma.payrollEntry.findUnique({
      where: { id },
      include: {
        driver: { select: { id: true, name: true, mobile: true, email: true, licenseNo: true } },
        tripLinks: {
          include: {
            trip: { select: { id: true, trackingCode: true, fromLocation: true, toLocation: true, totalAmount: true, endDate: true, status: true } },
          },
          orderBy: { trip: { endDate: 'asc' } },
        },
      },
    });
    if (!e) throw new AppError('Payroll entry not found', 404);
    return e;
  },

  // ─── Update Manual Fields ─────────────────────────────────────────────────

  async updateManuals(id: number, data: { bonuses?: number; deductions?: number; notes?: string }) {
    const e = await prisma.payrollEntry.findUnique({ where: { id } });
    if (!e) throw new AppError('Entry not found', 404);
    if (e.status === 'PAID') throw new AppError('Cannot edit a paid entry', 400);

    const bonuses    = data.bonuses    ?? toNum(e.bonuses);
    const deductions = data.deductions ?? toNum(e.deductions);
    const grossPay   = toNum(e.baseSalary) + toNum(e.tripEarnings) + toNum(e.commissions) + bonuses;
    const netPay     = grossPay - deductions;

    return prisma.payrollEntry.update({
      where: { id },
      data: { bonuses, deductions, grossPay, netPay, ...(data.notes !== undefined && { notes: data.notes }) },
    });
  },

  // ─── Status Transitions ───────────────────────────────────────────────────

  async updateStatus(id: number, status: string, meta?: {
    approvedBy?: string; paymentMethod?: string; paymentRef?: string;
  }) {
    const e = await prisma.payrollEntry.findUnique({ where: { id } });
    if (!e) throw new AppError('Entry not found', 404);

    const allowed: Record<string, string[]> = {
      DRAFT:       ['APPROVED', 'OUTSTANDING'],
      APPROVED:    ['PAID', 'OUTSTANDING', 'DRAFT'],
      OUTSTANDING: ['PAID', 'APPROVED'],
    };
    if (!allowed[e.status]?.includes(status)) {
      throw new AppError(`Cannot transition from ${e.status} to ${status}`, 400);
    }

    return prisma.payrollEntry.update({
      where: { id },
      data: {
        status,
        ...(status === 'APPROVED' && { approvedAt: new Date(), approvedBy: meta?.approvedBy }),
        ...(status === 'PAID'     && { paidAt: new Date(), paymentMethod: meta?.paymentMethod, paymentRef: meta?.paymentRef }),
      },
    });
  },

  async deleteEntry(id: number) {
    const e = await prisma.payrollEntry.findUnique({ where: { id } });
    if (!e) throw new AppError('Entry not found', 404);
    if (e.status !== 'DRAFT') throw new AppError('Only DRAFT entries can be deleted', 400);
    return prisma.payrollEntry.delete({ where: { id } });
  },

  // ─── Reports ──────────────────────────────────────────────────────────────

  async getPerformanceReport(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate   = new Date(to);

    const [trips, entries, drivers] = await Promise.all([
      prisma.trip.findMany({
        where: { status: 'COMPLETED', endDate: { gte: fromDate, lte: toDate } },
        select: { driverId: true, totalAmount: true },
      }),
      prisma.payrollEntry.findMany({
        where: { periodStart: { gte: fromDate }, periodEnd: { lte: toDate } },
        select: { driverId: true, tripCount: true, netPay: true, periodType: true },
      }),
      prisma.driver.findMany({
        where: { isActive: true },
        select: { id: true, name: true, mobile: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const tripsByDriver   = new Map<number, typeof trips>();
    const entryByDriver   = new Map<number, typeof entries>();
    for (const t of trips)   { if (!tripsByDriver.has(t.driverId!))  tripsByDriver.set(t.driverId!, []); tripsByDriver.get(t.driverId!)!.push(t); }
    for (const e of entries) { if (!entryByDriver.has(e.driverId))  entryByDriver.set(e.driverId, []); entryByDriver.get(e.driverId)!.push(e); }

    return {
      period: { from, to },
      drivers: drivers.map(d => {
        const dTrips   = tripsByDriver.get(d.id) ?? [];
        const dEntries = entryByDriver.get(d.id) ?? [];
        const totalRevenue  = dTrips.reduce((s, t) => s + toNum(t.totalAmount), 0);
        const totalEarnings = dEntries.reduce((s, e) => s + toNum(e.netPay), 0);
        const totalPaidTrips = dEntries.reduce((s, e) => s + e.tripCount, 0);
        return {
          driver:        d,
          totalTrips:    dTrips.length,
          totalRevenue:  Math.round(totalRevenue  * 100) / 100,
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          avgPerTrip:    dTrips.length ? Math.round((totalEarnings / dTrips.length) * 100) / 100 : 0,
          payrollEntries: dEntries.length,
          payrollTrips:   totalPaidTrips,
        };
      }).filter(r => r.totalTrips > 0 || r.payrollEntries > 0),
    };
  },

  async getPayrollReport(periodType: string, periodStartStr: string) {
    const { start, end } = periodBounds(periodType, periodStartStr);

    const entries = await prisma.payrollEntry.findMany({
      where: { periodType, periodStart: start, periodEnd: end },
      include: {
        driver: { select: { id: true, name: true, mobile: true, email: true } },
        tripLinks: { include: { trip: { select: { id: true, trackingCode: true, fromLocation: true, toLocation: true, endDate: true, totalAmount: true } } } },
      },
      orderBy: { driver: { name: 'asc' } },
    });

    const totals = {
      driverCount:      entries.length,
      totalTrips:       entries.reduce((s, e) => s + e.tripCount, 0),
      totalBaseSalary:  entries.reduce((s, e) => s + toNum(e.baseSalary),   0),
      totalTripEarnings:entries.reduce((s, e) => s + toNum(e.tripEarnings), 0),
      totalCommissions: entries.reduce((s, e) => s + toNum(e.commissions),  0),
      totalBonuses:     entries.reduce((s, e) => s + toNum(e.bonuses),      0),
      totalDeductions:  entries.reduce((s, e) => s + toNum(e.deductions),   0),
      totalGrossPay:    entries.reduce((s, e) => s + toNum(e.grossPay),     0),
      totalNetPay:      entries.reduce((s, e) => s + toNum(e.netPay),       0),
    };

    return { periodType, periodStart: start, periodEnd: end, entries, totals };
  },
};
