import { prisma } from '../../lib/prisma';
import { CreateGateScanDto } from './gate-scans.schema';

const tripSelect = {
  id: true, trackingCode: true, status: true,
  fromLocation: true, toLocation: true, startDate: true,
  customerVehicleRegistration: true, customerVehicleMake: true,
  customerVehicleColour: true, customerVehicleVin: true,
  customerVehicleEngine: true, customerVehicleStock: true,
  vehicleCondition: true,
  customer: { select: { id: true, name: true, phone: true } },
  vehicle:  { select: { id: true, name: true, registrationNo: true } },
  driver:   { select: { id: true, name: true, mobile: true } },
};

export const gateScansService = {

  async create(data: CreateGateScanDto) {
    // Auto-resolve tripId from trackingCode if not provided
    let tripId = data.tripId;
    if (!tripId && data.trackingCode) {
      const trip = await prisma.trip.findUnique({ where: { trackingCode: data.trackingCode } });
      if (trip) tripId = trip.id;
    }

    return prisma.gateScan.create({
      data: {
        scanType:      data.scanType,
        trackingCode:  data.trackingCode,
        tripId,
        driverName:    data.driverName,
        driverLicense: data.driverLicense,
        driverPhone:   data.driverPhone,
        towTruckReg:   data.towTruckReg,
        towTruckDriver: data.towTruckDriver,
        officerName:   data.officerName,
        isApproved:    data.isApproved,
        gateName:      data.gateName,
        scannedAt:     data.scannedAt ? new Date(data.scannedAt) : new Date(),
        notes:         data.notes,
      },
      include: { trip: { select: tripSelect } },
    });
  },

  async findAll(filters?: { scanType?: string; gateName?: string; from?: string; to?: string }) {
    return prisma.gateScan.findMany({
      where: {
        scanType:  filters?.scanType  || undefined,
        gateName:  filters?.gateName  || undefined,
        scannedAt: {
          gte: filters?.from ? new Date(filters.from) : undefined,
          lte: filters?.to   ? new Date(filters.to)   : undefined,
        },
      },
      include: { trip: { select: tripSelect } },
      orderBy: { scannedAt: 'desc' },
    });
  },

  async findByTrackingCode(code: string) {
    return prisma.gateScan.findMany({
      where: { trackingCode: code },
      orderBy: { scannedAt: 'desc' },
    });
  },

  // Vehicles currently on premises: most recent scan per code is ENTRY
  async getOnPremises() {
    const all = await prisma.gateScan.findMany({
      orderBy: { scannedAt: 'desc' },
      include: { trip: { select: tripSelect } },
    });

    const latest = new Map<string, typeof all[0]>();
    for (const scan of all) {
      if (!latest.has(scan.trackingCode)) {
        latest.set(scan.trackingCode, scan);
      }
    }

    return [...latest.values()].filter(s => s.scanType === 'ENTRY');
  },

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, todayEntries, todayExits, onPremises] = await Promise.all([
      prisma.gateScan.count(),
      prisma.gateScan.count({ where: { scanType: 'ENTRY', scannedAt: { gte: today } } }),
      prisma.gateScan.count({ where: { scanType: 'EXIT',  scannedAt: { gte: today } } }),
      this.getOnPremises(),
    ]);

    return { total, todayEntries, todayExits, onPremises: onPremises.length };
  },
};
