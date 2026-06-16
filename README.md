# Perazim Fleet Management — v2

A full-stack system upgrade of the Perazim transport/fleet management system, developed to be a modern TypeScript monorepo.

## Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Backend    | Node.js, Express, TypeScript                  |
| ORM        | Prisma                                        |
| Database   | MySQL                                         |
| Frontend   | React 18, Vite, TypeScript                    |
| Styling    | Tailwind CSS                                  |
| Auth       | JWT + HTTP-only cookies (access + refresh)    |
| API        | Versioned REST (`/api/v1`) + Swagger/OpenAPI  |
| State      | TanStack Query (server) + Zustand (client)    |
| Forms      | React Hook Form + Zod                         |

---

## Project Structure

```
perazim-v2/
├── apps/
│   ├── api/                        # Express backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Full DB schema
│   │   │   └── seed.ts             # Initial data seed
│   │   └── src/
│   │       ├── app.ts              # Express app setup
│   │       ├── index.ts            # Server entry point
│   │       ├── config/
│   │       │   └── swagger.ts      # OpenAPI config
│   │       ├── lib/
│   │       │   └── prisma.ts       # Prisma singleton
│   │       ├── middleware/
│   │       │   ├── authenticate.ts # JWT auth + permissions
│   │       │   ├── errorHandler.ts # Global error handler
│   │       │   ├── notFound.ts
│   │       │   └── rateLimiter.ts
│   │       └── modules/            # Feature modules
│   │           ├── auth/           ✅ Full implementation
│   │           ├── dashboard/      ✅ Full implementation
│   │           ├── trips/          ✅ Full implementation
│   │           ├── vehicles/       ✅ Full implementation
│   │           ├── drivers/        🔲 Stub — implement next
│   │           ├── trailers/       🔲 Stub
│   │           ├── customers/      🔲 Stub
│   │           ├── fuel/           🔲 Stub
│   │           ├── quotations/     🔲 Stub
│   │           ├── invoices/       🔲 Stub
│   │           ├── payments/       🔲 Stub
│   │           ├── geofences/      🔲 Stub
│   │           ├── inspections/    🔲 Stub
│   │           ├── loadsheets/     🔲 Stub
│   │           ├── reminders/      🔲 Stub
│   │           ├── settings/       🔲 Stub
│   │           └── positions/      🔲 Stub
│   │
│   └── web/                        # React frontend
│       └── src/
│           ├── components/
│           │   ├── layout/
│           │   │   └── DashboardLayout.tsx  ✅
│           │   └── ui/
│           │       ├── Modal.tsx            ✅
│           │       └── Badge.tsx            ✅
│           ├── lib/
│           │   └── api.ts          # Axios client + auto-refresh
│           ├── pages/
│           │   ├── auth/LoginPage  ✅ Full implementation
│           │   ├── dashboard/      ✅ Full implementation
│           │   ├── vehicles/       ✅ Full implementation
│           │   ├── trips/          ✅ Full implementation
│           │   └── (others)        🔲 Stub — ready to build
│           └── stores/
│               └── authStore.ts    ✅ Zustand + persist
└── package.json                    # Monorepo workspace root
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- MySQL 8.0+

### 1. Clone & install

```bash
git clone <your-repo>
cd perazim-v2
npm install
```

### 2. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set DATABASE_URL, JWT_SECRET, etc.
```

### 3. Set up the database

<!-- Database -->
DATABASE_URL="mysql://user:password123@localhost:3306/perazim_db"

```bash
# Run migrations (creates all tables)
npm run db:migrate

# Seed initial data (admin user + default settings)
npm run db:seed
```

### 4. Run in development

```bash
# Starts both API (port 4000) and Web (port 5173) concurrently
npm run dev
```

| Service      | URL                              |
|--------------|----------------------------------|
| Web app      | http://localhost:5173            |
| API          | http://localhost:4000            |
| Swagger docs | http://localhost:4000/api/docs   |
| Prisma Studio| http://localhost:5555 (see below)|

```bash
# Open Prisma Studio (DB GUI)
npm run db:studio
```

### Default credentials (after seed)

| Field    | Value               |
|----------|---------------------|
| Username | `admin`             |
| Password | `admin123`          |

> **Change the password immediately after first login.**

---

## Authentication Flow

```
POST /api/v1/auth/login
  → Sets accessToken cookie (15m) + refreshToken cookie (7d)
  → Returns user object

POST /api/v1/auth/refresh
  → Silently refreshed by Axios interceptor on 401
  → Rotates both cookies

POST /api/v1/auth/logout
  → Clears both cookies

GET  /api/v1/auth/me
  → Returns current user + permissions
```

All tokens are stored in **HTTP-only, SameSite=Lax** cookies — they are never accessible to JavaScript, protecting against XSS.

---

## API Endpoints (v1)

All endpoints require the `accessToken` cookie unless noted.

