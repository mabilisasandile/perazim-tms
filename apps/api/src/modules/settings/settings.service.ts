import { prisma } from '../../lib/prisma';
import nodemailer from 'nodemailer';

export const settingsService = {
  async get() {
    let s = await prisma.settings.findFirst();
    if (!s) s = await prisma.settings.create({ data: { companyName: 'Perazim', vat: 15, currency: 'ZAR' } });
    return s;
  },
  async update(data: any) {
    const existing = await this.get();
    return prisma.settings.update({ where: { id: existing.id }, data });
  },
  async getSmtp() {
    return prisma.smtpSettings.findFirst();
  },
  async updateSmtp(data: any) {
    const existing = await prisma.smtpSettings.findFirst();
    if (existing) return prisma.smtpSettings.update({ where: { id: existing.id }, data });
    return prisma.smtpSettings.create({ data });
  },
  async testSmtp() {
    const smtp = await this.getSmtp();
    if (!smtp) throw new Error('SMTP not configured');
    const transporter = nodemailer.createTransport({
      host: smtp.host, port: smtp.port, secure: smtp.secure,
      auth: { user: smtp.username, pass: smtp.password },
    });
    await transporter.verify();
    await transporter.sendMail({
      from: smtp.fromEmail, to: smtp.username,
      subject: 'Perazim SMTP Test', text: 'SMTP is configured correctly.',
    });
    return { message: 'Test email sent' };
  },
};
