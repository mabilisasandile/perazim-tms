import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

export const paymentsService = {
  async findAll(filters: { tripId?: number; status?: string }) {
    return prisma.tripPayment.findMany({
      where: {
        ...(filters.tripId ? { tripId: filters.tripId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
        trip: {
          select: {
            id: true,
            trackingCode: true,
            fromLocation: true,
            toLocation: true,
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: number) {
    const p = await prisma.tripPayment.findUnique({
      where: { id },
      include: {
        trip: {
          include: {
            customer: { select: { id: true, name: true, email: true } },
            vehicle:  { select: { name: true, registrationNo: true } },
            driver:   { select: { name: true } },
          },
        },
      },
    });
    if (!p) throw new AppError('Payment not found', 404);
    return p;
  },

  async create(data: {
    tripId:    number;
    vehicleId: number;
    amount:    number;
    method:    'payfast' | 'manual' | 'eft';
    reference?: string;
  }) {
    // Ensure trip exists
    const trip = await prisma.trip.findUnique({ where: { id: data.tripId } });
    if (!trip) throw new AppError('Trip not found', 404);

    // Prevent duplicate payment
    const existing = await prisma.tripPayment.findUnique({ where: { tripId: data.tripId } });
    if (existing) throw new AppError('A payment record already exists for this trip', 409);

    return prisma.tripPayment.create({
      data: { ...data, status: 'pending' },
      include: {
        trip: { select: { trackingCode: true, fromLocation: true, toLocation: true } },
      },
    });
  },

  async markPaid(id: number, reference?: string) {
    await this.findById(id);
    return prisma.tripPayment.update({
      where: { id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        ...(reference ? { reference } : {}),
      },
    });
  },

  async updateStatus(id: number, status: 'pending' | 'paid' | 'failed', reference?: string) {
    await this.findById(id);
    return prisma.tripPayment.update({
      where: { id },
      data: {
        status,
        ...(status === 'paid' ? { paidAt: new Date() } : {}),
        ...(reference ? { reference } : {}),
      },
    });
  },

  async remove(id: number) {
    await this.findById(id);
    return prisma.tripPayment.delete({ where: { id } });
  },

  async getSummary() {
    const [total, paid, pending, failed] = await Promise.all([
      prisma.tripPayment.aggregate({ _sum: { amount: true }, _count: true }),
      prisma.tripPayment.aggregate({ where: { status: 'paid' },    _sum: { amount: true }, _count: true }),
      prisma.tripPayment.aggregate({ where: { status: 'pending' }, _sum: { amount: true }, _count: true }),
      prisma.tripPayment.aggregate({ where: { status: 'failed' },  _sum: { amount: true }, _count: true }),
    ]);
    return {
      total:   { count: total._count,   amount: Number(total._sum.amount   ?? 0) },
      paid:    { count: paid._count,    amount: Number(paid._sum.amount    ?? 0) },
      pending: { count: pending._count, amount: Number(pending._sum.amount ?? 0) },
      failed:  { count: failed._count,  amount: Number(failed._sum.amount  ?? 0) },
    };
  },
};
