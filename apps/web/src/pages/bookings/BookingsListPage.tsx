import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, AlertCircle, Eye, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../lib/api';
import Badge from '../../components/ui/Badge';

interface Booking {
  id: number;
  trackingCode: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  fromLocation: string;
  toLocation: string;
  startDate: string;
  endDate: string | null;
  customerVehicleMake: string | null;
  customerVehicleColour: string | null;
  customerVehicleRegistration: string | null;
  customer: { id: number; name: string };
  vehicle: { id: number; name: string; registrationNo: string };
  driver: { id: number; name: string };
  trailer: { id: number; registrationNo: string } | null;
}

const statusMeta: Record<string, { label: string; variant: 'yellow' | 'blue' | 'green' | 'red' }> = {
  PENDING:     { label: 'Pending',     variant: 'yellow' },
  IN_PROGRESS: { label: 'In Progress', variant: 'blue' },
  COMPLETED:   { label: 'Completed',   variant: 'green' },
  CANCELLED:   { label: 'Cancelled',   variant: 'red' },
};

type SortKey = 'customer' | 'make' | 'colour' | 'reg' | 'truck' | 'trailer' | 'driver' | 'startDate' | 'endDate' | 'pickup';

export default function BookingsListPage() {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: bookings = [], isLoading, isError } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: () => api.get('/trips').then(r => r.data),
  });

  const fieldFor = (b: Booking, key: SortKey): string => {
    switch (key) {
      case 'customer': return b.customer?.name ?? '';
      case 'make':      return b.customerVehicleMake ?? '';
      case 'colour':    return b.customerVehicleColour ?? '';
      case 'reg':       return b.customerVehicleRegistration ?? '';
      case 'truck':     return b.vehicle?.registrationNo ?? '';
      case 'trailer':   return b.trailer?.registrationNo ?? '';
      case 'driver':    return b.driver?.name ?? '';
      case 'startDate': return b.startDate ?? '';
      case 'endDate':   return b.endDate ?? '';
      case 'pickup':    return b.fromLocation ?? '';
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center h-64 gap-3"><Loader2 className="animate-spin text-brand-600" size={32} /><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>;
  if (isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20} /><span>Failed to load bookings.</span></div>;

  const q = search.toLowerCase();
  let filtered = bookings.filter(b =>
    (b.customer?.name ?? '').toLowerCase().includes(q) ||
    (b.customerVehicleMake ?? '').toLowerCase().includes(q) ||
    (b.customerVehicleRegistration ?? '').toLowerCase().includes(q) ||
    (b.vehicle?.registrationNo ?? '').toLowerCase().includes(q) ||
    (b.driver?.name ?? '').toLowerCase().includes(q) ||
    (b.fromLocation ?? '').toLowerCase().includes(q)
  );

  if (sortKey) {
    filtered = [...filtered].sort((a, c) => {
      const av = fieldFor(a, sortKey), cv = fieldFor(c, sortKey);
      return sortDir === 'asc' ? av.localeCompare(cv) : cv.localeCompare(av);
    });
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const showingFrom = filtered.length === 0 ? 0 : start + 1;
  const showingTo = Math.min(start + pageSize, filtered.length);

  const Th = ({ sortableKey, children }: { sortableKey: SortKey; children: React.ReactNode }) => (
    <th className="px-4 py-3 text-left cursor-pointer select-none hover:text-gray-700" onClick={() => toggleSort(sortableKey)}>
      <span className="inline-flex items-center gap-1">{children}<ArrowUpDown size={11} className="text-gray-300" /></span>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-brand-600">
            <Link to="/app/dashboard" className="hover:underline">Dashboard</Link> / Bookings
          </span>
          <Link to="/app/bookings/add" className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Add Booking
          </Link>
          <Link to="/app/bookings/add-multi" className="flex items-center gap-2 border border-brand-600 text-brand-700 hover:bg-brand-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Multi-Vehicle Booking
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Show</span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>entries</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Search:</span>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="border rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <Th sortableKey="customer">Customer</Th>
                <Th sortableKey="make">Cust Vehicle Make</Th>
                <Th sortableKey="colour">Cust Vehicle Colour</Th>
                <Th sortableKey="reg">Cust Vehicle Reg</Th>
                <Th sortableKey="truck">Perazim Truck</Th>
                <Th sortableKey="trailer">Trailer</Th>
                <Th sortableKey="driver">Perazim Driver</Th>
                <Th sortableKey="startDate">Trip Start Date</Th>
                <Th sortableKey="endDate">Trip End Date</Th>
                <Th sortableKey="pickup">Pickup Location</Th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageRows.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400">No bookings found.</td></tr>
              ) : pageRows.map(b => {
                const sm = statusMeta[b.status];
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{b.customer?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{b.customerVehicleMake || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-500">{b.customerVehicleColour || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-500">{b.customerVehicleRegistration || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-500">{b.vehicle?.registrationNo ?? 'None'}</td>
                    <td className="px-4 py-3 text-gray-500">{b.trailer?.registrationNo ?? 'None'}</td>
                    <td className="px-4 py-3 text-gray-500">{b.driver?.name ?? 'None'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{b.startDate ? format(new Date(b.startDate), 'dd-MM-yyyy') : '—'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{b.endDate ? format(new Date(b.endDate), 'dd-MM-yyyy') : '—'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[180px]"><span className="truncate block">{b.fromLocation || '—'}</span></td>
                    <td className="px-4 py-3">{sm && <Badge label={sm.label} variant={sm.variant} />}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to="/app/trips" className="p-1.5 inline-flex text-gray-400 hover:text-brand-600" title="View in Trips"><Eye size={15} /></Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
          <span>{filtered.length === 0 ? 'No entries' : `Showing ${showingFrom} to ${showingTo} of ${filtered.length} entries`}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed">Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)} className={`px-3 py-1 border rounded text-sm ${safePage === n ? 'bg-brand-600 text-white border-brand-600' : 'hover:bg-gray-50'}`}>{n}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
