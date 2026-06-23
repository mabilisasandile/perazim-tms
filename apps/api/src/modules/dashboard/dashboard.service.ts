import { prisma } from '../../lib/prisma';
import { subDays, subMonths, format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

export const dashboardService = {
  async getStats() {
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const [
      totalVehicles,
      totalDrivers,
      totalCustomers,
      totalTrailers,
      todayTrips,
      todayIncome,
      todayExpense,
      vehicleStatuses,
    ] = await Promise.all([
      prisma.vehicle.count({ where: { isActive: true } }),
      prisma.driver.count({ where: { isActive: true } }),
      prisma.customer.count({ where: { isActive: true } }),
      prisma.trailer.count({ where: { isActive: true } }),
      prisma.trip.count({
        where: { startDate: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.incomeExpense.aggregate({
        where: { type: 'INCOME', date: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
      prisma.incomeExpense.aggregate({
        where: { type: 'EXPENSE', date: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
      // Latest trip per vehicle — ROW_NUMBER() avoids LIMIT inside correlated subquery (TiDB-compatible)
      prisma.$queryRaw<
        {
          vehicleName: string;
          registrationNo: string;
          status: string;
          fromLocation: string;
          toLocation: string;
        }[]
      >`
        SELECT
          v.name         AS vehicleName,
          v.registrationNo,
          latest.status,
          latest.fromLocation,
          latest.toLocation
        FROM vehicles v
        LEFT JOIN (
          SELECT vehicleId, status, fromLocation, toLocation,
                 ROW_NUMBER() OVER (PARTITION BY vehicleId ORDER BY createdAt DESC) AS rn
          FROM trips
        ) latest ON latest.vehicleId = v.id AND latest.rn = 1
        WHERE v.isActive = TRUE
        ORDER BY latest.status
        LIMIT 20
      `,
    ]);

    // 6-day income/expense chart data
    const chartData = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const date = subDays(today, 5 - i);
        const start = startOfDay(date);
        const end = endOfDay(date);
        return Promise.all([
          prisma.incomeExpense.aggregate({
            where: { type: 'INCOME', date: { gte: start, lte: end } },
            _sum: { amount: true },
          }),
          prisma.incomeExpense.aggregate({
            where: { type: 'EXPENSE', date: { gte: start, lte: end } },
            _sum: { amount: true },
          }),
        ]).then(([inc, exp]) => ({
          date: format(date, 'MMM d'),
          income: Number(inc._sum.amount ?? 0),
          expense: Number(exp._sum.amount ?? 0),
        }));
      })
    );

    return {
      totalVehicles,
      totalDrivers,
      totalCustomers,
      totalTrailers,
      todayTrips,
      todayIncome: Number(todayIncome._sum.amount ?? 0),
      todayExpense: Number(todayExpense._sum.amount ?? 0),
      chartData,
      vehicleStatuses,
    };
  },

  async getOperationsStats() {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [
      activeTrips,
      deliveredThisMonth,
      deliveredTotal,
      totalVehicles,
      warehouses,
    ] = await Promise.all([
      prisma.trip.findMany({
        where: { status: 'IN_PROGRESS' },
        include: {
          vehicle: { select: { name: true, registrationNo: true } },
          driver: { select: { name: true } },
          customer: { select: { name: true } },
        },
        orderBy: { startDate: 'asc' },
        take: 20,
      }),
      prisma.trip.count({
        where: { status: 'COMPLETED', updatedAt: { gte: monthStart, lte: monthEnd } },
      }),
      prisma.trip.count({ where: { status: 'COMPLETED' } }),
      prisma.vehicle.count({ where: { isActive: true } }),
      prisma.warehouse.findMany({
        where: { isActive: true },
        include: {
          vehicles: {
            where: { status: { in: ['IN_STORAGE', 'AWAITING_DISPATCH'] } },
          },
        },
      }),
    ]);

    const activeVehicleCount = await prisma.trip
      .groupBy({ by: ['vehicleId'], where: { status: 'IN_PROGRESS' } })
      .then((groups) => groups.length);

    const driverPerformance = await prisma.$queryRaw<
      {
        id: number;
        name: string;
        totalTrips: bigint;
        completedTrips: bigint;
        activeTrips: bigint;
        cancelledTrips: bigint;
      }[]
    >`
      SELECT
        d.id,
        d.name,
        COUNT(t.id) AS totalTrips,
        SUM(CASE WHEN t.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completedTrips,
        SUM(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS activeTrips,
        SUM(CASE WHEN t.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelledTrips
      FROM drivers d
      LEFT JOIN trips t ON t.driverId = d.id
      WHERE d.isActive = true
      GROUP BY d.id, d.name
      HAVING COUNT(t.id) > 0
      ORDER BY completedTrips DESC
      LIMIT 15
    `;

    return {
      activeTrips: activeTrips.map((t) => ({
        id: t.id,
        trackingCode: t.trackingCode,
        fromLocation: t.fromLocation,
        toLocation: t.toLocation,
        startDate: t.startDate,
        vehicleName: t.vehicle.name,
        vehicleReg: t.vehicle.registrationNo,
        driverName: t.driver.name,
        customerName: t.customer.name,
      })),
      deliveredVehicles: {
        thisMonth: deliveredThisMonth,
        total: deliveredTotal,
      },
      warehouseOccupancy: warehouses.map((w) => ({
        id: w.id,
        name: w.name,
        location: w.location,
        capacity: w.capacity,
        occupied: w.vehicles.length,
        utilizationPct:
          w.capacity > 0 ? Math.round((w.vehicles.length / w.capacity) * 100) : 0,
      })),
      driverPerformance: driverPerformance.map((d) => ({
        id: Number(d.id),
        name: d.name,
        totalTrips: Number(d.totalTrips),
        completedTrips: Number(d.completedTrips),
        activeTrips: Number(d.activeTrips),
        cancelledTrips: Number(d.cancelledTrips),
        completionRate:
          Number(d.totalTrips) > 0
            ? Math.round((Number(d.completedTrips) / Number(d.totalTrips)) * 100)
            : 0,
      })),
      fleetUtilization: {
        total: totalVehicles,
        active: activeVehicleCount,
        idle: totalVehicles - activeVehicleCount,
        utilizationPct:
          totalVehicles > 0 ? Math.round((activeVehicleCount / totalVehicles) * 100) : 0,
      },
    };
  },

  async getFinancialStats() {
    const now = new Date();

    // Revenue & Expense Trends — last 12 months
    const revenueTrends = await Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const date = subMonths(now, 11 - i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        return Promise.all([
          prisma.invoicePayment.aggregate({
            where: { createdAt: { gte: start, lte: end } },
            _sum: { amount: true },
          }),
          prisma.incomeExpense.aggregate({
            where: { type: 'INCOME', date: { gte: start, lte: end } },
            _sum: { amount: true },
          }),
          prisma.incomeExpense.aggregate({
            where: { type: 'EXPENSE', date: { gte: start, lte: end } },
            _sum: { amount: true },
          }),
          prisma.fuel.aggregate({
            where: { fillDate: { gte: start, lte: end } },
            _sum: { totalCost: true },
          }),
        ]).then(([invPayments, income, expense, fuel]) => ({
          month: format(date, 'MMM yyyy'),
          revenue:
            Number(invPayments._sum.amount ?? 0) + Number(income._sum.amount ?? 0),
          expenses:
            Number(expense._sum.amount ?? 0) + Number(fuel._sum.totalCost ?? 0),
        }));
      })
    );

    // Outstanding payments breakdown
    const [unpaidAgg, partialAgg, overdueAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: { status: 'unpaid' },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.invoice.aggregate({
        where: { status: 'partial' },
        _count: { id: true },
      }),
      prisma.invoice.aggregate({
        where: { status: 'overdue' },
        _sum: { total: true },
        _count: { id: true },
      }),
    ]);

    const partialInvoices = await prisma.invoice.findMany({
      where: { status: 'partial' },
      select: { total: true, amountPaid: true },
    });
    const partialOutstanding = partialInvoices.reduce(
      (sum, inv) => sum + (Number(inv.total) - Number(inv.amountPaid)),
      0
    );

    // Monthly revenue for current year (bar chart)
    const currentYear = now.getFullYear();
    const monthlyRevenue = await Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const date = new Date(currentYear, i, 1);
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        return Promise.all([
          prisma.invoicePayment.aggregate({
            where: { createdAt: { gte: start, lte: end } },
            _sum: { amount: true },
          }),
          prisma.incomeExpense.aggregate({
            where: { type: 'INCOME', date: { gte: start, lte: end } },
            _sum: { amount: true },
          }),
        ]).then(([invPayments, income]) => ({
          month: format(date, 'MMM'),
          revenue:
            Number(invPayments._sum.amount ?? 0) + Number(income._sum.amount ?? 0),
        }));
      })
    );

    const unpaidTotal = Number(unpaidAgg._sum.total ?? 0);
    const overdueTotal = Number(overdueAgg._sum.total ?? 0);

    return {
      revenueTrends,
      outstandingPayments: {
        unpaid: { count: unpaidAgg._count.id, total: unpaidTotal },
        partial: { count: partialAgg._count.id, outstanding: partialOutstanding },
        overdue: { count: overdueAgg._count.id, total: overdueTotal },
        totalOutstanding: unpaidTotal + partialOutstanding + overdueTotal,
      },
      monthlyRevenue,
    };
  },
};
