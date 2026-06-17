import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateInvoiceDto, CreateInvoicePaymentDto } from './invoices.schema';
import { notificationService } from '../notifications/notification.service';

export const invoicesService = {
  async findAll(status?: string) {
    const invoices = await prisma.invoice.findMany({
      where: status ? { status } : {},
      include: {
        customer: { select: { id: true, name: true, email: true, payLaterApproved: true } },
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invoices;
  },

  async findById(id: number) {
    const inv = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true, address: true, payLaterApproved: true } },
        trip: { select: { id: true, trackingCode: true, fromLocation: true, toLocation: true } },
        items: true,
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!inv) throw new AppError('Invoice not found', 404);
    return inv;
  },

  async create(data: CreateInvoiceDto) {
    const count = await prisma.invoice.count();
    const number = `INV-${String(count + 1).padStart(5, '0')}`;

    // Bulk invoicing: derive amount from items if provided
    let amount = data.amount;
    if (data.items && data.items.length > 0) {
      amount = data.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    }

    const vatAmount = amount * (data.vatRate / 100);
    const total = amount + vatAmount;

    const inv = await prisma.invoice.create({
      data: {
        number,
        customerId:         data.customerId,
        tripId:             data.tripId ?? null,
        amount,
        vatAmount,
        total,
        depositRequired:    data.depositRequired ?? null,
        dueDate:            data.dueDate ? new Date(data.dueDate) : null,
        notes:              data.notes,
        vehicleDescription: data.vehicleDescription ?? null,
        vehicleCondition:   data.vehicleCondition   ?? null,
        status:             'unpaid',
        items: data.items && data.items.length > 0
          ? {
              create: data.items.map(item => ({
                description:      item.description,
                vehicleCondition: item.vehicleCondition ?? null,
                quantity:         item.quantity,
                unitPrice:        item.unitPrice,
                total:            item.unitPrice * item.quantity,
              })),
            }
          : undefined,
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true, payLaterApproved: true } },
        items: true,
        payments: true,
      },
    });

    notificationService.dispatch('INVOICE_NOTIFICATION', { invoice: inv }).catch(() => {});
    return inv;
  },

  async recordPayment(invoiceId: number, data: CreateInvoicePaymentDto, proofPath?: string) {
    const inv = await this.findById(invoiceId);

    const payment = await prisma.invoicePayment.create({
      data: {
        invoiceId,
        type:      data.type,
        amount:    data.amount,
        method:    data.method,
        reference: data.reference ?? null,
        proofPath: proofPath ?? null,
        notes:     data.notes ?? null,
      },
    });

    // Recalculate totals from all payments
    const allPayments = await prisma.invoicePayment.findMany({ where: { invoiceId } });
    const amountPaid  = allPayments.reduce((s, p) => s + Number(p.amount), 0);
    const depositPaid = allPayments
      .filter(p => p.type === 'DEPOSIT')
      .reduce((s, p) => s + Number(p.amount), 0);

    const total = Number(inv.total);
    let status: string = inv.status;
    let paidAt: Date | null = inv.paidAt ? new Date(inv.paidAt as any) : null;

    if (amountPaid >= total) {
      status = 'paid';
      paidAt = paidAt ?? new Date();
    } else if (amountPaid > 0) {
      status = 'partial';
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid, depositPaid, status, paidAt },
    });

    return payment;
  },

  async getPayments(invoiceId: number) {
    await this.findById(invoiceId);
    return prisma.invoicePayment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'asc' },
    });
  },

  async updateStatus(id: number, status: string) {
    await this.findById(id);
    return prisma.invoice.update({
      where: { id },
      data: { status, ...(status === 'paid' ? { paidAt: new Date() } : {}) },
    });
  },

  async remove(id: number) {
    await this.findById(id);
    return prisma.invoice.delete({ where: { id } });
  },

  async markOverdue() {
    const now = new Date();
    const result = await prisma.invoice.updateMany({
      where: { status: { in: ['unpaid', 'partial'] }, dueDate: { lt: now } },
      data: { status: 'overdue' },
    });
    return { updated: result.count };
  },

  async getStats() {
    const [total, paid, unpaid, overdue, partial] = await Promise.all([
      prisma.invoice.aggregate({ _sum: { total: true, amountPaid: true }, _count: true }),
      prisma.invoice.aggregate({ where: { status: 'paid'    }, _sum: { total: true }, _count: true }),
      prisma.invoice.aggregate({ where: { status: 'unpaid'  }, _sum: { total: true }, _count: true }),
      prisma.invoice.aggregate({ where: { status: 'overdue' }, _sum: { total: true }, _count: true }),
      prisma.invoice.aggregate({ where: { status: 'partial' }, _sum: { total: true, amountPaid: true }, _count: true }),
    ]);
    const outstanding = Number(total._sum.total ?? 0) - Number(total._sum.amountPaid ?? 0);
    return {
      total:       { count: total._count,   amount: Number(total._sum.total   ?? 0) },
      paid:        { count: paid._count,    amount: Number(paid._sum.total    ?? 0) },
      unpaid:      { count: unpaid._count,  amount: Number(unpaid._sum.total  ?? 0) },
      overdue:     { count: overdue._count, amount: Number(overdue._sum.total ?? 0) },
      partial:     { count: partial._count, amount: Number(partial._sum.total ?? 0), collected: Number(partial._sum.amountPaid ?? 0) },
      outstanding,
    };
  },

  // Check if a trip has an outstanding unpaid invoice (used by trip closure guard)
  async hasOutstandingInvoice(tripId: number): Promise<boolean> {
    const inv = await prisma.invoice.findFirst({
      where: { tripId, status: { in: ['unpaid', 'partial', 'overdue'] } },
    });
    return !!inv;
  },
};
