import { format } from 'date-fns';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { notificationService } from '../notifications/notification.service';
import type {
  CreateLoadSheetInput,
  UpdateLoadSheetInput,
  AddVehicleInput,
  UpdateVehicleStatusInput,
} from './loadsheets.schema';

// ─── shared include shapes ────────────────────────────────────────────────────

const TRUCK_SELECT = { id: true, name: true, registrationNo: true };
const TRAILER_SELECT = { id: true, registrationNo: true, make: true };
const DRIVER_SELECT = { id: true, name: true, mobile: true, email: true };
const TRIP_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true, email: true } },
  vehicle:  { select: { id: true, name: true, registrationNo: true } },
};
const VEHICLE_INCLUDE = {
  trip: { include: TRIP_INCLUDE },
};
const FULL_INCLUDE = {
  truck:    { select: TRUCK_SELECT },
  trailer:  { select: TRAILER_SELECT },
  driver:   { select: DRIVER_SELECT },
  vehicles: { include: VEHICLE_INCLUDE, orderBy: { assignedAt: 'asc' as const } },
};

// ─── load-sheet number ────────────────────────────────────────────────────────

async function generateLoadSheetNo(): Promise<string> {
  const datePart = format(new Date(), 'yyyyMMdd');
  const prefix = `LS-${datePart}-`;

  const last = await prisma.truckLoadSheet.findFirst({
    where: { loadSheetNo: { startsWith: prefix } },
    orderBy: { loadSheetNo: 'desc' },
    select: { loadSheetNo: true },
  });

  const seq = last
    ? parseInt(last.loadSheetNo.split('-').pop() ?? '0', 10) + 1
    : 1;

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getOrThrow(id: number) {
  const ls = await prisma.truckLoadSheet.findUnique({
    where: { id },
    include: FULL_INCLUDE,
  });
  if (!ls) throw new AppError('Load sheet not found', 404);
  return ls;
}

async function getVehicleOrThrow(vehicleId: number) {
  const v = await prisma.truckLoadSheetVehicle.findUnique({
    where: { id: vehicleId },
    include: { loadSheet: true, trip: { include: TRIP_INCLUDE } },
  });
  if (!v) throw new AppError('Load sheet vehicle not found', 404);
  return v;
}

async function autoCompleteLoadSheet(loadSheetId: number): Promise<void> {
  const ls = await prisma.truckLoadSheet.findUnique({
    where: { id: loadSheetId },
    include: { vehicles: { select: { status: true } } },
  });
  if (!ls || ls.status === 'COMPLETED' || ls.status === 'CANCELLED') return;

  const allDone = ls.vehicles.length > 0 && ls.vehicles.every(v => v.status === 'COMPLETED');
  if (allDone) {
    await prisma.truckLoadSheet.update({
      where: { id: loadSheetId },
      data:  { status: 'COMPLETED', completedAt: new Date() },
    });
  }
}

// ─── service ──────────────────────────────────────────────────────────────────

export const loadsheetsService = {

  // ── list ────────────────────────────────────────────────────────────────────

  async findAll(filters: {
    status?:   string;
    driverId?: number;
    truckId?:  number;
    from?:     string;
    to?:       string;
    page?:     number;
    limit?:    number;
  }) {
    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 50;
    const where: any = {};

    if (filters.status)   where.status   = filters.status;
    if (filters.driverId) where.driverId = filters.driverId;
    if (filters.truckId)  where.truckId  = filters.truckId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to)   where.createdAt.lte = new Date(filters.to);
    }

    const [total, items] = await Promise.all([
      prisma.truckLoadSheet.count({ where }),
      prisma.truckLoadSheet.findMany({
        where,
        include: {
          truck:    { select: TRUCK_SELECT },
          trailer:  { select: TRAILER_SELECT },
          driver:   { select: DRIVER_SELECT },
          vehicles: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
    ]);

    return { total, page, limit, data: items };
  },

  // ── single ──────────────────────────────────────────────────────────────────

  async findById(id: number) {
    return getOrThrow(id);
  },

  // ── create ──────────────────────────────────────────────────────────────────

  async create(input: CreateLoadSheetInput) {
    const loadSheetNo = await generateLoadSheetNo();

    const ls = await prisma.truckLoadSheet.create({
      data: {
        loadSheetNo,
        truckId:   input.truckId,
        trailerId: input.trailerId ?? null,
        driverId:  input.driverId,
        route:     input.route,
        capacity:  input.capacity,
        notes:     input.notes ?? null,
      },
      include: FULL_INCLUDE,
    });

    // Notify driver
    notificationService.dispatch('DISPATCH_ASSIGNMENT', {
      trip:   { trackingCode: ls.loadSheetNo, driver: ls.driver },
    }).catch(() => {});

    return ls;
  },

  // ── update header ────────────────────────────────────────────────────────────

  async update(id: number, input: UpdateLoadSheetInput) {
    const ls = await getOrThrow(id);
    if (ls.status === 'COMPLETED' || ls.status === 'CANCELLED') {
      throw new AppError('Cannot edit a completed or cancelled load sheet', 400);
    }

    return prisma.truckLoadSheet.update({
      where: { id },
      data: {
        ...(input.trailerId !== undefined ? { trailerId: input.trailerId } : {}),
        ...(input.route    ? { route: input.route }       : {}),
        ...(input.capacity ? { capacity: input.capacity } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: FULL_INCLUDE,
    });
  },

  // ── update status ────────────────────────────────────────────────────────────

  async updateStatus(id: number, status: 'OPEN' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED') {
    const ls = await getOrThrow(id);

    if (ls.status === status) return ls;
    if (ls.status === 'COMPLETED') throw new AppError('Load sheet is already completed', 400);
    if (ls.status === 'CANCELLED') throw new AppError('Load sheet is cancelled', 400);

    const data: any = { status };
    if (status === 'COMPLETED') data.completedAt  = new Date();
    if (status === 'CANCELLED') data.cancelledAt  = new Date();
    if (status === 'IN_TRANSIT') data.dispatchedAt = new Date();

    return prisma.truckLoadSheet.update({ where: { id }, data, include: FULL_INCLUDE });
  },

  // ── add vehicle ──────────────────────────────────────────────────────────────

  async addVehicle(loadSheetId: number, input: AddVehicleInput) {
    const ls = await getOrThrow(loadSheetId);

    if (ls.status === 'COMPLETED' || ls.status === 'CANCELLED') {
      throw new AppError('Cannot add vehicles to a completed or cancelled load sheet', 400);
    }

    // check capacity
    if (ls.vehicles.length >= ls.capacity) {
      throw new AppError(
        `Truck is at capacity (${ls.capacity} vehicles). Cannot add more vehicles.`,
        400,
      );
    }

    // ensure trip not already on a load sheet
    const existing = await prisma.truckLoadSheetVehicle.findUnique({ where: { tripId: input.tripId } });
    if (existing) throw new AppError('This trip is already assigned to a load sheet', 409);

    // ensure trip exists
    const trip = await prisma.trip.findUnique({
      where: { id: input.tripId },
      include: { customer: true, vehicle: true, driver: true },
    });
    if (!trip) throw new AppError('Trip not found', 404);

    const lsVehicle = await prisma.truckLoadSheetVehicle.create({
      data: {
        loadSheetId,
        tripId:          input.tripId,
        pickupLocation:  input.pickupLocation,
        deliveryLocation: input.deliveryLocation,
        vehicleCondition: input.vehicleCondition ?? null,
        status:          'YET_TO_START',
        assignedAt:      new Date(),
      },
      include: VEHICLE_INCLUDE,
    });

    // Auto-transition load sheet to IN_TRANSIT if it was OPEN and now has vehicles in motion
    // (stays OPEN until dispatch confirms)

    return lsVehicle;
  },

  // ── update vehicle status ────────────────────────────────────────────────────

  async updateVehicleStatus(
    vehicleId: number,
    input: UpdateVehicleStatusInput,
    actorUsername: string,
  ) {
    const lsv = await getVehicleOrThrow(vehicleId);

    if (lsv.loadSheet.status === 'CANCELLED') {
      throw new AppError('Load sheet is cancelled', 400);
    }

    const now = new Date();
    const data: any = { status: input.status };

    if (input.status === 'ONGOING'    && !lsv.pickedUpAt)  data.pickedUpAt  = now;
    if (input.status === 'COMPLETED'  && !lsv.deliveredAt) data.deliveredAt = now;

    const updated = await prisma.truckLoadSheetVehicle.update({
      where:   { id: vehicleId },
      data,
      include: VEHICLE_INCLUDE,
    });

    // transition load sheet to IN_TRANSIT on first pickup
    if (input.status === 'ONGOING' && lsv.loadSheet.status === 'OPEN') {
      await prisma.truckLoadSheet.update({
        where: { id: lsv.loadSheetId },
        data:  { status: 'IN_TRANSIT', dispatchedAt: now },
      });
    }

    // auto-complete when all vehicles are done
    if (input.status === 'COMPLETED') {
      await autoCompleteLoadSheet(lsv.loadSheetId);
    }

    return updated;
  },

  // ── remove vehicle ───────────────────────────────────────────────────────────

  async removeVehicle(vehicleId: number) {
    const lsv = await getVehicleOrThrow(vehicleId);

    if (lsv.status !== 'YET_TO_START') {
      throw new AppError('Cannot remove a vehicle that is already in transit or delivered', 400);
    }

    await prisma.truckLoadSheetVehicle.delete({ where: { id: vehicleId } });
  },

  // ── remove load sheet ────────────────────────────────────────────────────────

  async remove(id: number) {
    const ls = await getOrThrow(id);
    if (ls.status === 'IN_TRANSIT') {
      throw new AppError('Cannot delete a load sheet that is in transit. Cancel it first.', 400);
    }
    await prisma.truckLoadSheet.delete({ where: { id } });
  },

  // ── dashboard ────────────────────────────────────────────────────────────────

  async getDashboard() {
    const [
      openSheets,
      inTransitSheets,
      completedSheets,
      cancelledSheets,
      yetToStart,
      ongoing,
      delivered,
    ] = await Promise.all([
      prisma.truckLoadSheet.count({ where: { status: 'OPEN' } }),
      prisma.truckLoadSheet.count({ where: { status: 'IN_TRANSIT' } }),
      prisma.truckLoadSheet.count({ where: { status: 'COMPLETED' } }),
      prisma.truckLoadSheet.count({ where: { status: 'CANCELLED' } }),
      prisma.truckLoadSheetVehicle.count({ where: { status: 'YET_TO_START' } }),
      prisma.truckLoadSheetVehicle.count({ where: { status: 'ONGOING' } }),
      prisma.truckLoadSheetVehicle.count({ where: { status: 'COMPLETED' } }),
    ]);

    // active drivers (on in-transit load sheets)
    const activeDrivers = await prisma.truckLoadSheet.groupBy({
      by: ['driverId'],
      where: { status: 'IN_TRANSIT' },
    });

    // completed trips per driver (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const driverTrips = await prisma.truckLoadSheet.groupBy({
      by: ['driverId'],
      where: { status: 'COMPLETED', completedAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
    });

    // driver names for the trip stats
    const driverIds = driverTrips.map(d => d.driverId);
    const drivers   = driverIds.length
      ? await prisma.driver.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true } })
      : [];
    const driverMap = new Map(drivers.map(d => [d.id, d.name]));

    const deliveriesPerDriver = driverTrips.map(d => ({
      driverId:   d.driverId,
      driverName: driverMap.get(d.driverId) ?? 'Unknown',
      trips:      d._count.id,
    }));

    // truck utilisation (active trucks vs total)
    const [trucksInUse, totalTrucks] = await Promise.all([
      prisma.truckLoadSheet.groupBy({ by: ['truckId'], where: { status: 'IN_TRANSIT' } }),
      prisma.vehicle.count({ where: { isActive: true } }),
    ]);

    return {
      loadSheets: {
        open:        openSheets,
        inTransit:   inTransitSheets,
        completed:   completedSheets,
        cancelled:   cancelledSheets,
      },
      vehicles: {
        yetToStart: yetToStart,
        inTransit:  ongoing,
        delivered:  delivered,
      },
      drivers: {
        active:             activeDrivers.length,
        deliveriesPerDriver,
      },
      fleet: {
        totalTrucks,
        trucksInUse: trucksInUse.length,
        utilizationPct: totalTrucks > 0
          ? Math.round((trucksInUse.length / totalTrucks) * 100)
          : 0,
      },
    };
  },

  // ── PDF ─────────────────────────────────────────────────────────────────────

  async generatePdfHtml(id: number): Promise<string> {
    const ls = await getOrThrow(id);

    const statusBadge = (s: string) => {
      const colours: Record<string, string> = {
        OPEN:         '#2563eb',
        IN_TRANSIT:   '#d97706',
        COMPLETED:    '#16a34a',
        CANCELLED:    '#dc2626',
        YET_TO_START: '#6b7280',
        ONGOING:      '#d97706',
      };
      return `<span style="background:${colours[s] ?? '#6b7280'};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">${s.replace('_', ' ')}</span>`;
    };

    const rows = ls.vehicles.map((v: any) => `
      <tr>
        <td>${v.trip?.trackingCode ?? '-'}</td>
        <td>${v.trip?.customerVehicleVin ?? '-'}</td>
        <td>${v.trip?.customerVehicleEngine ?? '-'}</td>
        <td>${v.trip?.customerVehicleRegistration ?? '-'}</td>
        <td>${v.trip?.customerVehicleStock ?? '-'}</td>
        <td>${v.trip?.customer?.name ?? '-'}</td>
        <td>${v.pickupLocation}</td>
        <td>${v.deliveryLocation}</td>
        <td>${v.vehicleCondition ?? '-'}</td>
        <td>${statusBadge(v.status)}</td>
      </tr>`).join('');

    const completedCount  = ls.vehicles.filter((v: any) => v.status === 'COMPLETED').length;
    const ongoingCount    = ls.vehicles.filter((v: any) => v.status === 'ONGOING').length;
    const yetToStartCount = ls.vehicles.filter((v: any) => v.status === 'YET_TO_START').length;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Load Sheet ${ls.loadSheetNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; padding: 24px; }
    h1 { font-size: 20px; color: #1e3a8a; margin-bottom: 4px; }
    .subtitle { color: #6b7280; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
    .card h3 { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; letter-spacing: .5px; }
    .card dl { display: grid; grid-template-columns: 120px 1fr; row-gap: 4px; }
    .card dt { color: #9ca3af; }
    .card dd { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #1e3a8a; color: #fff; }
    th { padding: 6px 8px; text-align: left; font-size: 11px; }
    td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
    tr:nth-child(even) td { background: #f9fafb; }
    .summary { border-top: 2px solid #e5e7eb; padding-top: 12px; display: flex; gap: 24px; }
    .stat { text-align: center; }
    .stat-val { font-size: 22px; font-weight: 700; color: #1e3a8a; }
    .stat-lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; }
    .footer { margin-top: 32px; color: #9ca3af; font-size: 10px; border-top: 1px solid #f3f4f6; padding-top: 8px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>Load Sheet</h1>
  <p class="subtitle">${ls.loadSheetNo} &nbsp;·&nbsp; ${statusBadge(ls.status)}</p>

  <div class="grid">
    <div class="card">
      <h3>Dispatch Information</h3>
      <dl>
        <dt>Load Sheet No</dt><dd>${ls.loadSheetNo}</dd>
        <dt>Route</dt><dd>${ls.route}</dd>
        <dt>Status</dt><dd>${ls.status.replace('_', ' ')}</dd>
        <dt>Created</dt><dd>${ls.createdAt.toLocaleDateString()} ${ls.createdAt.toLocaleTimeString()}</dd>
        ${ls.dispatchedAt ? `<dt>Dispatched</dt><dd>${ls.dispatchedAt.toLocaleDateString()} ${ls.dispatchedAt.toLocaleTimeString()}</dd>` : ''}
        ${ls.completedAt  ? `<dt>Completed</dt><dd>${ls.completedAt.toLocaleDateString()} ${ls.completedAt.toLocaleTimeString()}</dd>` : ''}
      </dl>
    </div>
    <div class="card">
      <h3>Truck &amp; Driver</h3>
      <dl>
        <dt>Driver</dt><dd>${(ls.driver as any).name}</dd>
        <dt>Driver Mobile</dt><dd>${(ls.driver as any).mobile}</dd>
        <dt>Truck Reg</dt><dd>${(ls.truck as any).registrationNo}</dd>
        <dt>Truck Name</dt><dd>${(ls.truck as any).name}</dd>
        ${ls.trailer ? `<dt>Trailer Reg</dt><dd>${(ls.trailer as any).registrationNo}</dd>` : ''}
        <dt>Capacity</dt><dd>${ls.vehicles.length} / ${ls.capacity} vehicles</dd>
      </dl>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Booking #</th>
        <th>VIN</th>
        <th>Engine #</th>
        <th>Reg #</th>
        <th>Stock #</th>
        <th>Customer</th>
        <th>Pickup</th>
        <th>Delivery</th>
        <th>Condition</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="10" style="text-align:center;color:#9ca3af;">No vehicles assigned</td></tr>'}</tbody>
  </table>

  <div class="summary">
    <div class="stat"><div class="stat-val">${ls.vehicles.length}</div><div class="stat-lbl">Total Vehicles</div></div>
    <div class="stat"><div class="stat-val">${yetToStartCount}</div><div class="stat-lbl">Yet To Start</div></div>
    <div class="stat"><div class="stat-val">${ongoingCount}</div><div class="stat-lbl">In Transit</div></div>
    <div class="stat"><div class="stat-val">${completedCount}</div><div class="stat-lbl">Delivered</div></div>
    <div class="stat"><div class="stat-val">${ls.capacity}</div><div class="stat-lbl">Capacity</div></div>
    <div class="stat"><div class="stat-val">${ls.capacity > 0 ? Math.round((ls.vehicles.length / ls.capacity) * 100) : 0}%</div><div class="stat-lbl">Utilisation</div></div>
  </div>

  <div class="footer">
    Generated by Perazim TMS &nbsp;·&nbsp; ${new Date().toLocaleString()}
    ${ls.notes ? `<br/>Notes: ${ls.notes}` : ''}
  </div>
</body>
</html>`;
  },
};
