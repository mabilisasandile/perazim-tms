import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { otpService } from '../otp/otp.service';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const PHOTO_DIR = path.join(process.cwd(), 'uploads', 'pod');
if (!fs.existsSync(PHOTO_DIR)) fs.mkdirSync(PHOTO_DIR, { recursive: true });

/**
 * Decodes a `data:image/...;base64,...` string captured directly in the
 * delivery wizard and saves it to disk, returning the public path.
 */
function saveBase64Photo(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new AppError('Invalid recipient photo data', 400);
  const [, ext, base64Data] = match;
  const safeExt = ext === 'jpeg' ? 'jpg' : ext;
  const filename = `receiver-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${safeExt}`;
  fs.writeFileSync(path.join(PHOTO_DIR, filename), Buffer.from(base64Data, 'base64'));
  return `/uploads/pod/${filename}`;
}

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
    identificationType?: 'ID' | 'PASSPORT';
    receiverIdNumber?:   string;
    receiverPassportNumber?: string;
    relationshipToOwner?: string;
    receiverPhotoBase64: string;
    signature:           string;
    gpsLatitude?:        number;
    gpsLongitude?:       number;
    gpsAccuracy?:        number;
    deliveredAt?:        Date;
    notes?:              string;
  }) {
    const existing = await prisma.proofOfDelivery.findUnique({ where: { tripId: data.tripId } });
    if (existing) throw new AppError('A proof of delivery already exists for this trip', 409);

    const authorised = await otpService.isAuthorised(data.tripId);
    if (!authorised) {
      throw new AppError(
        'OTP verification is required before recording proof of delivery. Send an OTP to the customer and verify it, or request an administrator bypass.',
        403,
      );
    }

    const { receiverPhotoBase64, ...rest } = data;
    const receiverPhotoPath = saveBase64Photo(receiverPhotoBase64);

    return prisma.proofOfDelivery.create({
      data: { ...rest, receiverPhotoPath },
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

  /**
   * Sets the recipient's own photograph — distinct from the general
   * delivery/vehicle photos stored in PodPhoto.
   */
  async setReceiverPhoto(podId: number, path: string) {
    await this.findById(podId);
    return prisma.proofOfDelivery.update({
      where: { id: podId },
      data: { receiverPhotoPath: path },
      include: { trip: { select: tripSelect }, photos: true },
    });
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