```
Auth
  POST   /api/v1/auth/login
  POST   /api/v1/auth/refresh
  POST   /api/v1/auth/logout
  GET    /api/v1/auth/me

Dashboard
  GET    /api/v1/dashboard

Vehicles
  GET    /api/v1/vehicles
  GET    /api/v1/vehicles/:id
  POST   /api/v1/vehicles
  PUT    /api/v1/vehicles/:id
  DELETE /api/v1/vehicles/:id
  GET    /api/v1/vehicles/groups
  POST   /api/v1/vehicles/groups
  DELETE /api/v1/vehicles/groups/:id

Trips
  GET    /api/v1/trips              ?vehicleId= &driverId= &status=
  GET    /api/v1/trips/:id
  GET    /api/v1/trips/track/:code  (public tracking)
  POST   /api/v1/trips
  PUT    /api/v1/trips/:id
  PATCH  /api/v1/trips/:id/status
  DELETE /api/v1/trips/:id

(Drivers, Trailers, Customers, Fuel, Quotations, Invoices,
 Payments, Geofences, Inspections, Loadsheets, Reminders,
 Settings, Positions — all stubbed at GET /, ready to implement)
```

Full interactive docs at: `http://localhost:4000/api/docs`

---

## Database Schema (Prisma)

Key models and their PHP equivalents:

| Prisma Model       | PHP Table(s)                          |
|--------------------|---------------------------------------|
| `User`             | `login`                               |
| `UserPermissions`  | `login_roles`                         |
| `Customer`         | `customers`                           |
| `Vehicle`          | `vehicles`                            |
| `VehicleGroup`     | `vehicle_group`                       |
| `Driver`           | `drivers`                             |
| `Trailer`          | `trailers`                            |
| `Trip`             | `trips`                               |
| `TripLeg`          | `trip_legs`                           |
| `TripExpense`      | `trips_expense`                       |
| `TripPayment`      | `trip_payments`                       |
| `Quotation`        | `quotations`                          |
| `QuotationItem`    | (inline in PHP)                       |
| `Invoice`          | `invoices`                            |
| `Fuel`             | `fuel`                                |
| `IncomeExpense`    | `incomeexpense`                       |
| `DriverExpense`    | `driver_expense`                      |
| `Geofence`         | `geofences`                           |
| `GeofenceEvent`    | `geofence_events`                     |
| `Position`         | `positions`                           |
| `Inspection`       | `inspections`                         |
| `InspectionCategory` | `inspection_categories`             |
| `InspectionItem`   | `inspection_items`                    |
| `InspectionImage`  | `inspection_images`                   |
| `LoadSheet`        | `load_sheets`                         |
| `Timesheet`        | `driver_register`                     |
| `Reminder`         | `reminder`                            |
| `Settings`         | `settings`                            |
| `SmtpSettings`     | `settings_smtp`                       |

---

## Implementing a Stub Module

Every stub module follows the same pattern. Here's the recipe for, say, **Drivers**:

### Backend (`apps/api/src/modules/drivers/`)

1. **`drivers.schema.ts`** — Zod schema for create/update
2. **`drivers.service.ts`** — Prisma queries (findAll, findById, create, update, remove)
3. **`drivers.controller.ts`** — Express handlers calling the service
4. **`drivers.routes.ts`** — Replace the stub with real routes + Swagger JSDoc

### Frontend (`apps/web/src/pages/drivers/`)

1. Replace `DriversPage.tsx` stub with list table + add/edit modal
2. Use `useQuery` for data fetching, `useMutation` for CUD operations
3. Follow the `VehiclesPage.tsx` pattern exactly

---

## Migrating Existing Data

Once both apps are running, use this approach to migrate your existing MySQL data:

```bash
# 1. Export from old DB
mysqldump perazim --no-create-info --tables customers vehicles drivers trailers trips \
  trip_legs incomeexpense fuel reminder geofences quotations \
  > old_data.sql

# 2. Write a migration script
# apps/api/prisma/migrate-data.ts
# Map old column names → new Prisma field names (see table above)
# Hash passwords with bcrypt (replace md5)
# Run: ts-node prisma/migrate-data.ts
```

> ⚠️ The old system used `md5()` for passwords — these will not work with bcrypt. Force a password reset for all users after migration, or write a one-time compatibility layer.

---

## Environment Variables Reference

```env
DATABASE_URL          MySQL connection string
JWT_SECRET            Access token secret (min 32 chars)
JWT_EXPIRES_IN        e.g. "15m"
JWT_REFRESH_SECRET    Refresh token secret (different from above)
JWT_REFRESH_EXPIRES_IN e.g. "7d"
PORT                  API port (default 4000)
NODE_ENV              development | production
CLIENT_URL            Frontend origin for CORS
UPLOAD_DIR            Where to store uploaded files
SMTP_HOST/PORT/...    Email configuration
GOOGLE_MAPS_API_KEY   For geocoding
CARTRACK_*            Cartrack fleet API credentials
```
