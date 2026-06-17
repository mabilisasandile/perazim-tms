import nodemailer from 'nodemailer';
import { prisma } from '../../lib/prisma';
import { settingsService } from '../settings/settings.service';

export const NOTIFICATION_TYPES = [
  'BOOKING_UPDATE',
  'DELIVERY_UPDATE',
  'INVOICE_NOTIFICATION',
  'OTP_NOTIFICATION',
  'TRIP_ALLOCATION',
  'DISPATCH_ASSIGNMENT',
  'SCHEDULE_CHANGE',
] as const;

export type NotifType = typeof NOTIFICATION_TYPES[number];

const DRIVER_TYPES: NotifType[] = ['TRIP_ALLOCATION', 'DISPATCH_ASSIGNMENT', 'SCHEDULE_CHANGE'];

export interface NotifPayload {
  trip?: any;
  invoice?: any;
  customer?: any;
  driver?: any;
  code?: string;       // plaintext OTP code
  newStatus?: string;  // for status-change events
}

interface ChannelMessage {
  subject: string;
  html: string;
  text: string;
}

function buildMessage(type: NotifType, payload: NotifPayload): ChannelMessage {
  const t = payload.trip;
  const inv = payload.invoice;

  switch (type) {
    case 'BOOKING_UPDATE':
      return {
        subject: `Booking Confirmed — ${t?.trackingCode}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff;">
            <h2 style="color:#1e3a8a;margin-top:0;">Booking Confirmed</h2>
            <p>Dear <strong>${t?.customer?.name || 'Customer'}</strong>,</p>
            <p>Your booking has been created successfully.</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0;">
              <tr><td style="padding:6px;color:#6b7280;">Tracking Code</td><td style="padding:6px;font-weight:bold;">${t?.trackingCode}</td></tr>
              <tr><td style="padding:6px;color:#6b7280;">From</td><td style="padding:6px;">${t?.fromLocation}</td></tr>
              <tr><td style="padding:6px;color:#6b7280;">To</td><td style="padding:6px;">${t?.toLocation}</td></tr>
            </table>
            <p style="color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:12px;">Perazim TMS</p>
          </div>`,
        text: `Perazim TMS: Booking ${t?.trackingCode} from ${t?.fromLocation} to ${t?.toLocation} has been confirmed.`,
      };

    case 'DELIVERY_UPDATE':
      return {
        subject: `Delivery Update — ${t?.trackingCode}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff;">
            <h2 style="color:#1e3a8a;margin-top:0;">Delivery Update</h2>
            <p>Dear <strong>${t?.customer?.name || 'Customer'}</strong>,</p>
            <p>Your delivery <strong>${t?.trackingCode}</strong> status has been updated to <strong>${payload.newStatus || t?.status}</strong>.</p>
            <p style="color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:12px;">Perazim TMS</p>
          </div>`,
        text: `Perazim TMS: Delivery ${t?.trackingCode} is now ${payload.newStatus || t?.status}.`,
      };

    case 'INVOICE_NOTIFICATION':
      return {
        subject: `Invoice ${inv?.number} — Perazim TMS`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff;">
            <h2 style="color:#1e3a8a;margin-top:0;">Invoice Issued</h2>
            <p>Dear <strong>${inv?.customer?.name || 'Customer'}</strong>,</p>
            <p>Invoice <strong>${inv?.number}</strong> for <strong>R ${Number(inv?.total || 0).toFixed(2)}</strong> has been issued.</p>
            ${inv?.dueDate ? `<p>Due date: <strong>${new Date(inv.dueDate).toLocaleDateString()}</strong></p>` : ''}
            <p style="color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:12px;">Perazim TMS</p>
          </div>`,
        text: `Perazim TMS: Invoice ${inv?.number} for R${Number(inv?.total || 0).toFixed(2)} has been issued.`,
      };

    case 'OTP_NOTIFICATION':
      return {
        subject: `OTP — ${t?.trackingCode}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff;">
            <h2 style="color:#1e3a8a;margin-top:0;">Delivery OTP</h2>
            <p>Your OTP for trip <strong>${t?.trackingCode}</strong>:</p>
            <div style="background:#eff6ff;border:2px solid #1e40af;border-radius:12px;padding:24px;text-align:center;margin:16px 0;">
              <p style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#1e40af;margin:0;">${payload.code}</p>
              <p style="color:#6b7280;font-size:12px;margin:8px 0 0;">Valid for 15 minutes</p>
            </div>
            <p style="color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:12px;">Perazim TMS</p>
          </div>`,
        text: `Perazim TMS: Your OTP for trip ${t?.trackingCode} is ${payload.code}. Valid for 15 minutes.`,
      };

    case 'TRIP_ALLOCATION':
      return {
        subject: `Trip Assigned — ${t?.trackingCode}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff;">
            <h2 style="color:#1e3a8a;margin-top:0;">Trip Assigned</h2>
            <p>Dear <strong>${t?.driver?.name || 'Driver'}</strong>,</p>
            <p>You have been assigned to trip <strong>${t?.trackingCode}</strong>.</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0;">
              <tr><td style="padding:6px;color:#6b7280;">From</td><td style="padding:6px;">${t?.fromLocation}</td></tr>
              <tr><td style="padding:6px;color:#6b7280;">To</td><td style="padding:6px;">${t?.toLocation}</td></tr>
              ${t?.startDate ? `<tr><td style="padding:6px;color:#6b7280;">Start Date</td><td style="padding:6px;">${new Date(t.startDate).toLocaleDateString()}</td></tr>` : ''}
            </table>
            <p style="color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:12px;">Perazim TMS</p>
          </div>`,
        text: `Perazim TMS: You have been assigned to trip ${t?.trackingCode} from ${t?.fromLocation} to ${t?.toLocation}.`,
      };

    case 'DISPATCH_ASSIGNMENT':
      return {
        subject: `Trip Dispatched — ${t?.trackingCode}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff;">
            <h2 style="color:#1e3a8a;margin-top:0;">Trip Dispatched</h2>
            <p>Dear <strong>${t?.driver?.name || 'Driver'}</strong>,</p>
            <p>Trip <strong>${t?.trackingCode}</strong> is now <strong>In Progress</strong>. Please proceed to the pick-up location.</p>
            <p style="color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:12px;">Perazim TMS</p>
          </div>`,
        text: `Perazim TMS: Trip ${t?.trackingCode} is now In Progress. Please proceed to pick-up.`,
      };

    case 'SCHEDULE_CHANGE':
      return {
        subject: `Trip Updated — ${t?.trackingCode}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff;">
            <h2 style="color:#1e3a8a;margin-top:0;">Trip Schedule Updated</h2>
            <p>Dear <strong>${t?.driver?.name || 'Driver'}</strong>,</p>
            <p>Trip <strong>${t?.trackingCode}</strong> has been updated. Please check the latest details.</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0;">
              <tr><td style="padding:6px;color:#6b7280;">From</td><td style="padding:6px;">${t?.fromLocation}</td></tr>
              <tr><td style="padding:6px;color:#6b7280;">To</td><td style="padding:6px;">${t?.toLocation}</td></tr>
              ${t?.startDate ? `<tr><td style="padding:6px;color:#6b7280;">Start Date</td><td style="padding:6px;">${new Date(t.startDate).toLocaleDateString()}</td></tr>` : ''}
            </table>
            <p style="color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:12px;">Perazim TMS</p>
          </div>`,
        text: `Perazim TMS: Trip ${t?.trackingCode} has been updated. From: ${t?.fromLocation}, To: ${t?.toLocation}.`,
      };

    default:
      return { subject: 'Notification', html: '<p>Notification</p>', text: 'Notification' };
  }
}

function maskToken(token: string): string {
  if (!token || token.length < 8) return '****';
  return `${token.slice(0, 4)}${'*'.repeat(token.length - 8)}${token.slice(-4)}`;
}

/* ── private senders ───────────────────────────────────────────────────────── */

async function sendViaEmail(to: string, subject: string, html: string): Promise<void> {
  const smtp = await settingsService.getSmtp();
  if (!smtp) throw new Error('SMTP not configured');
  const transporter = nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.secure,
    auth: { user: smtp.username, pass: smtp.password },
  });
  await transporter.sendMail({ from: smtp.fromEmail, to, subject, html });
}

async function sendViaSms(to: string, body: string): Promise<void> {
  const config = await prisma.twilioConfig.findFirst();
  if (!config || !config.enabled) throw new Error('Twilio SMS not configured or disabled');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require('twilio');
  const client = twilio(config.accountSid, config.authToken);
  await client.messages.create({ from: config.fromPhone, to, body });
}

async function sendViaWhatsApp(to: string, body: string): Promise<void> {
  const twilioConfig = await prisma.twilioConfig.findFirst();
  if (twilioConfig?.enabled && twilioConfig.whatsappFrom) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require('twilio');
    const client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
    const waTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    await client.messages.create({ from: twilioConfig.whatsappFrom, to: waTo, body });
    return;
  }
  const waConfig = await prisma.whatsAppConfig.findFirst();
  if (!waConfig?.enabled) throw new Error('WhatsApp not configured or disabled');
  const phone = to.replace(/[^0-9+]/g, '');
  const resp = await fetch(
    `https://graph.facebook.com/v18.0/${waConfig.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${waConfig.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body } }),
    }
  );
  if (!resp.ok) {
    const err = await resp.text().catch(() => resp.statusText);
    throw new Error(`Meta API error: ${err}`);
  }
}

