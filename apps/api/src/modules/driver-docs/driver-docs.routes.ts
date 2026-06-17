import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../../middleware/authenticate';
import { driverDocsService } from './driver-docs.service';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'driver-docs');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `driver-doc-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase())
            || allowed.test(file.mimetype);
    cb(null, ok);
  },
});

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.use(authenticate);

// ─── Profile (all docs for a driver) ─────────────────────────────────────────

router.get('/profile/:driverId', wrap(async (req, res) => {
  const data = await driverDocsService.getProfile(Number(req.params.driverId));
  res.json(data);
}));

// ─── Expiry overview ─────────────────────────────────────────────────────────

router.get('/expiring-soon', wrap(async (req, res) => {
  const days = req.query.days ? Number(req.query.days) : 60;
  const data = await driverDocsService.getExpiringSoon(days);
  res.json(data);
}));

// ─── Documents ────────────────────────────────────────────────────────────────

router.post('/drivers/:driverId/documents', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File is required' });
  const doc = await driverDocsService.addDocument(Number(req.params.driverId), {
    type:       req.body.type,
    label:      req.body.label,
    filename:   req.file.filename,
    path:       `/uploads/driver-docs/${req.file.filename}`,
    expiryDate: req.body.expiryDate,
    notes:      req.body.notes,
  });
  return res.status(201).json(doc);
}));

router.patch('/documents/:id', wrap(async (req, res) => {
  const doc = await driverDocsService.updateDocument(Number(req.params.id), req.body);
  res.json(doc);
}));

router.delete('/documents/:id', wrap(async (req, res) => {
  await driverDocsService.removeDocument(Number(req.params.id));
  res.json({ message: 'Document deleted' });
}));

// ─── Emergency Contacts ───────────────────────────────────────────────────────

router.post('/drivers/:driverId/contacts', wrap(async (req, res) => {
  const c = await driverDocsService.addContact(Number(req.params.driverId), req.body);
  res.status(201).json(c);
}));

router.patch('/contacts/:id', wrap(async (req, res) => {
  const c = await driverDocsService.updateContact(Number(req.params.id), req.body);
  res.json(c);
}));

router.delete('/contacts/:id', wrap(async (req, res) => {
  await driverDocsService.removeContact(Number(req.params.id));
  res.json({ message: 'Contact deleted' });
}));

// ─── Incidents ────────────────────────────────────────────────────────────────

router.post('/drivers/:driverId/incidents', wrap(async (req, res) => {
  const inc = await driverDocsService.addIncident(Number(req.params.driverId), req.body);
  res.status(201).json(inc);
}));

router.patch('/incidents/:id', wrap(async (req, res) => {
  const inc = await driverDocsService.updateIncident(Number(req.params.id), req.body);
  res.json(inc);
}));

router.delete('/incidents/:id', wrap(async (req, res) => {
  await driverDocsService.removeIncident(Number(req.params.id));
  res.json({ message: 'Incident deleted' });
}));

// ─── Warnings ─────────────────────────────────────────────────────────────────

router.post('/drivers/:driverId/warnings', wrap(async (req, res) => {
  const w = await driverDocsService.addWarning(Number(req.params.driverId), req.body);
  res.status(201).json(w);
}));

router.patch('/warnings/:id', wrap(async (req, res) => {
  const w = await driverDocsService.updateWarning(Number(req.params.id), req.body);
  res.json(w);
}));

router.delete('/warnings/:id', wrap(async (req, res) => {
  await driverDocsService.removeWarning(Number(req.params.id));
  res.json({ message: 'Warning deleted' });
}));

export default router;
