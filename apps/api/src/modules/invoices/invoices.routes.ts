import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../../middleware/authenticate';
import { invoicesService } from './invoices.service';
import { createInvoiceSchema, createInvoicePaymentSchema } from './invoices.schema';
import { auditService, getIp } from '../audit-trail/audit.service';

const router = Router();
router.use(authenticate);

// ── File upload for proof of payment ──────────────────────────────────────────
const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'invoice-proofs');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `pop-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage: proofStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /jpeg|jpg|png|pdf/.test(path.extname(file.originalname).toLowerCase())
            || /jpeg|jpg|png|pdf/.test(file.mimetype);
    cb(null, ok as any);
  },
});

// ── Stats ──────────────────────────────────────────────────────────────────────
router.get('/stats', async (_req, res, next) => {
  try { res.json(await invoicesService.getStats()); } catch (e) { next(e); }
});

// ── List ───────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try { res.json(await invoicesService.findAll(req.query.status as string | undefined)); } catch (e) { next(e); }
});

// ── Single ─────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try { res.json(await invoicesService.findById(+req.params.id)); } catch (e) { next(e); }
});

// ── Create ─────────────────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const inv = await invoicesService.create(createInvoiceSchema.parse(req.body));
    res.status(201).json(inv);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId:   inv.id,
      newValue:   inv,
    });
  } catch (e) { next(e); }
});

// ── Update status ──────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const oldInv = await invoicesService.findById(id);
    const inv = await invoicesService.updateStatus(id, req.body.status);
    res.json(inv);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'INVOICE_STATUS_UPDATED',
      entityType: 'INVOICE',
      entityId:   id,
      oldValue:   { status: oldInv.status },
      newValue:   { status: req.body.status },
    });
  } catch (e) { next(e); }
});

// ── Record payment (deposit or full payment, with optional proof upload) ───────
router.post('/:id/payments', upload.single('proof'), async (req: AuthRequest, res, next) => {
  try {
    const invoiceId = +req.params.id;
    const dto = createInvoicePaymentSchema.parse(req.body);
    const proofPath = req.file ? `/uploads/invoice-proofs/${req.file.filename}` : undefined;
    const payment = await invoicesService.recordPayment(invoiceId, dto, proofPath);
    res.status(201).json(payment);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'INVOICE_PAYMENT_RECORDED',
      entityType: 'INVOICE',
      entityId:   invoiceId,
      newValue:   { ...dto, proofPath },
    });
  } catch (e) { next(e); }
});

// ── Get payment history for an invoice ────────────────────────────────────────
router.get('/:id/payments', async (req, res, next) => {
  try { res.json(await invoicesService.getPayments(+req.params.id)); } catch (e) { next(e); }
});

// ── Mark overdue ───────────────────────────────────────────────────────────────
router.post('/mark-overdue', async (_req, res, next) => {
  try { res.json(await invoicesService.markOverdue()); } catch (e) { next(e); }
});

// ── Delete ─────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const oldInv = await invoicesService.findById(id);
    await invoicesService.remove(id);
    res.json({ message: 'Invoice deleted' });
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'INVOICE_DELETED',
      entityType: 'INVOICE',
      entityId:   id,
      oldValue:   oldInv,
    });
  } catch (e) { next(e); }
});

export default router;
