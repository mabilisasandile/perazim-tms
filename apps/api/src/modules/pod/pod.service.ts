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

export const podService = {
  async findAll() {
    return prisma.proofOfDelivery.findMany({
      include: {
        trip:   { select: tripSelect },
        photos: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: number) {
    const pod = await prisma.proofOfDelivery.findUnique({
      where: { id },
      include: {
        trip:   { select: tripSelect },
        photos: true,
      },
    });
    if (!pod) throw new AppError('Proof of delivery not found', 404);
    return pod;
  },

  async findByTripId(tripId: number) {
    return prisma.proofOfDelivery.findUnique({
      where: { tripId },
      include: {
        trip:   { select: tripSelect },
        photos: true,
      },
    });
  },

  async create(data: {
    tripId:              number;
    receiverFirstName:   string;
    receiverLastName:    string;
    receiverPhone:       string;
    receiverEmail?:      string;
    receiverIdNumber?:   string;
    relationshipToOwner?: string;
    signature:           string;
    gpsLatitude?:        number;
    gpsLongitude?:       number;
    gpsAccuracy?:        number;
    deliveredAt?:        Date;
    notes?:              string;
  }) {
    const existing = await prisma.proofOfDelivery.findUnique({ where: { tripId: data.tripId } });
    if (existing) throw new AppError('A proof of delivery already exists for this trip', 409);

    return prisma.proofOfDelivery.create({
      data,
      include: {
        trip:   { select: tripSelect },
        photos: true,
      },
    });
  },

  async remove(id: number) {
    await this.findById(id);
    return prisma.proofOfDelivery.delete({ where: { id } });
  },

  async addPhoto(podId: number, filename: string, path: string) {
    await this.findById(podId);
    return prisma.podPhoto.create({ data: { podId, filename, path } });
  },

  async deletePhoto(id: number) {
    const photo = await prisma.podPhoto.findUnique({ where: { id } });
    if (!photo) throw new AppError('Photo not found', 404);
    return prisma.podPhoto.delete({ where: { id } });
  },
};