/* ── service ───────────────────────────────────────────────────────────────── */

export const notificationService = {

  async dispatch(type: NotifType, payload: NotifPayload): Promise<void> {
    const setting = await prisma.notificationSetting.findUnique({
      where: { notificationType: type },
    });
    if (!setting) return;

    const channels: string[] = [];
    if (setting.emailEnabled)    channels.push('EMAIL');
    if (setting.smsEnabled)      channels.push('SMS');
    if (setting.whatsappEnabled) channels.push('WHATSAPP');
    if (channels.length === 0)   return;

    const msg = buildMessage(type, payload);

    const isDriverNotif = (DRIVER_TYPES as string[]).includes(type);
    const recipient     = isDriverNotif
      ? (payload.trip?.driver   ?? payload.driver)
      : (payload.trip?.customer ?? payload.customer ?? payload.invoice?.customer);
    const recipientType = isDriverNotif ? 'DRIVER' : 'CUSTOMER';
    const phone         = isDriverNotif ? recipient?.mobile : recipient?.phone;
    const email         = recipient?.email;
    const name          = recipient?.name;
    const entityType    = payload.invoice ? 'INVOICE' : 'TRIP';
    const entityId      = payload.invoice?.id ?? payload.trip?.id ?? 0;

    // OTP email is already handled by otp.service.ts — skip EMAIL for OTP_NOTIFICATION here
    const effectiveChannels = type === 'OTP_NOTIFICATION'
      ? channels.filter(c => c !== 'EMAIL')
      : channels;

    for (const channel of effectiveChannels) {
      const logBase = {
        type, channel, recipientType,
        recipientName:  name  ?? null,
        recipientEmail: email ?? null,
        recipientPhone: phone ?? null,
        entityType, entityId,
        subject: msg.subject,
        body: channel === 'EMAIL' ? msg.html : msg.text,
      };

      try {
        if (channel === 'EMAIL' && email) {
          await sendViaEmail(email, msg.subject, msg.html);
        } else if (channel === 'SMS' && phone) {
          await sendViaSms(phone, msg.text);
        } else if (channel === 'WHATSAPP' && phone) {
          await sendViaWhatsApp(phone, msg.text);
        } else {
          // No address available for this channel — skip silently
          continue;
        }
        await prisma.notification.create({ data: { ...logBase, status: 'SENT', sentAt: new Date() } });
      } catch (err: any) {
        await prisma.notification.create({
          data: { ...logBase, status: 'FAILED', failureReason: err.message ?? 'Unknown error' },
        });
      }
    }
  },

  // ─── OTP SMS/WhatsApp ───────────────────────────────────────────────────────

  async dispatchOtpChannels(phone: string | undefined | null, code: string, trackingCode: string, tripId: number): Promise<void> {
    if (!phone) return;
    const setting = await prisma.notificationSetting.findUnique({
      where: { notificationType: 'OTP_NOTIFICATION' },
    });
    if (!setting) return;

    const body = `Perazim TMS: Your OTP for trip ${trackingCode} is ${code}. Valid for 15 minutes. Do not share this code.`;

    if (setting.smsEnabled) {
      const logBase = { type: 'OTP_NOTIFICATION', channel: 'SMS', recipientType: 'CUSTOMER', recipientPhone: phone, entityType: 'TRIP', entityId: tripId, body, subject: 'OTP' };
      try {
        await sendViaSms(phone, body);
        await prisma.notification.create({ data: { ...logBase, status: 'SENT', sentAt: new Date() } });
      } catch (err: any) {
        await prisma.notification.create({ data: { ...logBase, status: 'FAILED', failureReason: err.message } });
      }
    }
    if (setting.whatsappEnabled) {
      const logBase = { type: 'OTP_NOTIFICATION', channel: 'WHATSAPP', recipientType: 'CUSTOMER', recipientPhone: phone, entityType: 'TRIP', entityId: tripId, body, subject: 'OTP' };
      try {
        await sendViaWhatsApp(phone, body);
        await prisma.notification.create({ data: { ...logBase, status: 'SENT', sentAt: new Date() } });
      } catch (err: any) {
        await prisma.notification.create({ data: { ...logBase, status: 'FAILED', failureReason: err.message } });
      }
    }
  },

  // ─── Settings ───────────────────────────────────────────────────────────────

  async getSettings() {
    const existing = await prisma.notificationSetting.findMany();
    const existingMap = new Map(existing.map(s => [s.notificationType, s]));
    // Ensure all types exist in DB
    const missing = NOTIFICATION_TYPES.filter(t => !existingMap.has(t));
    if (missing.length > 0) {
      await prisma.notificationSetting.createMany({
        data: missing.map(t => ({ notificationType: t })),
        skipDuplicates: true,
      });
      return prisma.notificationSetting.findMany({ orderBy: { notificationType: 'asc' } });
    }
    return existing.sort((a, b) => a.notificationType.localeCompare(b.notificationType));
  },

  async updateSetting(type: string, data: { emailEnabled?: boolean; smsEnabled?: boolean; whatsappEnabled?: boolean }) {
    return prisma.notificationSetting.upsert({
      where:  { notificationType: type },
      create: { notificationType: type, ...data },
      update: data,
    });
  },

  // ─── Twilio Config ──────────────────────────────────────────────────────────

  async getTwilioConfig() {
    const cfg = await prisma.twilioConfig.findFirst();
    if (!cfg) return null;
    return { ...cfg, authToken: maskToken(cfg.authToken) };
  },

  async updateTwilioConfig(data: {
    accountSid?: string; authToken?: string; fromPhone?: string;
    whatsappFrom?: string | null; enabled?: boolean;
  }) {
    const existing = await prisma.twilioConfig.findFirst();
    const payload: any = { ...data };
    // Don't overwrite authToken if user sent back the masked value
    if (payload.authToken && /^\*+/.test(payload.authToken)) delete payload.authToken;

    if (!existing) {
      return prisma.twilioConfig.create({ data: payload });
    }
    return prisma.twilioConfig.update({ where: { id: existing.id }, data: payload });
  },

  async testTwilio(phone: string) {
    await sendViaSms(phone, 'Perazim TMS: Twilio SMS test successful.');
    return { ok: true };
  },

  // ─── WhatsApp Config ────────────────────────────────────────────────────────

  async getWhatsAppConfig() {
    const cfg = await prisma.whatsAppConfig.findFirst();
    if (!cfg) return null;
    return { ...cfg, accessToken: maskToken(cfg.accessToken) };
  },

  async updateWhatsAppConfig(data: { phoneNumberId?: string; accessToken?: string; enabled?: boolean }) {
    const existing = await prisma.whatsAppConfig.findFirst();
    const payload: any = { ...data };
    if (payload.accessToken && /^\*+/.test(payload.accessToken)) delete payload.accessToken;

    if (!existing) {
      return prisma.whatsAppConfig.create({ data: payload });
    }
    return prisma.whatsAppConfig.update({ where: { id: existing.id }, data: payload });
  },

  async testWhatsApp(phone: string) {
    await sendViaWhatsApp(phone, 'Perazim TMS: WhatsApp test successful.');
    return { ok: true };
  },

  // ─── Notification Log ───────────────────────────────────────────────────────

  async listNotifications(filters: {
    type?: string; channel?: string; status?: string;
    from?: string; to?: string; limit?: number;
  }) {
    const where: any = {};
    if (filters.type)    where.type    = filters.type;
    if (filters.channel) where.channel = filters.channel;
    if (filters.status)  where.status  = filters.status;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to)   where.createdAt.lte = new Date(filters.to);
    }
    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 200,
    });
  },

  async getStats() {
    const [total, sent, failed, last30] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { status: 'SENT' } }),
      prisma.notification.count({ where: { status: 'FAILED' } }),
      prisma.notification.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    ]);

    const byChannel = await prisma.notification.groupBy({
      by: ['channel'], _count: true,
      where: { status: 'SENT' },
    });
    const byType = await prisma.notification.groupBy({
      by: ['type'], _count: true,
      where: { status: 'SENT' },
    });

    return {
      total, sent, failed, pending: total - sent - failed, last30Days: last30,
      byChannel: Object.fromEntries(byChannel.map(r => [r.channel, r._count])),
      byType:    Object.fromEntries(byType.map(r => [r.type, r._count])),
    };
  },
};
