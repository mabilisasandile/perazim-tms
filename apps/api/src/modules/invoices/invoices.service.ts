import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateInvoiceDto, CreateInvoicePaymentDto, CreateRefundDto } from './invoices.schema';
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

    await this.recalculate(invoiceId);
    return payment;
  },

  /**
   * Refunds part or all of what's been paid on an invoice. Recorded as its
   * own InvoicePayment (type REFUND) so the full payment/refund history is
   * auditable, but tracked separately from amountPaid via amountRefunded so
   * refunds never get double-counted as new payments.
   */
  async refund(invoiceId: number, data: CreateRefundDto, refundedByUsername: string) {
    const inv = await this.findById(invoiceId);

    const netPaid = Number(inv.amountPaid) - Number(inv.amountRefunded);
    if (data.amount > netPaid) {
      throw new AppError(
        `Refund amount (${data.amount}) cannot exceed the net amount currently paid (${netPaid})`,
        400
      );
    }

    const refund = await prisma.invoicePayment.create({
      data: {
        invoiceId,
        type:      'REFUND',
        amount:    data.amount,
        method:    data.method,
        reference: data.reference ?? null,
        notes:     `Refunded by ${refundedByUsername}: ${data.reason}`,
      },
    });

    await this.recalculate(invoiceId);
    return refund;
  },

  /**
   * Recomputes amountPaid, amountRefunded and status from the full payment
   * history for an invoice. PAYMENT/DEPOSIT entries add to amountPaid;
   * REFUND entries are tracked separately in amountRefunded and are never
   * added back into amountPaid.
   */
  async recalculate(invoiceId: number) {
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const allPayments = await prisma.invoicePayment.findMany({ where: { invoiceId } });

    const amountPaid = allPayments
      .filter(p => p.type === 'DEPOSIT' || p.type === 'PAYMENT')
      .reduce((s, p) => s + Number(p.amount), 0);
    const amountRefunded = allPayments
      .filter(p => p.type === 'REFUND')
      .reduce((s, p) => s + Number(p.amount), 0);
    const depositPaid = allPayments
      .filter(p => p.type === 'DEPOSIT')
      .reduce((s, p) => s + Number(p.amount), 0);

    const total = Number(inv.total);
    const netPaid = amountPaid - amountRefunded;

    let status: string = inv.status;
    let paidAt: Date | null = inv.paidAt ? new Date(inv.paidAt as any) : null;

    if (amountRefunded > 0 && netPaid <= 0) {
      status = 'refunded';
    } else if (amountRefunded > 0 && netPaid < total) {
      status = 'partially_refunded';
    } else if (netPaid >= total && total > 0) {
      status = 'paid';
      paidAt = paidAt ?? new Date();
    } else if (netPaid > 0) {
      status = 'partial';
    } else {
      status = 'unpaid';
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid, amountRefunded, depositPaid, status, paidAt },
    });
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

  async emailInvoice(id: number) {
    const inv = await this.findById(id);
    await notificationService.dispatch('INVOICE_NOTIFICATION', { invoice: inv });
    return { message: 'Invoice email sent', email: inv.customer?.email ?? null };
  },

  /**
   * Generates one invoice per vehicle/trip within a booking that doesn't
   * already have an invoice — used when a customer books multiple vehicles
   * under a single booking and needs an invoice per vehicle.
   */
  async generateForBooking(bookingId: number) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { trips: { include: { invoices: true } } },
    });
    if (!booking) throw new AppError('Booking not found', 404);

    const settings = await prisma.settings.findFirst();
    const vatRate = settings?.vat ?? 15;

    const created = [];
    for (const trip of booking.trips) {
      if (trip.invoices.length > 0) continue; // already invoiced

      const count = await prisma.invoice.count();
      const number = `INV-${String(count + 1).padStart(5, '0')}`;
      const amount = Number(trip.amount ?? 0);
      const vatAmount = amount * (vatRate / 100);
      const total = amount + vatAmount;

      const inv = await prisma.invoice.create({
        data: {
          number,
          customerId: booking.customerId,
          tripId: trip.id,
          bookingId: booking.id,
          amount,
          vatAmount,
          total,
          status: 'unpaid',
          vehicleDescription: [trip.customerVehicleMake, trip.customerVehicleRegistration]
            .filter(Boolean).join(' — ') || null,
          vehicleCondition: trip.vehicleCondition,
        },
        include: { customer: { select: { id: true, name: true, email: true, phone: true, payLaterApproved: true } } },
      });
      created.push(inv);
    }
    return created;
  },

  /**
   * Emails every invoice tied to a booking in one action — supports the
   * "send multiple invoices at once when a customer has more than one
   * vehicle" requirement.
   */
  async sendForBooking(bookingId: number) {
    const invoices = await prisma.invoice.findMany({
      where: { bookingId },
      include: { customer: { select: { id: true, name: true, email: true, phone: true, payLaterApproved: true } } },
    });
    if (invoices.length === 0) throw new AppError('No invoices found for this booking', 404);

    for (const inv of invoices) {
      await notificationService.dispatch('INVOICE_NOTIFICATION', { invoice: inv }).catch(() => {});
    }
    return { message: `${invoices.length} invoice(s) sent`, count: invoices.length };
  },

  async markOverdue() {
    const now = new Date();
    const result = await prisma.invoice.updateMany({
      where: { status: { in: ['unpaid', 'partial'] }, dueDate: { lt: now } },
      data: { status: 'overdue' },
    });
    return { updated: result.count };
  },

  /**
   * VAT report over a date range — total ex-VAT sales, VAT collected, and
   * gross invoiced total, broken down by month so it can be reconciled
   * against a SARS VAT return period.
   */
  async getVatReport(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    const invoices = await prisma.invoice.findMany({
      where,
      select: { id: true, number: true, createdAt: true, amount: true, vatAmount: true, total: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const byMonth = new Map<string, { month: string; salesExVat: number; vatCollected: number; grossInvoiced: number; invoiceCount: number }>();
    let totals = { salesExVat: 0, vatCollected: 0, grossInvoiced: 0, invoiceCount: 0 };

    for (const inv of invoices) {
      const month = inv.createdAt.toISOString().slice(0, 7); // YYYY-MM
      const bucket = byMonth.get(month) ?? { month, salesExVat: 0, vatCollected: 0, grossInvoiced: 0, invoiceCount: 0 };
      bucket.salesExVat    += Number(inv.amount);
      bucket.vatCollected  += Number(inv.vatAmount);
      bucket.grossInvoiced += Number(inv.total);
      bucket.invoiceCount  += 1;
      byMonth.set(month, bucket);

      totals.salesExVat    += Number(inv.amount);
      totals.vatCollected  += Number(inv.vatAmount);
      totals.grossInvoiced += Number(inv.total);
      totals.invoiceCount  += 1;
    }

    return {
      from: from ?? null,
      to: to ?? null,
      totals,
      byMonth: Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)),
    };
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
