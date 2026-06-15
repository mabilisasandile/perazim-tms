import { Router } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate';
import { authenticateDriver, DriverRequest } from '../../middleware/authenticateDriver';
import { driversService } from './drivers.service';
import { createDriverSchema, updateDriverSchema } from './drivers.schema';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';
import { auditService, getIp } from '../audit-trail/audit.service';

const router = Router();

const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

const generateDriverTokens = (id: number, email: string) => {
  const payload = { id, email, role: 'driver' };
  return {
    accessToken:  jwt.sign(payload, process.env.JWT_SECRET!,         { expiresIn: process.env.JWT_EXPIRES_IN         || '15m' }),
    refreshToken: jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'  }),
  };
};

// ── Driver portal: public auth & registration ────────────────────────────────

const driverRegisterSchema = z.object({
  name:            z.string().min(1),
  mobile:          z.string().min(1),
  email:           z.string().email(),
  password:        z.string().min(6),
  licenseNo:       z.string().min(1),
  licenseExpiry:   z.string().optional(),
  totalExperience: z.string().optional(),
  age:             z.coerce.number().int().positive().optional(),
  dateOfJoining:   z.string().optional(),
  reference:       z.string().optional(),
  address:         z.string().optional(),
});

router.post('/register', async (req, res, next) => {
  try {
    const { password, ...rest } = driverRegisterSchema.parse(req.body);

    const existing = await prisma.driver.findUnique({ where: { email: rest.email } });
    if (existing) throw new AppError('Email already registered', 409);

    const hashed = await bcrypt.hash(password, 12);
    const driver = await driversService.create({
      ...rest,
      isActive: false, // requires admin validation
    });
    await driversService.setPortalPassword(driver.id, password);

    res.status(201).json({ message: 'Account created. Awaiting admin validation.', id: driver.id });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = z.object({
      email:    z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const driver = await prisma.driver.findUnique({ where: { email } });
    if (!driver || !driver.password)
      throw new AppError('Invalid email or password', 401);

    if (!driver.isActive)
      throw new AppError('Account pending validation. Please contact admin.', 403);

    const valid = await bcrypt.compare(password, driver.password);
    if (!valid) throw new AppError('Invalid email or password', 401);

    const { accessToken, refreshToken } = generateDriverTokens(driver.id, driver.email);
    const { password: _, resetToken: __, ...safe } = driver;

    res
      .cookie('driverAccessToken',  accessToken,  { ...COOKIE, maxAge: 15 * 60 * 1000 })
      .cookie('driverRefreshToken', refreshToken, { ...COOKIE, maxAge: 7 * 24 * 60 * 60 * 1000 })
      .json({ driver: safe });
  } catch (e) { next(e); }
});

router.post('/logout', (_req, res) => {
  res
    .clearCookie('driverAccessToken')
    .clearCookie('driverRefreshToken')
    .json({ message: 'Logged out' });
});

router.post('/token/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.driverRefreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { id: number; email: string; role: string };
    if (payload.role !== 'driver') return res.status(401).json({ error: 'Invalid token' });

    const driver = await prisma.driver.findUnique({ where: { id: payload.id, isActive: true } });
    if (!driver) return res.status(401).json({ error: 'Driver not found' });

    const tokens = generateDriverTokens(driver.id, driver.email);
    res
      .cookie('driverAccessToken',  tokens.accessToken,  { ...COOKIE, maxAge: 15 * 60 * 1000 })
      .cookie('driverRefreshToken', tokens.refreshToken, { ...COOKIE, maxAge: 7 * 24 * 60 * 60 * 1000 })
      .json({ message: 'Tokens refreshed' });
  } catch (e) { next(e); }
});

// ── Driver portal: authenticated ─────────────────────────────────────────────

router.get('/portal/me', authenticateDriver, async (req: DriverRequest, res, next) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { id: req.driver!.id } });
    if (!driver) return res.status(404).json({ error: 'Not found' });
    const { password: _, resetToken: __, ...safe } = driver;
    res.json(safe);
  } catch (e) { next(e); }
});

router.put('/portal/me', authenticateDriver, async (req: DriverRequest, res, next) => {
  try {
    const data = updateDriverSchema.partial().parse(req.body);
    const updated = await driversService.update(req.driver!.id, data);
    const { password: _, resetToken: __, ...safe } = updated as any;
    res.json(safe);
  } catch (e) { next(e); }
});

router.get('/portal/trips', authenticateDriver, async (req: DriverRequest, res, next) => {
  try {
    const trips = await prisma.trip.findMany({
      where:   { driverId: req.driver!.id },
      include: {
        customer: { select: { name: true, phone: true } },
        vehicle:  { select: { name: true, registrationNo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(trips);
  } catch (e) { next(e); }
});

// ── Admin-protected driver management ────────────────────────────────────────

router.use(authenticate);

router.get('/',    async (_req, res, next) => { try { res.json(await driversService.findAll()); }           catch(e) { next(e); } });
router.get('/:id', async (req,  res, next) => { try { res.json(await driversService.findById(+req.params.id)); } catch(e) { next(e); } });

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const driver = await driversService.create(createDriverSchema.parse(req.body));
    res.status(201).json(driver);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'DRIVER_CREATED',
      entityType: 'DRIVER',
      entityId:   driver.id,
      newValue:   driver,
    });
  } catch(e) { next(e); }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const oldDriver = await driversService.findById(id);
    const driver = await driversService.update(id, updateDriverSchema.parse(req.body));
    res.json(driver);
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'DRIVER_UPDATED',
      entityType: 'DRIVER',
      entityId:   id,
      oldValue:   oldDriver,
      newValue:   driver,
    });
  } catch(e) { next(e); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = +req.params.id;
    const oldDriver = await driversService.findById(id);
    await driversService.remove(id);
    res.json({ message: 'Driver deleted' });
    auditService.log({
      username:   req.user!.username,
      ipAddress:  getIp(req),
      actionType: 'DRIVER_DELETED',
      entityType: 'DRIVER',
      entityId:   id,
      oldValue:   oldDriver,
    });
  } catch(e) { next(e); }
});

export default router;
