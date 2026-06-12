import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useEffect } from 'react';

import DashboardLayout from './components/layout/DashboardLayout';

import HomePage        from './pages/public/HomePage';
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
import LoadsheetsPage     from './pages/loadsheets/LoadsheetsPage';
import PaymentsPage       from './pages/payments/PaymentsPage';
import UsersPage          from './pages/users/UsersPage';
import SettingsPage       from './pages/settings/SettingsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  useEffect(() => { fetchMe(); }, [fetchMe]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"      element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />

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
          <Route path="loadsheets/*"     element={<LoadsheetsPage />} />
          <Route path="payments/*"       element={<PaymentsPage />} />
          <Route path="users/*"          element={<UsersPage />} />
          <Route path="settings/*"       element={<SettingsPage />} />
          <Route path="*"                element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
