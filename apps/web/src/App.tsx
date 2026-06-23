import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useCustomerAuthStore } from './stores/customerAuthStore';
import { useDriverAuthStore }   from './stores/driverAuthStore';
import { useEffect } from 'react';
import { GoogleMapsProvider } from './components/maps/GoogleMapsProvider';

import DashboardLayout     from './components/layout/DashboardLayout';
import CustomerPortalPage  from './pages/customer/CustomerPortalPage';
import DriverPortalPage    from './pages/driver/DriverPortalPage';
import DriverSignupPage    from './pages/driver/DriverSignupPage';
import DriverLoginPage     from './pages/driver/DriverLoginPage';

import HomePage        from './pages/public/HomePage';
import TrackingPage    from './pages/public/TrackingPage';
import LoginPage       from './pages/auth/LoginPage';
import NotFoundPage    from './pages/NotFoundPage';

import DashboardPage      from './pages/dashboard/DashboardPage';
import VehiclesPage       from './pages/vehicles/VehiclesPage';
import TrailersPage       from './pages/trailers/TrailersPage';
import DriversPage        from './pages/drivers/DriversPage';
import TripsPage          from './pages/trips/TripsPage';
import CustomersPage      from './pages/customers/CustomersPage';
import QuotationsPage     from './pages/quotations/QuotationsPage';
import InvoicesPage       from './pages/invoices/InvoicesPage';
import FuelPage           from './pages/fuel/FuelPage';
import IncomeExpensesPage from './pages/income-expenses/IncomeExpensesPage';
import RemindersPage      from './pages/reminders/RemindersPage';
import InspectionsPage    from './pages/inspections/InspectionsPage';
import WarehousesPage     from './pages/warehouses/WarehousesPage';
import GateScansPage      from './pages/gate-scans/GateScansPage';
import PODPage            from './pages/pod/PODPage';
import CollectionPage     from './pages/collection/CollectionPage';
import LoadsheetsPage     from './pages/loadsheets/LoadsheetsPage';
import PaymentsPage       from './pages/payments/PaymentsPage';
import UsersPage          from './pages/users/UsersPage';
import SettingsPage       from './pages/settings/SettingsPage';
import SearchPage         from './pages/search/SearchPage';
import AuditTrailPage       from './pages/audit-trail/AuditTrailPage';
import PayrollPage          from './pages/payroll/PayrollPage';
import NotificationsPage    from './pages/notifications/NotificationsPage';
import ReportingPage        from './pages/reporting/ReportingPage';
import FuelTankerPage       from './pages/fuel-tanker/FuelTankerPage';
import FlatDeckPage         from './pages/flat-deck/FlatDeckPage';
import FleetMapPage         from './pages/fleet-map/FleetMapPage';
import GeofencesPage        from './pages/geofences/GeofencesPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user      = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) return null; // wait for session check before deciding
  return user ? <>{children}</> : <Navigate to="/" replace />;
}

function CustomerRoute({ children }: { children: React.ReactNode }) {
  const fetchMe   = useCustomerAuthStore((s) => s.fetchMe);
  const customer  = useCustomerAuthStore((s) => s.customer);
  const isLoading = useCustomerAuthStore((s) => s.isLoading);
  // Verify session only when this route is actually mounted.
  useEffect(() => { fetchMe(); }, [fetchMe]);
  if (isLoading) return null;
  return customer ? <>{children}</> : <Navigate to="/" replace />;
}

function DriverRoute({ children }: { children: React.ReactNode }) {
  const fetchMe   = useDriverAuthStore((s) => s.fetchMe);
  const driver    = useDriverAuthStore((s) => s.driver);
  const isLoading = useDriverAuthStore((s) => s.isLoading);
  // Verify session only when this route is actually mounted.
  useEffect(() => { fetchMe(); }, [fetchMe]);
  if (isLoading) return null;
  return driver ? <>{children}</> : <Navigate to="/drivers/d_login" replace />;
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const user    = useAuthStore((s) => s.user);

  // Only verify the admin session on mount — customer/driver sessions are
  // verified inside their own portal components, not on every page load.
  useEffect(() => { fetchMe(); }, [fetchMe]);

  return (
    <GoogleMapsProvider>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          path="/"
          element={
            // user is rehydrated synchronously from localStorage by Zustand
            // persist — no need to wait for isLoading.
            user ? <Navigate to="/app/dashboard" replace /> : <HomePage />
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/track/:code" element={<TrackingPage />} />

        {/* Customer portal */}
        <Route path="/customer" element={<CustomerRoute><CustomerPortalPage /></CustomerRoute>} />

        {/* Driver portal */}
        <Route path="/drivers/d_signup" element={<DriverSignupPage />} />
        <Route path="/drivers/d_login"  element={<DriverLoginPage />} />
        <Route path="/driver"           element={<DriverRoute><DriverPortalPage /></DriverRoute>} />

        <Route path="/app" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard"        element={<DashboardPage />} />
          <Route path="vehicles/*"       element={<VehiclesPage />} />
          <Route path="trailers/*"       element={<TrailersPage />} />
          <Route path="drivers/*"        element={<DriversPage />} />
          <Route path="trips/*"          element={<TripsPage />} />
          <Route path="customers/*"      element={<CustomersPage />} />
          <Route path="quotations/*"     element={<QuotationsPage />} />
          <Route path="invoices/*"       element={<InvoicesPage />} />
          <Route path="fuel/*"           element={<FuelPage />} />
          <Route path="income-expenses/*" element={<IncomeExpensesPage />} />
          <Route path="reminders/*"      element={<RemindersPage />} />
          <Route path="inspections/*"    element={<InspectionsPage />} />
          <Route path="warehouses/*"     element={<WarehousesPage />} />
          <Route path="gate-scans/*"     element={<GateScansPage />} />
          <Route path="pod/*"            element={<PODPage />} />
          <Route path="collections/*"    element={<CollectionPage />} />
          <Route path="loadsheets/*"     element={<LoadsheetsPage />} />
          <Route path="payments/*"       element={<PaymentsPage />} />
          <Route path="users/*"          element={<UsersPage />} />
          <Route path="settings/*"       element={<SettingsPage />} />
          <Route path="search"           element={<SearchPage />} />
          <Route path="audit-trail"     element={<AuditTrailPage />} />
          <Route path="payroll/*"        element={<PayrollPage />} />
          <Route path="notifications"    element={<NotificationsPage />} />
          <Route path="reporting"        element={<ReportingPage />} />
          <Route path="fuel-tanker"      element={<FuelTankerPage />} />
          <Route path="flat-deck"        element={<FlatDeckPage />} />
          <Route path="fleet-map"        element={<FleetMapPage />} />
          <Route path="geofences"        element={<GeofencesPage />} />
          <Route path="*"                element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </GoogleMapsProvider>
  );
}
