import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateWarehouseDto, UpdateWarehouseDto,
  AllocateVehicleDto, UpdateVehicleStatusDto, TransferVehicleDto,
} from './warehouses.schema';

const vehicleInclude = {
  warehouse: { select: { id: true, name: true, location: true } },
  trip: {
    select: {
      id: true, trackingCode: true, status: true,
      fromLocation: true, toLocation: true,
      customerVehicleRegistration: true,
      customerVehicleVin: true,
      customerVehicleEngine: true,
      customerVehicleStock: true,
      customerVehicleMake: true,
      customerVehicleColour: true,
      vehicleCondition: true,
      customer: { select: { id: true, name: true, phone: true } },
    },
  },
  transfers: {
    orderBy: { transferredAt: 'desc' as const },
    include: {
      fromWarehouse: { select: { id: true, name: true } },
      toWarehouse:   { select: { id: true, name: true } },
    },
  },
};

export const warehousesService = {
  // ── Warehouse CRUD ───────────────────────────────────────────────

  async findAll() {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        _count: { select: { vehicles: true } },
        vehicles: { where: { status: { not: 'DISPATCHED' } }, select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });
    return warehouses.map(w => ({
      ...w,
      stored:     w.vehicles.length,
      occupancy:  Math.round((w.vehicles.length / w.capacity) * 100),
    }));
  },

  async findById(id: number) {
    const w = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        vehicles: {
          where: { status: { not: 'DISPATCHED' } },
          include: vehicleInclude,
          orderBy: { arrivedAt: 'asc' },
        },
        _count: { select: { vehicles: true } },
      },
    });
    if (!w) throw new AppError('Warehouse not found', 404);
    return { ...w, stored: w.vehicles.length, occupancy: Math.round((w.vehicles.length / w.capacity) * 100) };
  },

  async create(data: CreateWarehouseDto) {
    return prisma.warehouse.create({ data });
  },

  async update(id: number, data: UpdateWarehouseDto) {
    await this.findById(id);
    return prisma.warehouse.update({ where: { id }, data });
  },

  async remove(id: number) {
    const w = await prisma.warehouse.findUnique({
      where: { id },
      include: { _count: { select: { vehicles: true } } },
    });
    if (!w) throw new AppError('Warehouse not found', 404);
    if (w._count.vehicles > 0)
      throw new AppError('Cannot delete a warehouse that has vehicles. Remove vehicles first.', 409);
    return prisma.warehouse.delete({ where: { id } });
  },

  // ── Vehicle Allocation ───────────────────────────────────────────

  async allocate(warehouseId: number, data: AllocateVehicleDto) {
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new AppError('Warehouse not found', 404);

    const activeCount = await prisma.warehouseVehicle.count({
      where: { warehouseId, status: { not: 'DISPATCHED' } },
    });
    if (activeCount >= warehouse.capacity)
      throw new AppError(`Warehouse is at full capacity (${warehouse.capacity} vehicles).`, 409);

    const trip = await prisma.trip.findUnique({ where: { id: data.tripId } });
    if (!trip) throw new AppError('Trip not found', 404);

    const existing = await prisma.warehouseVehicle.findUnique({ where: { tripId: data.tripId } });
    if (existing)
      throw new AppError('This trip\'s vehicle is already allocated to a warehouse.', 409);

    return prisma.warehouseVehicle.create({
      data: {
        warehouseId,
        tripId: data.tripId,
        arrivedAt: data.arrivedAt ? new Date(data.arrivedAt) : new Date(),
        notes: data.notes,
      },
      include: vehicleInclude,
    });
  },

  // ── Vehicle Status Update ────────────────────────────────────────

  async updateVehicleStatus(vehicleId: number, data: UpdateVehicleStatusDto) {
    const wv = await prisma.warehouseVehicle.findUnique({ where: { id: vehicleId } });
    if (!wv) throw new AppError('Warehouse vehicle not found', 404);
    return prisma.warehouseVehicle.update({
      where: { id: vehicleId },
      data: {
        status:      data.status,
        dispatchedAt: data.status === 'DISPATCHED'
          ? (data.dispatchedAt ? new Date(data.dispatchedAt) : new Date())
          : undefined,
        notes: data.notes ?? wv.notes,
      },
      include: vehicleInclude,
    });
  },

  // ── Vehicle Transfer ─────────────────────────────────────────────

  async transfer(vehicleId: number, data: TransferVehicleDto) {
    const wv = await prisma.warehouseVehicle.findUnique({ where: { id: vehicleId } });
    if (!wv) throw new AppError('Warehouse vehicle not found', 404);
    if (wv.warehouseId === data.toWarehouseId)
      throw new AppError('Vehicle is already in this warehouse.', 409);

    const target = await prisma.warehouse.findUnique({ where: { id: data.toWarehouseId } });
    if (!target) throw new AppError('Target warehouse not found', 404);

    const activeCount = await prisma.warehouseVehicle.count({
      where: { warehouseId: data.toWarehouseId, status: { not: 'DISPATCHED' } },
    });
    if (activeCount >= target.capacity)
      throw new AppError(`Target warehouse is at full capacity (${target.capacity} vehicles).`, 409);

    return prisma.$transaction(async (tx) => {
      await tx.warehouseTransfer.create({
        data: {
          warehouseVehicleId: vehicleId,
          fromWarehouseId:    wv.warehouseId,
          toWarehouseId:      data.toWarehouseId,
          notes:              data.notes,
        },
      });
      return tx.warehouseVehicle.update({
        where: { id: vehicleId },
        data:  { warehouseId: data.toWarehouseId, status: 'IN_STORAGE' },
        include: vehicleInclude,
      });
    });
  },

  // ── All Vehicles ─────────────────────────────────────────────────

  async findAllVehicles(filters?: { warehouseId?: number; status?: string }) {
    return prisma.warehouseVehicle.findMany({
      where: {
        warehouseId: filters?.warehouseId,
        status:      filters?.status,
      },
      include: vehicleInclude,
      orderBy: { arrivedAt: 'asc' },
    });
  },

  // ── Dashboard ────────────────────────────────────────────────────

  async getDashboard() {
    const [warehouses, allVehicles] = await Promise.all([
      prisma.warehouse.findMany({
        include: {
          vehicles: { where: { status: { not: 'DISPATCHED' } } },
        },
      }),
      prisma.warehouseVehicle.findMany({
        include: vehicleInclude,
        orderBy: { arrivedAt: 'desc' },
      }),
    ]);

    const stored    = allVehicles.filter(v => v.status === 'IN_STORAGE').length;
    const awaiting  = allVehicles.filter(v => v.status === 'AWAITING_DISPATCH').length;
    const dispatched = allVehicles.filter(v => v.status === 'DISPATCHED').length;

    const now = Date.now();
    const storedVehicles = allVehicles.filter(v => v.status !== 'DISPATCHED');
    const avgDurationDays = storedVehicles.length
      ? Math.round(storedVehicles.reduce((sum, v) => sum + (now - new Date(v.arrivedAt).getTime()), 0) / storedVehicles.length / 86400000)
      : 0;

    const warehouseStats = warehouses.map(w => ({
      id:       w.id,
      name:     w.name,
      location: w.location,
      capacity: w.capacity,
      stored:   w.vehicles.length,
      occupancy: Math.round((w.vehicles.length / w.capacity) * 100),
    }));

    const recentActivity = allVehicles.slice(0, 20);

    return { stored, awaiting, dispatched, avgDurationDays, warehouseStats, recentActivity };
  },
};
