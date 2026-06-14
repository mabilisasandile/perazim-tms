import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { prisma } from '../../lib/prisma';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();

    if (q.length < 2) {
      return res.json({ query: q, results: { trips: [], quotations: [], invoices: [], customers: [], drivers: [] }, total: 0 });
    }

    const like = { contains: q };

    const [trips, quotations, invoices, customers, drivers] = await Promise.all([
      prisma.trip.findMany({
        where: {
          OR: [
            { trackingCode:               like },
            { customerVehicleVin:         like },
            { customerVehicleRegistration:like },
            { customerVehicleEngine:      like },
            { customerVehicleStock:       like },
            { customer: { name: like } },
            { driver:   { name: like } },
          ],
        },
        select: {
          id: true,
          trackingCode: true,
          status: true,
          fromLocation: true,
          toLocation: true,
          startDate: true,
          customerVehicleMake: true,
          customerVehicleRegistration: true,
          customerVehicleVin: true,
          customerVehicleEngine: true,
          customerVehicleStock: true,
          vehicleCondition: true,
          customer: { select: { id: true, name: true } },
          driver:   { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      prisma.quotation.findMany({
        where: {
          OR: [
            { number:   like },
            { customer: { name: like } },
            { items:    { some: { OR: [{ registration: like }, { description: like }] } } },
          ],
        },
        select: {
          id: true,
          number: true,
          status: true,
          pickup: true,
          dropoff: true,
          createdAt: true,
          customer: { select: { id: true, name: true } },
          items: { select: { description: true, registration: true, vehicleCondition: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      prisma.invoice.findMany({
        where: { number: like },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          customerId: true,
          vehicleDescription: true,
          vehicleCondition: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      prisma.customer.findMany({
        where: { name: like },
        select: { id: true, name: true, email: true, phone: true },
        take: 10,
      }),

      prisma.driver.findMany({
        where: { name: like },
        select: { id: true, name: true, mobile: true, email: true },
        take: 10,
      }),
    ]);

    // Enrich invoices with customer name
    const customerIds = [...new Set(invoices.map(i => i.customerId))];
    const invoiceCustomers = customerIds.length
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true },
        })
      : [];
    const customerMap = Object.fromEntries(invoiceCustomers.map(c => [c.id, c]));
    const enrichedInvoices = invoices.map(inv => ({ ...inv, customer: customerMap[inv.customerId] ?? null }));

    const total = trips.length + quotations.length + enrichedInvoices.length + customers.length + drivers.length;

    res.json({
      query: q,
      results: { trips, quotations, invoices: enrichedInvoices, customers, drivers },
      total,
    });
  } catch (e) { next(e); }
});

export default router;
