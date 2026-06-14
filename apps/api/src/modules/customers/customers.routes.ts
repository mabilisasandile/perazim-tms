import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authenticateCustomer, CustomerRequest } from '../../middleware/authenticateCustomer';
import { customersService } from './customers.service';
import { createCustomerSchema, updateCustomerSchema } from './customers.schema';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';

const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

const generateCustomerTokens = (id: number, email: string) => {
  const payload = { id, email, role: 'customer' };
  return {
    accessToken:  jwt.sign(payload, process.env.JWT_SECRET!,         { expiresIn: process.env.JWT_EXPIRES_IN         || '15m' }),
    refreshToken: jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'  }),
  };
};

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management
 */
const router = Router();

// ── Customer portal: public auth ─────────────────────────────────────────────

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = z.object({
      email:    z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const customer = await prisma.customer.findUnique({ where: { email, isActive: true } });
    if (!customer || !customer.password)
      return next(new (await import('../../middleware/errorHandler')).AppError('Invalid email or password', 401));

    const valid = await bcrypt.compare(password, customer.password);
    if (!valid)
      return next(new (await import('../../middleware/errorHandler')).AppError('Invalid email or password', 401));

    const { accessToken, refreshToken } = generateCustomerTokens(customer.id, customer.email);
    const { password: _, resetToken: __, ...safe } = customer;

    res
      .cookie('customerAccessToken',  accessToken,  { ...COOKIE, maxAge: 15 * 60 * 1000 })
      .cookie('customerRefreshToken', refreshToken, { ...COOKIE, maxAge: 7 * 24 * 60 * 60 * 1000 })
      .json({ customer: safe });
  } catch (e) { next(e); }
});

router.post('/logout', (_req, res) => {
  res
    .clearCookie('customerAccessToken')
    .clearCookie('customerRefreshToken')
    .json({ message: 'Logged out' });
});

router.post('/token/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.customerRefreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { id: number; email: string; role: string };
    if (payload.role !== 'customer') return res.status(401).json({ error: 'Invalid token' });

    const customer = await prisma.customer.findUnique({ where: { id: payload.id, isActive: true } });
    if (!customer) return res.status(401).json({ error: 'Customer not found' });

    const tokens = generateCustomerTokens(customer.id, customer.email);
    res
      .cookie('customerAccessToken',  tokens.accessToken,  { ...COOKIE, maxAge: 15 * 60 * 1000 })
      .cookie('customerRefreshToken', tokens.refreshToken, { ...COOKIE, maxAge: 7 * 24 * 60 * 60 * 1000 })
      .json({ message: 'Tokens refreshed' });
  } catch (e) { next(e); }
});

// ── Customer portal: authenticated ───────────────────────────────────────────

router.get('/portal/me', authenticateCustomer, async (req: CustomerRequest, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.customer!.id } });
    if (!customer) return res.status(404).json({ error: 'Not found' });
    const { password: _, resetToken: __, ...safe } = customer;
    res.json(safe);
  } catch (e) { next(e); }
});

router.put('/portal/me', authenticateCustomer, async (req: CustomerRequest, res, next) => {
  try {
    const data = z.object({
      name:    z.string().min(1).optional(),
      phone:   z.string().optional(),
      address: z.string().optional(),
    }).parse(req.body);
    const updated = await prisma.customer.update({ where: { id: req.customer!.id }, data });
    const { password: _, resetToken: __, ...safe } = updated;
    res.json(safe);
  } catch (e) { next(e); }
});

