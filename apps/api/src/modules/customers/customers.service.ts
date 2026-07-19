import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateCustomerDto, UpdateCustomerDto } from './customers.schema';
import bcrypt from 'bcryptjs';
import { notificationService } from '../notifications/notification.service';

const CURRENT_TERMS_VERSION = '2026-07';

/**
 * Generates a customer-facing reference number, e.g. "CST00001" — used on
 * statements/invoices/the portal instead of the internal numeric id.
 */
async function generateCustomerReference(): Promise<string> {
  const count = await prisma.customer.count();
  return `CST${String(count + 1).padStart(5, '0')}`;
}

export const customersService = {
  async findAll() {
    return prisma.customer.findMany({
      include: { _count: { select: { trips: true, quotations: true } } },
      orderBy: { name: 'asc' },
    });
  },

  async findById(id: number) {
    const c = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { trips: true, quotations: true } },
        trips: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, trackingCode: true, status: true,
            fromLocation: true, toLocation: true,
            startDate: true, totalAmount: true,
          },
        },
        quotations: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, number: true, status: true, createdAt: true },
        },
      },
    });
    if (!c) throw new AppError('Customer not found', 404);
    const { password: _, resetToken: __, ...safe } = c;
    return safe;
  },

  async create(data: CreateCustomerDto) {
    const customerReference = await generateCustomerReference();
    const customer = await prisma.customer.create({
      data: { ...data, customerReference },
      include: { _count: { select: { trips: true, quotations: true } } },
    });
    if (customer.email) {
      notificationService.sendWelcomeEmail(customer.email, customer.name, 'customer').catch(() => {});
    }
    return customer;
  },

  async update(id: number, data: UpdateCustomerDto) {
    await this.findById(id);
    return prisma.customer.update({ where: { id }, data });
  },

  async remove(id: number) {
    const c = await prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { trips: true } } },
    });
    if (!c) throw new AppError('Customer not found', 404);
    if (c._count.trips > 0)
      throw new AppError('Cannot delete a customer with existing trips. Deactivate instead.', 409);
    return prisma.customer.delete({ where: { id } });
  },

  async setPortalPassword(id: number, password: string) {
    await this.findById(id);
    const hashed = await bcrypt.hash(password, 12);
    return prisma.customer.update({ where: { id }, data: { password: hashed } });
  },

  async getTrips(id: number) {
    await this.findById(id);
    return prisma.trip.findMany({
      where: { customerId: id },
      include: {
        vehicle: { select: { name: true, registrationNo: true } },
        driver:  { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Records the customer's acceptance of the current Terms & Conditions.
   */
  async acceptTerms(id: number) {
    await this.findById(id);
    return prisma.customer.update({
      where: { id },
      data: { termsAcceptedAt: new Date(), termsAcceptedVersion: CURRENT_TERMS_VERSION },
      select: { id: true, termsAcceptedAt: true, termsAcceptedVersion: true },
    });
  },

  /**
   * Builds a combined invoice/payment/refund statement for a customer over
   * an optional date range, with a running balance — used for the "view
   * statement" requirement in the customer & accounts portals.
   */
  async getStatement(id: number, from?: string, to?: string) {
    const customer = await this.findById(id);

    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to)   dateFilter.lte = new Date(to);

    const invoices = await prisma.invoice.findMany({
      where: { customerId: id, ...(from || to ? { createdAt: dateFilter } : {}) },
      include: { payments: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    type Line = { date: Date; type: 'INVOICE' | 'PAYMENT' | 'DEPOSIT' | 'REFUND'; reference: string; debit: number; credit: number };
    const lines: Line[] = [];

    for (const inv of invoices) {
      // Invoicing a customer is a debit (they owe more)
      lines.push({ date: inv.createdAt, type: 'INVOICE', reference: inv.number, debit: Number(inv.total), credit: 0 });
      for (const p of inv.payments) {
        if (p.type === 'REFUND') {
          // Refunding money back to the customer is a debit (they're owed again)
          lines.push({ date: p.createdAt, type: 'REFUND', reference: inv.number, debit: Number(p.amount), credit: 0 });
        } else {
          // Payments/deposits are credits against what they owe
          lines.push({ date: p.createdAt, type: p.type as 'PAYMENT' | 'DEPOSIT', reference: inv.number, debit: 0, credit: Number(p.amount) });
        }
      }
    }

    lines.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = 0;
    const statementLines = lines.map(l => {
      runningBalance += l.debit - l.credit;
      return { ...l, balance: runningBalance };
    });

    const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total), 0);
    const totalPaid = invoices.reduce(
      (s, i) => s + i.payments.filter(p => p.type !== 'REFUND').reduce((s2, p) => s2 + Number(p.amount), 0), 0
    );
    const totalRefunded = invoices.reduce(
      (s, i) => s + i.payments.filter(p => p.type === 'REFUND').reduce((s2, p) => s2 + Number(p.amount), 0), 0
    );

    return {
      customer: {
        id: customer.id,
        customerReference: (customer as any).customerReference,
        name: customer.name,
        email: customer.email,
      },
      from: from ?? null,
      to: to ?? null,
      lines: statementLines,
      summary: {
        totalInvoiced,
        totalPaid,
        totalRefunded,
        outstandingBalance: totalInvoiced - totalPaid + totalRefunded,
      },
    };
  },
};

