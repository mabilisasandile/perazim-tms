import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

const tripSelect = {
  id: true,
  trackingCode: true,
  status: true,
  fromLocation: true,
  toLocation: true,
  startDate: true,
  endDate: true,
  customerVehicleRegistration: true,
  customerVehicleMake: true,
  customerVehicleVin: true,
  customer: { select: { id: true, name: true, phone: true, email: true } },
  driver:   { select: { id: true, name: true, mobile: true } },
};

export const collectionsService = {
  async findAll() {
    return prisma.customerCollection.findMany({
      include: { trip: { select: tripSelect } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: number) {
    const rec = await prisma.customerCollection.findUnique({
      where: { id },
      include: { trip: { select: tripSelect } },
    });
    if (!rec) throw new AppError('Collection record not found', 404);
    return rec;
  },

  async findByTripId(tripId: number) {
    return prisma.customerCollection.findUnique({
      where: { tripId },
      include: { trip: { select: tripSelect } },
    });
  },

  async create(data: {
    tripId:              number;
    collectorFirstName:  string;
    collectorLastName:   string;
    collectorPhone:      string;
    collectorEmail?:     string;
    relationshipToOwner?: string;
    idType:              string;
    idNumber:            string;
    signature:           string;
    gpsLatitude?:        number;
    gpsLongitude?:       number;
    gpsAccuracy?:        number;
    collectedAt?:        Date;
    notes?:              string;
  }) {
    const existing = await prisma.customerCollection.findUnique({ where: { tripId: data.tripId } });
    if (existing) throw new AppError('A collection record already exists for this trip', 409);

    return prisma.customerCollection.create({
      data,
      include: { trip: { select: tripSelect } },
    });
  },

  async setIdPhoto(id: number, path: string) {
    return prisma.customerCollection.update({
      where: { id },
      data: { idPhotoPath: path },
      include: { trip: { select: tripSelect } },
    });
  },

  async setSelfie(id: number, path: string) {
    return prisma.customerCollection.update({
      where: { id },
      data: { selfiePath: path },
      include: { trip: { select: tripSelect } },
    });
  },

  async remove(id: number) {
    await this.findById(id);
    return prisma.customerCollection.delete({ where: { id } });
  },
};