router.get('/portal/bookings', authenticateCustomer, async (req: CustomerRequest, res, next) => {
  try {
    const bookings = await prisma.quotation.findMany({
      where:   { customerId: req.customer!.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(bookings);
  } catch (e) { next(e); }
});

router.post('/portal/bookings', authenticateCustomer, async (req: CustomerRequest, res, next) => {
  try {
    const body = z.object({
      pickup:      z.string().min(1),
      dropoff:     z.string().min(1),
      pickupDate:  z.string().optional(),
      dropoffDate: z.string().optional(),
      vehicleMake:         z.string().min(1),
      vehicleColour:       z.string().min(1),
      vehicleRegistration: z.string().min(1),
      vehicleVin:          z.string().optional(),
      vehicleStock:        z.string().optional(),
      vehicleEngine:       z.string().optional(),
      vehicleCondition:    z.enum(['Runner', 'Non-Runner']).optional(),
    }).parse(req.body);

    const count  = await prisma.quotation.count();
    const number = `QT-${String(count + 1).padStart(5, '0')}`;

    const description = [
      body.vehicleMake,
      body.vehicleColour,
      body.vehicleVin        && `VIN: ${body.vehicleVin}`,
      body.vehicleStock      && `Stock: ${body.vehicleStock}`,
      body.vehicleEngine     && `Engine: ${body.vehicleEngine}`,
      body.vehicleCondition  && `Condition: ${body.vehicleCondition}`,
    ].filter(Boolean).join(' | ');

    const quotation = await prisma.quotation.create({
      data: {
        number,
        customerId:  req.customer!.id,
        pickup:      body.pickup,
        dropoff:     body.dropoff,
        pickupDate:  body.pickupDate  ? new Date(body.pickupDate)  : null,
        dropoffDate: body.dropoffDate ? new Date(body.dropoffDate) : null,
        items: {
          create: [{
            description,
            colour:           body.vehicleColour,
            registration:     body.vehicleRegistration,
            vehicleCondition: body.vehicleCondition ?? null,
            quantity:         1,
            unitPrice:        0,
            total:            0,
          }],
        },
      },
      include: { items: true },
    });

    res.status(201).json(quotation);
  } catch (e) { next(e); }
});

// ── Customer self-registration ────────────────────────────────────────────────

const publicRegisterSchema = z.object({
  name:               z.string().min(1),
  email:              z.string().email(),
  phone:              z.string().optional(),
  vatNumber:          z.string().optional(),
  registrationNumber: z.string().optional(),
  password:           z.string().min(8),
});

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, phone, vatNumber, registrationNumber, password } =
      publicRegisterSchema.parse(req.body);

    const addressParts: string[] = [];
    if (vatNumber)          addressParts.push(`VAT: ${vatNumber}`);
    if (registrationNumber) addressParts.push(`Reg: ${registrationNumber}`);

    const customer = await customersService.create({
      name,
      email,
      phone,
      address: addressParts.length ? addressParts.join(' | ') : undefined,
      isActive: true,
    });

    await customersService.setPortalPassword(customer.id, password);

    res.status(201).json({ message: 'Account created successfully', id: customer.id });
  } catch (e) { next(e); }
});

router.use(authenticate);

router.get('/',                    async (_req, res, next) => { try { res.json(await customersService.findAll()); }                                                              catch(e) { next(e); } });
router.get('/:id',                 async (req,  res, next) => { try { res.json(await customersService.findById(+req.params.id)); }                                               catch(e) { next(e); } });
router.get('/:id/trips',           async (req,  res, next) => { try { res.json(await customersService.getTrips(+req.params.id)); }                                               catch(e) { next(e); } });
router.post('/',                   async (req,  res, next) => { try { res.status(201).json(await customersService.create(createCustomerSchema.parse(req.body))); }               catch(e) { next(e); } });
router.put('/:id',                 async (req,  res, next) => { try { res.json(await customersService.update(+req.params.id, updateCustomerSchema.parse(req.body))); }           catch(e) { next(e); } });
router.delete('/:id',              async (req,  res, next) => { try { await customersService.remove(+req.params.id); res.json({ message: 'Customer deleted' }); }               catch(e) { next(e); } });
router.put('/:id/portal-password', async (req,  res, next) => {
  try {
    const { password } = z.object({ password: z.string().min(8) }).parse(req.body);
    await customersService.setPortalPassword(+req.params.id, password);
    res.json({ message: 'Portal password set' });
  } catch(e) { next(e); }
});

export default router;
