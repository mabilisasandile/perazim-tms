import { prisma } from '../../lib/prisma';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';

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
      // Latest trip per vehicle (vehicle status overview)
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
          t.status,
          t.fromLocation,
          t.toLocation
        FROM vehicles v
        LEFT JOIN trips t ON t.id = (
          SELECT id FROM trips WHERE vehicleId = v.id
          ORDER BY createdAt DESC LIMIT 1
        )
        WHERE v.isActive = true
        ORDER BY t.status
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
};
