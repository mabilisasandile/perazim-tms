import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

export const driverDocsService = {
  async getProfile(driverId: number) {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        assignedVehicle: { select: { id: true, name: true, registrationNo: true } },
        documents:        { orderBy: { createdAt: 'desc' } },
        emergencyContacts:{ orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        incidents:        { orderBy: { incidentDate: 'desc' } },
        warnings:         { orderBy: { warningDate: 'desc' } },
      },
    });
    if (!driver) throw new AppError('Driver not found', 404);
    return driver;
  },

  // ─── Documents ────────────────────────────────────────────────────────────

  async addDocument(driverId: number, data: {
    type: string; label?: string; filename: string; path: string;
    expiryDate?: string; notes?: string;
  }) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new AppError('Driver not found', 404);
    return prisma.driverDocument.create({
      data: {
        driverId,
        type:      data.type,
        label:     data.label ?? null,
        filename:  data.filename,
        path:      data.path,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        notes:     data.notes ?? null,
      },
    });
  },

  async updateDocument(id: number, data: {
    type?: string; label?: string; expiryDate?: string | null; notes?: string;
  }) {
    const doc = await prisma.driverDocument.findUnique({ where: { id } });
    if (!doc) throw new AppError('Document not found', 404);
    return prisma.driverDocument.update({
      where: { id },
      data: {
        ...(data.type !== undefined  && { type: data.type }),
        ...(data.label !== undefined && { label: data.label }),
        ...(data.expiryDate !== undefined && {
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });
  },

  async removeDocument(id: number) {
    const doc = await prisma.driverDocument.findUnique({ where: { id } });
    if (!doc) throw new AppError('Document not found', 404);
    return prisma.driverDocument.delete({ where: { id } });
  },

  // ─── Emergency Contacts ───────────────────────────────────────────────────

  async addContact(driverId: number, data: {
    name: string; relationship: string; phone: string;
    altPhone?: string; email?: string; address?: string; isPrimary?: boolean;
  }) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new AppError('Driver not found', 404);
    if (data.isPrimary) {
      await prisma.driverEmergencyContact.updateMany({
        where: { driverId }, data: { isPrimary: false },
      });
    }
    return prisma.driverEmergencyContact.create({
      data: {
        driverId,
        name:         data.name,
        relationship: data.relationship,
        phone:        data.phone,
        altPhone:     data.altPhone ?? null,
        email:        data.email ?? null,
        address:      data.address ?? null,
        isPrimary:    data.isPrimary ?? false,
      },
    });
  },

  async updateContact(id: number, data: {
    name?: string; relationship?: string; phone?: string;
    altPhone?: string; email?: string; address?: string; isPrimary?: boolean;
  }) {
    const contact = await prisma.driverEmergencyContact.findUnique({ where: { id } });
    if (!contact) throw new AppError('Contact not found', 404);
    if (data.isPrimary) {
      await prisma.driverEmergencyContact.updateMany({
        where: { driverId: contact.driverId }, data: { isPrimary: false },
      });
    }
    return prisma.driverEmergencyContact.update({
      where: { id },
      data: {
        ...(data.name         !== undefined && { name: data.name }),
        ...(data.relationship !== undefined && { relationship: data.relationship }),
        ...(data.phone        !== undefined && { phone: data.phone }),
        ...(data.altPhone     !== undefined && { altPhone: data.altPhone }),
        ...(data.email        !== undefined && { email: data.email }),
        ...(data.address      !== undefined && { address: data.address }),
        ...(data.isPrimary    !== undefined && { isPrimary: data.isPrimary }),
      },
    });
  },

  async removeContact(id: number) {
    const c = await prisma.driverEmergencyContact.findUnique({ where: { id } });
    if (!c) throw new AppError('Contact not found', 404);
    return prisma.driverEmergencyContact.delete({ where: { id } });
  },

  // ─── Incidents ────────────────────────────────────────────────────────────

  async addIncident(driverId: number, data: {
    incidentDate: string; title: string; description: string;
    severity?: string; status?: string; notes?: string;
  }) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new AppError('Driver not found', 404);
    return prisma.driverIncident.create({
      data: {
        driverId,
        incidentDate: new Date(data.incidentDate),
        title:       data.title,
        description: data.description,
        severity:    data.severity  ?? 'MINOR',
        status:      data.status    ?? 'OPEN',
        notes:       data.notes     ?? null,
      },
    });
  },

  async updateIncident(id: number, data: {
    incidentDate?: string; title?: string; description?: string;
    severity?: string; status?: string; notes?: string;
  }) {
    const inc = await prisma.driverIncident.findUnique({ where: { id } });
    if (!inc) throw new AppError('Incident not found', 404);
    return prisma.driverIncident.update({
      where: { id },
      data: {
        ...(data.incidentDate !== undefined && { incidentDate: new Date(data.incidentDate) }),
        ...(data.title       !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.severity    !== undefined && { severity: data.severity }),
        ...(data.status      !== undefined && { status: data.status }),
        ...(data.notes       !== undefined && { notes: data.notes }),
      },
    });
  },

  async removeIncident(id: number) {
    const inc = await prisma.driverIncident.findUnique({ where: { id } });
    if (!inc) throw new AppError('Incident not found', 404);
    return prisma.driverIncident.delete({ where: { id } });
  },

  // ─── Warnings ─────────────────────────────────────────────────────────────

  async addWarning(driverId: number, data: {
    warningDate: string; type: string; reason: string;
    description: string; issuedBy: string; acknowledged?: boolean; notes?: string;
  }) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new AppError('Driver not found', 404);
    return prisma.driverWarning.create({
      data: {
        driverId,
        warningDate:  new Date(data.warningDate),
        type:         data.type,
        reason:       data.reason,
        description:  data.description,
        issuedBy:     data.issuedBy,
        acknowledged: data.acknowledged ?? false,
        notes:        data.notes ?? null,
      },
    });
  },

  async updateWarning(id: number, data: {
    warningDate?: string; type?: string; reason?: string;
    description?: string; issuedBy?: string; acknowledged?: boolean; notes?: string;
  }) {
    const w = await prisma.driverWarning.findUnique({ where: { id } });
    if (!w) throw new AppError('Warning not found', 404);
    return prisma.driverWarning.update({
      where: { id },
      data: {
        ...(data.warningDate  !== undefined && { warningDate: new Date(data.warningDate) }),
        ...(data.type         !== undefined && { type: data.type }),
        ...(data.reason       !== undefined && { reason: data.reason }),
        ...(data.description  !== undefined && { description: data.description }),
        ...(data.issuedBy     !== undefined && { issuedBy: data.issuedBy }),
        ...(data.acknowledged !== undefined && { acknowledged: data.acknowledged }),
        ...(data.notes        !== undefined && { notes: data.notes }),
      },
    });
  },

  async removeWarning(id: number) {
    const w = await prisma.driverWarning.findUnique({ where: { id } });
    if (!w) throw new AppError('Warning not found', 404);
    return prisma.driverWarning.delete({ where: { id } });
  },

  // ─── Expiry Overview ──────────────────────────────────────────────────────

  async getExpiringSoon(daysAhead = 60) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);
    const now = new Date();
    return prisma.driverDocument.findMany({
      where: {
        expiryDate: { lte: cutoff },
        NOT: { expiryDate: null },
      },
      include: {
        driver: { select: { id: true, name: true, mobile: true, email: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
  },
};
