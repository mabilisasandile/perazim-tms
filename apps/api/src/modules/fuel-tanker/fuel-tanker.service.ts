import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateTankerDto, UpdateTankerDto,
  CreateCompartmentDto, UpdateCompartmentDto,
  CreateDeliveryDto, UpdateDeliveryStatusDto, UpdateStopDto,
  CreateLoadDto,
} from './fuel-tanker.schema';

export const fuelTankerService = {
  // ─── Tankers ────────────────────────────────────────────────────────────────

  async findAllTankers() {
    return prisma.fuelTanker.findMany({
      include: {
        compartments: { orderBy: { compartmentNo: 'asc' } },
        _count: { select: { deliveries: true, loads: true } },
      },
      orderBy: { name: 'asc' },
    });
  },

  async findTankerById(id: number) {
    const tanker = await prisma.fuelTanker.findUnique({
      where: { id },
      include: {
        compartments: { orderBy: { compartmentNo: 'asc' } },
        deliveries: {
          include: { stops: { orderBy: { order: 'asc' } } },
          orderBy: { plannedDate: 'desc' },
          take: 10,
        },
        loads: { orderBy: { loadDate: 'desc' }, take: 20 },
      },
    });
    if (!tanker) throw new AppError('Tanker not found', 404);
    return tanker;
  },

  async createTanker(data: CreateTankerDto) {
    return prisma.fuelTanker.create({ data });
  },

  async updateTanker(id: number, data: UpdateTankerDto) {
    const tanker = await prisma.fuelTanker.findUnique({ where: { id } });
    if (!tanker) throw new AppError('Tanker not found', 404);
    return prisma.fuelTanker.update({ where: { id }, data });
  },

  async deleteTanker(id: number) {
    const tanker = await prisma.fuelTanker.findUnique({ where: { id } });
    if (!tanker) throw new AppError('Tanker not found', 404);
    return prisma.fuelTanker.delete({ where: { id } });
  },

  // ─── Compartments (Tank Allocation) ─────────────────────────────────────────

  async createCompartment(data: CreateCompartmentDto) {
    const tanker = await prisma.fuelTanker.findUnique({ where: { id: data.tankerId } });
    if (!tanker) throw new AppError('Tanker not found', 404);

    const existing = await prisma.tankerCompartment.findUnique({
      where: { tankerId_compartmentNo: { tankerId: data.tankerId, compartmentNo: data.compartmentNo } },
    });
    if (existing) throw new AppError(`Compartment ${data.compartmentNo} already exists on this tanker`, 409);

    return prisma.tankerCompartment.create({ data });
  },

  async updateCompartment(id: number, data: UpdateCompartmentDto) {
    const c = await prisma.tankerCompartment.findUnique({ where: { id } });
    if (!c) throw new AppError('Compartment not found', 404);
    return prisma.tankerCompartment.update({ where: { id }, data });
  },

  async deleteCompartment(id: number) {
    const c = await prisma.tankerCompartment.findUnique({ where: { id } });
    if (!c) throw new AppError('Compartment not found', 404);
    return prisma.tankerCompartment.delete({ where: { id } });
  },

  // ─── Deliveries (Route Planning + Tracking) ──────────────────────────────────

  async findAllDeliveries(tankerId?: number, status?: string) {
    return prisma.tankerDelivery.findMany({
      where: {
        ...(tankerId ? { tankerId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        tanker: { select: { id: true, name: true, registrationNo: true } },
        stops: { orderBy: { order: 'asc' } },
      },
      orderBy: { plannedDate: 'desc' },
    });
  },

  async findDeliveryById(id: number) {
    const delivery = await prisma.tankerDelivery.findUnique({
      where: { id },
      include: {
        tanker: { select: { id: true, name: true, registrationNo: true, totalCapacity: true } },
        stops: { orderBy: { order: 'asc' } },
      },
    });
    if (!delivery) throw new AppError('Delivery not found', 404);
    return delivery;
  },

  async createDelivery(data: CreateDeliveryDto) {
    const count = await prisma.tankerDelivery.count();
    const reference = `TDL-${String(count + 1).padStart(5, '0')}`;

    const { stops, plannedDate, ...rest } = data;
    return prisma.tankerDelivery.create({
      data: {
        ...rest,
        reference,
        plannedDate: new Date(plannedDate),
        stops: { create: stops },
      },
      include: { stops: { orderBy: { order: 'asc' } } },
    });
  },

  async updateDeliveryStatus(id: number, data: UpdateDeliveryStatusDto) {
    const delivery = await this.findDeliveryById(id);
    const updateData: Record<string, unknown> = { status: data.status };

    if (data.status === 'IN_TRANSIT' && !delivery.departedAt) {
      updateData.departedAt = new Date();
    }
    if (data.status === 'COMPLETED' && !delivery.completedAt) {
      updateData.completedAt = new Date();
    }

    return prisma.tankerDelivery.update({ where: { id }, data: updateData });
  },

  async updateStop(deliveryId: number, stopId: number, data: UpdateStopDto) {
    const stop = await prisma.tankerDeliveryStop.findFirst({
      where: { id: stopId, deliveryId },
    });
    if (!stop) throw new AppError('Stop not found', 404);

    return prisma.tankerDeliveryStop.update({
      where: { id: stopId },
      data: {
        status: data.status,
        deliveredVolume: data.deliveredVolume ?? stop.deliveredVolume,
        notes: data.notes ?? stop.notes,
        deliveredAt: data.status === 'DELIVERED' ? new Date() : stop.deliveredAt,
      },
    });
  },

  async deleteDelivery(id: number) {
    const delivery = await this.findDeliveryById(id);
    if (!['PLANNED', 'CANCELLED'].includes(delivery.status)) {
      throw new AppError('Only PLANNED or CANCELLED deliveries can be deleted', 400);
    }
    return prisma.tankerDelivery.delete({ where: { id } });
  },

  // ─── Loads (Load Management) ─────────────────────────────────────────────────

  async findAllLoads(tankerId?: number) {
    return prisma.tankerLoad.findMany({
      where: tankerId ? { tankerId } : undefined,
      include: {
        tanker: { select: { id: true, name: true, registrationNo: true } },
      },
      orderBy: { loadDate: 'desc' },
    });
  },

  async createLoad(data: CreateLoadDto) {
    const { tankerId, pricePerLitre, loadDate, ...rest } = data;
    const totalCost = rest.volume * pricePerLitre;
    return prisma.tankerLoad.create({
      data: {
        ...rest,
        tankerId,
        pricePerLitre,
        totalCost,
        loadDate: new Date(loadDate),
      },
      include: { tanker: { select: { id: true, name: true, registrationNo: true } } },
    });
  },

  async deleteLoad(id: number) {
    const load = await prisma.tankerLoad.findUnique({ where: { id } });
    if (!load) throw new AppError('Load record not found', 404);
    return prisma.tankerLoad.delete({ where: { id } });
  },
};
