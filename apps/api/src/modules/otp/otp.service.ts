import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { settingsService } from '../settings/settings.service';
import { notificationService } from '../notifications/notification.service';

const OTP_EXPIRY_MINUTES = 15;
const MAX_ATTEMPTS = 5;

export const otpService = {
  async send(tripId: number) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { customer: { select: { name: true, email: true, phone: true } } },
    });
    if (!trip) throw new AppError('Trip not found', 404);
    if (trip.status === 'COMPLETED') throw new AppError('Trip is already completed', 400);
    if (trip.status === 'CANCELLED') throw new AppError('Trip is cancelled', 400);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.deliveryOtp.upsert({
      where: { tripId },
      create: {
        tripId,
        codeHash,
        sentTo: trip.customer.email,
        expiresAt,
      },
      update: {
        codeHash,
        sentTo: trip.customer.email,
        expiresAt,
        verified: false,
        verifiedAt: null,
        attempts: 0,
        bypassedBy: null,
        bypassedAt: null,
        bypassReason: null,
      },
    });

    await this.sendEmail(trip.customer.email, trip.customer.name, code, trip.trackingCode);
    // Also send via SMS/WhatsApp if configured (fire-and-forget; email already sent above)
    notificationService.dispatchOtpChannels(
      (trip.customer as any).phone ?? null, code, trip.trackingCode, tripId,
    ).catch(() => {});

    return { sentTo: trip.customer.email, expiresAt };
  },

  async verify(tripId: number, code: string) {
    const otp = await prisma.deliveryOtp.findUnique({ where: { tripId } });
    if (!otp) throw new AppError('No OTP found for this trip. Please send one first.', 404);
    if (otp.verified) return { status: 'verified' };
    if (otp.bypassedAt) return { status: 'bypassed' };

    if (otp.attempts >= MAX_ATTEMPTS) {
      throw new AppError('Too many failed attempts. Please request a new OTP.', 429);
    }
    if (new Date() > otp.expiresAt) {
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }

    const match = await bcrypt.compare(code, otp.codeHash);
    if (!match) {
      await prisma.deliveryOtp.update({
        where: { tripId },
        data: { attempts: { increment: 1 } },
      });
      const remaining = MAX_ATTEMPTS - (otp.attempts + 1);
      throw new AppError(
        remaining > 0
          ? `Invalid OTP code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
          : 'Invalid OTP code. No attempts remaining — please request a new OTP.',
        400,
      );
    }

    await prisma.deliveryOtp.update({
      where: { tripId },
      data: { verified: true, verifiedAt: new Date() },
    });

    return { status: 'verified' };
  },

  async bypass(tripId: number, userId: number, reason: string) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new AppError('Trip not found', 404);
    if (trip.status === 'CANCELLED') throw new AppError('Trip is cancelled', 400);

    await prisma.deliveryOtp.upsert({
      where: { tripId },
      create: {
        tripId,
        codeHash: 'bypassed',
        sentTo: 'bypass',
        expiresAt: new Date(),
        bypassedBy: userId,
        bypassedAt: new Date(),
        bypassReason: reason,
      },
      update: {
        bypassedBy: userId,
        bypassedAt: new Date(),
        bypassReason: reason,
      },
    });

    return { status: 'bypassed' };
  },

  async getStatus(tripId: number) {
    const otp = await prisma.deliveryOtp.findUnique({ where: { tripId } });
    if (!otp) return { status: 'none' };

    if (otp.bypassedAt) {
      return {
        status: 'bypassed',
        bypassReason: otp.bypassReason,
        bypassedAt: otp.bypassedAt,
      };
    }
    if (otp.verified) {
      return { status: 'verified', verifiedAt: otp.verifiedAt };
    }
    if (new Date() > otp.expiresAt) {
      return { status: 'expired', sentTo: otp.sentTo };
    }
    return {
      status: 'pending',
      sentTo: otp.sentTo,
      expiresAt: otp.expiresAt,
      attempts: otp.attempts,
    };
  },

  async isAuthorised(tripId: number): Promise<boolean> {
    const otp = await prisma.deliveryOtp.findUnique({ where: { tripId } });
    if (!otp) return false;
    return otp.verified || !!otp.bypassedAt;
  },

  async sendEmail(toEmail: string, customerName: string, code: string, trackingCode: string) {
    const smtp = await settingsService.getSmtp();
    if (!smtp) return; // silently skip if SMTP not configured

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.username, pass: smtp.password },
    });

    await transporter.sendMail({
      from: smtp.fromEmail,
      to: toEmail,
      subject: `Delivery Verification Code — ${trackingCode}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff;">
          <h2 style="color:#1e3a8a;margin-top:0;">Delivery Verification</h2>
          <p style="color:#374151;">Dear <strong>${customerName}</strong>,</p>
          <p style="color:#374151;">Your vehicle is being delivered. Please provide the OTP below to the driver to confirm you authorise this handover:</p>
          <div style="background:#eff6ff;border:2px solid #1e40af;border-radius:12px;padding:28px;text-align:center;margin:24px 0;">
            <p style="font-size:40px;font-weight:bold;letter-spacing:10px;color:#1e40af;margin:0;">${code}</p>
            <p style="color:#6b7280;font-size:12px;margin:8px 0 0;">Valid for ${OTP_EXPIRY_MINUTES} minutes</p>
          </div>
          <p style="color:#dc2626;font-size:13px;border-left:3px solid #dc2626;padding-left:10px;margin:16px 0;">
            <strong>Do not share this code</strong> unless you are at the delivery location and authorising the handover.
          </p>
          <p style="color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:12px;margin-top:20px;">
            Tracking Reference: <strong>${trackingCode}</strong> &nbsp;·&nbsp; Perazim TMS
          </p>
        </div>
      `,
    });
  },
};
