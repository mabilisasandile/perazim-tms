import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { rateLimiter } from './middleware/rateLimiter';

// Route imports
import authRoutes          from './modules/auth/auth.routes';
import userRoutes          from './modules/users/users.routes';
import vehicleRoutes       from './modules/vehicles/vehicles.routes';
import driverRoutes        from './modules/drivers/drivers.routes';
import trailerRoutes       from './modules/trailers/trailers.routes';
import tripRoutes          from './modules/trips/trips.routes';
import customerRoutes      from './modules/customers/customers.routes';
import fuelRoutes          from './modules/fuel/fuel.routes';
import quotationRoutes     from './modules/quotations/quotations.routes';
import invoiceRoutes       from './modules/invoices/invoices.routes';
import paymentRoutes       from './modules/payments/payments.routes';
import geofenceRoutes      from './modules/geofences/geofences.routes';
import inspectionRoutes    from './modules/inspections/inspections.routes';
import loadsheetRoutes     from './modules/loadsheets/loadsheets.routes';
import dashboardRoutes     from './modules/dashboard/dashboard.routes';
import reminderRoutes      from './modules/reminders/reminders.routes';
import settingsRoutes      from './modules/settings/settings.routes';
import positionRoutes      from './modules/positions/positions.routes';
import incomeExpenseRoutes from './modules/income-expenses/income-expenses.routes';
import searchRoutes        from './modules/search/search.routes';
import auditRoutes         from './modules/audit-trail/audit.routes';
import warehouseRoutes     from './modules/warehouses/warehouses.routes';
import gateScanRoutes      from './modules/gate-scans/gate-scans.routes';
import podRoutes           from './modules/pod/pod.routes';
import otpRoutes           from './modules/otp/otp.routes';
import collectionRoutes    from './modules/collections/collections.routes';
import driverDocsRoutes   from './modules/driver-docs/driver-docs.routes';

const app = express();

// ─── Security & Middleware ────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(rateLimiter);

// ─── Static uploads ───────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── Swagger Docs ─────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Health check ─────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API v1 Routes ────────────────────────────────────────
const v1 = '/api/v1';

app.use(`${v1}/auth`,           authRoutes);
app.use(`${v1}/users`,          userRoutes);
app.use(`${v1}/vehicles`,       vehicleRoutes);
app.use(`${v1}/drivers`,        driverRoutes);
app.use(`${v1}/trailers`,       trailerRoutes);
app.use(`${v1}/trips`,          tripRoutes);
app.use(`${v1}/customers`,      customerRoutes);
app.use(`${v1}/fuel`,           fuelRoutes);
app.use(`${v1}/quotations`,     quotationRoutes);
app.use(`${v1}/invoices`,       invoiceRoutes);
app.use(`${v1}/payments`,       paymentRoutes);
app.use(`${v1}/geofences`,      geofenceRoutes);
app.use(`${v1}/inspections`,    inspectionRoutes);
app.use(`${v1}/loadsheets`,     loadsheetRoutes);
app.use(`${v1}/dashboard`,      dashboardRoutes);
app.use(`${v1}/reminders`,      reminderRoutes);
app.use(`${v1}/settings`,       settingsRoutes);
app.use(`${v1}/positions`,      positionRoutes);
app.use(`${v1}/income-expenses`, incomeExpenseRoutes);
app.use(`${v1}/search`,         searchRoutes);
app.use(`${v1}/audit-trail`,    auditRoutes);
app.use(`${v1}/warehouses`,     warehouseRoutes);
app.use(`${v1}/gate-scans`,    gateScanRoutes);
app.use(`${v1}/pod`,           podRoutes);
app.use(`${v1}/otp`,           otpRoutes);
app.use(`${v1}/collections`,   collectionRoutes);
app.use(`${v1}/driver-docs`,  driverDocsRoutes);

// ─── Error Handling ───────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
