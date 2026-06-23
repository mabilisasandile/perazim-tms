import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Loader2, AlertCircle, Route, CheckCircle2, Truck, Users,
  Building2, TrendingUp, TrendingDown, AlertTriangle, DollarSign,
  BarChart3, Activity,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OperationsData {
  activeTrips: {
    id: number;
    trackingCode: string;
    fromLocation: string;
    toLocation: string;
    startDate: string;
    vehicleName: string;
    vehicleReg: string;
    driverName: string;
    customerName: string;
  }[];
  deliveredVehicles: { thisMonth: number; total: number };
  warehouseOccupancy: {
    id: number;
    name: string;
    location: string;
    capacity: number;
    occupied: number;
    utilizationPct: number;
  }[];
  driverPerformance: {
    id: number;
    name: string;
    totalTrips: number;
    completedTrips: number;
    activeTrips: number;
    cancelledTrips: number;
    completionRate: number;
  }[];
  fleetUtilization: {
    total: number;
    active: number;
    idle: number;
    utilizationPct: number;
  };
}

interface FinancialData {
  revenueTrends: { month: string; revenue: number; expenses: number }[];
  outstandingPayments: {
    unpaid: { count: number; total: number };
    partial: { count: number; outstanding: number };
    overdue: { count: number; total: number };
    totalOutstanding: number;
  };
  monthlyRevenue: { month: string; revenue: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(n);

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl shrink-0 ${iconBg}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">{children}</h2>;
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="animate-spin text-brand-600" size={32} />
      <p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
      <AlertCircle size={20} />
      <span>Failed to load analytics data.</span>
    </div>
  );
}

// ─── Operations Dashboard ─────────────────────────────────────────────────────

