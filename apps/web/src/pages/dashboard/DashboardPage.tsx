import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Truck, Users, UserCircle, Route,
  TrendingUp, TrendingDown, AlertCircle, Loader2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';

interface DashboardStats {
  totalVehicles: number;
  totalDrivers: number;
  totalCustomers: number;
  todayTrips: number;
  todayIncome: number;
  todayExpense: number;
  totalTrailers: number;
  chartData: { date: string; income: number; expense: number }[];
  vehicleStatuses: {
    vehicleName: string;
    registrationNo: string;
    status: string;
    fromLocation: string;
    toLocation: string;
  }[];
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="animate-spin text-brand-600" size={32} />
        <p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
        <AlertCircle size={20} />
        <span>Failed to load dashboard data.</span>
      </div>
    );
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Vehicles"    value={data.totalVehicles}  icon={Truck}      color="bg-blue-500" />
        <StatCard label="Drivers"     value={data.totalDrivers}   icon={Users}      color="bg-purple-500" />
        <StatCard label="Customers"   value={data.totalCustomers} icon={UserCircle} color="bg-orange-500" />
        <StatCard label="Trips Today" value={data.todayTrips}     icon={Route}      color="bg-green-500" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-100"><TrendingUp size={22} className="text-green-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Today's Income</p>
            <p className="text-2xl font-bold text-gray-900">{fmt(data.todayIncome)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-red-100"><TrendingDown size={22} className="text-red-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Today's Expenses</p>
            <p className="text-2xl font-bold text-gray-900">{fmt(data.todayExpense)}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Income vs Expenses (Last 6 Days)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R${v / 1000}k`} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Area type="monotone" dataKey="income"  stroke="#22c55e" fill="url(#income)"  strokeWidth={2} name="Income" />
            <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#expense)" strokeWidth={2} name="Expense" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white rounded-xl border">
        <div className="p-5 border-b">
          <h2 className="text-base font-semibold text-gray-900">Vehicle Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Vehicle</th>
                <th className="px-4 py-3 text-left">Registration</th>
                <th className="px-4 py-3 text-left">From</th>
                <th className="px-4 py-3 text-left">To</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.vehicleStatuses.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No active trips</td></tr>
              ) : (
                data.vehicleStatuses.map((v, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{v.vehicleName}</td>
                    <td className="px-4 py-3 text-gray-500">{v.registrationNo}</td>
                    <td className="px-4 py-3 text-gray-500 truncate max-w-xs">{v.fromLocation}</td>
                    <td className="px-4 py-3 text-gray-500 truncate max-w-xs">{v.toLocation}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[v.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {v.status}
                      </span>
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
