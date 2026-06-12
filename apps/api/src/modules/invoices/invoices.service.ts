import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { CreateInvoiceDto } from './invoices.schema';

export const invoicesService = {
  async findAll(status?: string) {
    return prisma.invoice.findMany({
      where: status ? { status } : {},
      include: {
        // Join customer via customerId — Invoice model has customerId field
        // We'll include a raw customer lookup in the response
      },
      orderBy: { createdAt: 'desc' },
    }).then(invoices =>
      // Enrich with customer data
      Promise.all(invoices.map(async inv => {
        const customer = await prisma.customer.findUnique({
          where: { id: inv.customerId },
          select: { id: true, name: true, email: true },
        });
        return { ...inv, customer };
      }))
    );
  },

  async findById(id: number) {
    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw new AppError('Invoice not found', 404);
    const customer = await prisma.customer.findUnique({
      where: { id: inv.customerId },
      select: { id: true, name: true, email: true, phone: true, address: true },
    });
    return { ...inv, customer };
  },

  async create(data: CreateInvoiceDto) {
    const count = await prisma.invoice.count();
    const number = `INV-${String(count + 1).padStart(5, '0')}`;
    const vatAmount = data.amount * (data.vatRate / 100);
    const total     = data.amount + vatAmount;

    const inv = await prisma.invoice.create({
      data: {
        number,
        customerId: data.customerId,
        amount:     data.amount,
        vatAmount,
        total,
        dueDate:    data.dueDate ? new Date(data.dueDate) : null,
        notes:      data.notes,
        status:     'unpaid',
      },
    });
    const customer = await prisma.customer.findUnique({
      where: { id: inv.customerId },
      select: { id: true, name: true, email: true },
    });
    return { ...inv, customer };
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
    // Mark all unpaid invoices past due date as overdue
    const now = new Date();
    const result = await prisma.invoice.updateMany({
      where: {
        status: 'unpaid',
        dueDate: { lt: now },
      },
      data: { status: 'overdue' },
    });
    return { updated: result.count };
  },

  async getStats() {
    const [total, paid, unpaid, overdue] = await Promise.all([
      prisma.invoice.aggregate({ _sum: { total: true }, _count: true }),
      prisma.invoice.aggregate({ where: { status: 'paid'    }, _sum: { total: true }, _count: true }),
      prisma.invoice.aggregate({ where: { status: 'unpaid'  }, _sum: { total: true }, _count: true }),
      prisma.invoice.aggregate({ where: { status: 'overdue' }, _sum: { total: true }, _count: true }),
    ]);
    return {
      total:   { count: total._count,   amount: Number(total._sum.total   ?? 0) },
      paid:    { count: paid._count,    amount: Number(paid._sum.total    ?? 0) },
      unpaid:  { count: unpaid._count,  amount: Number(unpaid._sum.total  ?? 0) },
      overdue: { count: overdue._count, amount: Number(overdue._sum.total ?? 0) },
    };
  },
};