function OperationsDashboard() {
  const { data, isLoading, isError } = useQuery<OperationsData>({
    queryKey: ['dashboard-operations'],
    queryFn: () => api.get('/dashboard/operations').then((r) => r.data),
  });

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState />;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Active Trips"
          value={data.activeTrips.length}
          sub="Currently in progress"
          icon={Route}
          iconBg="bg-blue-500"
        />
        <KpiCard
          label="Delivered This Month"
          value={data.deliveredVehicles.thisMonth}
          sub={`${data.deliveredVehicles.total} all-time`}
          icon={CheckCircle2}
          iconBg="bg-green-500"
        />
        <KpiCard
          label="Fleet Utilization"
          value={`${data.fleetUtilization.utilizationPct}%`}
          sub={`${data.fleetUtilization.active} of ${data.fleetUtilization.total} vehicles active`}
          icon={Truck}
          iconBg="bg-purple-500"
        />
        <KpiCard
          label="Idle Vehicles"
          value={data.fleetUtilization.idle}
          sub="Available for dispatch"
          icon={Activity}
          iconBg="bg-orange-400"
        />
      </div>

      {/* Active Trips Table */}
      <div className="bg-white rounded-xl border">
        <div className="p-5 border-b flex items-center gap-2">
          <Route size={16} className="text-blue-500" />
          <SectionTitle>Active Trips</SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Tracking</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">From</th>
                <th className="px-4 py-3 text-left">To</th>
                <th className="px-4 py-3 text-left">Vehicle</th>
                <th className="px-4 py-3 text-left">Driver</th>
                <th className="px-4 py-3 text-left">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.activeTrips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No active trips
                  </td>
                </tr>
              ) : (
                data.activeTrips.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.trackingCode.slice(0, 12)}…</td>
                    <td className="px-4 py-3 font-medium">{t.customerName}</td>
                    <td className="px-4 py-3 text-gray-500 truncate max-w-[160px]">{t.fromLocation}</td>
                    <td className="px-4 py-3 text-gray-500 truncate max-w-[160px]">{t.toLocation}</td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700">{t.vehicleName}</span>
                      <span className="text-gray-400 text-xs ml-1">({t.vehicleReg})</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t.driverName}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(t.startDate).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Warehouse Occupancy */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-purple-500" />
            <SectionTitle>Warehouse Occupancy</SectionTitle>
          </div>
          {data.warehouseOccupancy.length === 0 ? (
            <p className="text-gray-400 text-sm py-6 text-center">No warehouses configured</p>
          ) : (
            <div className="space-y-4">
              {data.warehouseOccupancy.map((w) => (
                <div key={w.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-sm font-medium text-gray-700">{w.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{w.location}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {w.occupied} / {w.capacity} ({w.utilizationPct}%)
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        w.utilizationPct >= 90
                          ? 'bg-red-500'
                          : w.utilizationPct >= 70
                          ? 'bg-orange-400'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${w.utilizationPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fleet Utilization Donut-style */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Truck size={16} className="text-purple-500" />
            <SectionTitle>Fleet Utilization</SectionTitle>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Active (In-Trip)', value: data.fleetUtilization.active, color: 'bg-blue-500' },
              { label: 'Idle / Available', value: data.fleetUtilization.idle, color: 'bg-gray-200' },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{row.label}</span>
                  <span className="font-semibold">{row.value}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${row.color}`}
                    style={{
                      width: data.fleetUtilization.total > 0
                        ? `${Math.round((row.value / data.fleetUtilization.total) * 100)}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400 pt-1">
              Total fleet: {data.fleetUtilization.total} active vehicles
            </p>
          </div>
        </div>
      </div>

      {/* Driver Performance */}
      <div className="bg-white rounded-xl border">
        <div className="p-5 border-b flex items-center gap-2">
          <Users size={16} className="text-green-500" />
          <SectionTitle>Driver Performance</SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Driver</th>
                <th className="px-4 py-3 text-right">Total Trips</th>
                <th className="px-4 py-3 text-right">Completed</th>
                <th className="px-4 py-3 text-right">Active</th>
                <th className="px-4 py-3 text-right">Cancelled</th>
                <th className="px-4 py-3 text-left">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.driverPerformance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No driver data available
                  </td>
                </tr>
              ) : (
                data.driverPerformance.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{d.name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{d.totalTrips}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{d.completedTrips}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{d.activeTrips}</td>
                    <td className="px-4 py-3 text-right text-red-500">{d.cancelledTrips}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              d.completionRate >= 80 ? 'bg-green-500' : d.completionRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${d.completionRate}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{d.completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Financial Dashboard ──────────────────────────────────────────────────────

function FinancialDashboard() {
  const { data, isLoading, isError } = useQuery<FinancialData>({
    queryKey: ['dashboard-financial'],
    queryFn: () => api.get('/dashboard/financial').then((r) => r.data),
  });

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState />;

  const { outstandingPayments: op } = data;
  const totalOutstanding = op.totalOutstanding;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Outstanding"
          value={fmt(totalOutstanding)}
          sub="Across unpaid, partial & overdue"
          icon={DollarSign}
          iconBg="bg-gray-700"
        />
        <KpiCard
          label="Unpaid Invoices"
          value={op.unpaid.count}
          sub={fmt(op.unpaid.total)}
          icon={TrendingDown}
          iconBg="bg-orange-500"
        />
        <KpiCard
          label="Partial Payments"
          value={op.partial.count}
          sub={`${fmt(op.partial.outstanding)} remaining`}
          icon={TrendingUp}
          iconBg="bg-blue-500"
        />
        <KpiCard
          label="Overdue"
          value={op.overdue.count}
          sub={fmt(op.overdue.total)}
          icon={AlertTriangle}
          iconBg="bg-red-500"
        />
      </div>

      {/* Revenue & Expense Trends */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-green-500" />
          <SectionTitle>Revenue &amp; Expense Trends (Last 12 Months)</SectionTitle>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.revenueTrends} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Revenue"
            />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Expenses"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Revenue — current year bar chart */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-blue-500" />
          <SectionTitle>Monthly Revenue ({new Date().getFullYear()})</SectionTitle>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.monthlyRevenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Outstanding Payments breakdown */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className="text-orange-500" />
          <SectionTitle>Outstanding Payments Breakdown</SectionTitle>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: 'Unpaid',
              count: op.unpaid.count,
              amount: op.unpaid.total,
              pct: totalOutstanding > 0 ? Math.round((op.unpaid.total / totalOutstanding) * 100) : 0,
              barColor: 'bg-orange-400',
              textColor: 'text-orange-600',
            },
            {
              label: 'Partially Paid',
              count: op.partial.count,
              amount: op.partial.outstanding,
              pct: totalOutstanding > 0 ? Math.round((op.partial.outstanding / totalOutstanding) * 100) : 0,
              barColor: 'bg-blue-400',
              textColor: 'text-blue-600',
            },
            {
              label: 'Overdue',
              count: op.overdue.count,
              amount: op.overdue.total,
              pct: totalOutstanding > 0 ? Math.round((op.overdue.total / totalOutstanding) * 100) : 0,
              barColor: 'bg-red-500',
              textColor: 'text-red-600',
            },
          ].map((row) => (
            <div key={row.label} className="rounded-lg border p-4">
              <p className={`text-xs uppercase tracking-wide font-semibold ${row.textColor}`}>{row.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(row.amount)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{row.count} invoice{row.count !== 1 ? 's' : ''}</p>
              <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${row.barColor}`} style={{ width: `${row.pct}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{row.pct}% of total outstanding</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'operations' | 'financial';

export default function ReportingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('operations');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reporting &amp; Analytics</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(
          [
            { key: 'operations', label: 'Operations Dashboard' },
            { key: 'financial', label: 'Financial Dashboard' },
          ] as { key: Tab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'operations' ? <OperationsDashboard /> : <FinancialDashboard />}
    </div>
  );
}
