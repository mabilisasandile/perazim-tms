import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, ArrowUpDown, Loader2 } from 'lucide-react';
import Badge from '../../components/ui/Badge';

interface Trip {
  id: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startDate: string;
  endDate: string | null;
  createdAt: string;
  driver: { id: number; name: string };
  vehicle: { id: number; name: string; registrationNo: string };
  customer: { id: number; name: string };
}

interface DriverOption { id: number; name: string; }

type SortKey = 'id' | 'driver' | 'date' | 'start' | 'end' | 'vehicle' | 'customer' | 'status';
type SortDir = 'asc' | 'desc';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_VARIANT: Record<Trip['status'], 'green' | 'blue' | 'yellow' | 'red'> = {
  COMPLETED:   'green',
  IN_PROGRESS: 'blue',
  PENDING:     'yellow',
  CANCELLED:   'red',
};

export default function TripSheetsTab() {
  const { data: tripsData, isLoading, isError } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: async () => {
      const res = await api.get('/trips');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  const { data: driversData } = useQuery<DriverOption[]>({
    queryKey: ['drivers'],
    queryFn: async () => {
      const res = await api.get('/drivers');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  const trips   = tripsData ?? [];
  const drivers = driversData ?? [];

  // Filter row (applied on "Filter Results")
  const [driverSel, setDriverSel] = useState('');
  const [monthSel, setMonthSel]   = useState('');
  const [yearSel, setYearSel]     = useState('');
  const [filters, setFilters]     = useState({ driverId: '', month: '', year: '' });

  const applyFilters = () => {
    setFilters({ driverId: driverSel, month: monthSel, year: yearSel });
    setPage(1);
  };

  const years = useMemo(() => {
    const set = new Set(trips.map(t => new Date(t.startDate).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [trips]);

  const [search, setSearch]     = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage]         = useState(1);
  const [sortKey, setSortKey]   = useState<SortKey>('date');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    return trips.filter(t => {
      if (filters.driverId && String(t.driver.id) !== filters.driverId) return false;
      if (filters.month && String(new Date(t.startDate).getMonth() + 1) !== filters.month) return false;
      if (filters.year && String(new Date(t.startDate).getFullYear()) !== filters.year) return false;
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        String(t.id).includes(q) ||
        t.driver.name.toLowerCase().includes(q) ||
        t.customer.name.toLowerCase().includes(q) ||
        t.vehicle.name.toLowerCase().includes(q) ||
        t.vehicle.registrationNo.toLowerCase().includes(q)
      );
    });
  }, [trips, filters, search]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'id':       cmp = a.id - b.id; break;
        case 'driver':   cmp = a.driver.name.localeCompare(b.driver.name); break;
        case 'vehicle':  cmp = a.vehicle.name.localeCompare(b.vehicle.name); break;
        case 'customer': cmp = a.customer.name.localeCompare(b.customer.name); break;
        case 'status':   cmp = a.status.localeCompare(b.status); break;
        case 'start':    cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime(); break;
        case 'end':      cmp = new Date(a.endDate ?? a.startDate).getTime() - new Date(b.endDate ?? b.startDate).getTime(); break;
        default:         cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage    = Math.min(page, totalPages);
  const start       = (safePage - 1) * pageSize;
  const pageRows    = sorted.slice(start, start + pageSize);
  const showingFrom = sorted.length === 0 ? 0 : start + 1;
  const showingTo   = Math.min(start + pageSize, sorted.length);

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => toggleSort(sortKeyName)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown size={12} className={sortKey === sortKeyName ? 'text-brand-600' : 'text-gray-300'} />
      </span>
    </th>
  );

  if (isLoading) return <div className="flex flex-col items-center justify-center h-64 gap-3"><Loader2 className="animate-spin text-brand-600" size={32} /><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>;
  if (isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20} /><span>Failed to load trip sheets.</span></div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Filter Results</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Driver</label>
            <select value={driverSel} onChange={e => setDriverSel(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Select driver...</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
            <select value={monthSel} onChange={e => setMonthSel(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Select month...</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Year</label>
            <select value={yearSel} onChange={e => setYearSel(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Select year...</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <button onClick={applyFilters} className="mt-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          Filter Results
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b gap-4 flex-wrap">
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
                <SortHeader label="Trip ID" sortKeyName="id" />
                <SortHeader label="Driver Name" sortKeyName="driver" />
                <SortHeader label="Date" sortKeyName="date" />
                <SortHeader label="Start Date" sortKeyName="start" />
                <SortHeader label="End Date" sortKeyName="end" />
                <SortHeader label="Vehicle" sortKeyName="vehicle" />
                <SortHeader label="Customer Name" sortKeyName="customer" />
                <SortHeader label="Trip Status" sortKeyName="status" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageRows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">{search || filters.driverId || filters.month || filters.year ? 'No results found.' : 'No trips yet.'}</td></tr>
              ) : pageRows.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{t.id}</td>
                  <td className="px-4 py-3 text-gray-500">{t.driver.name}</td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm:ss')}</td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(t.startDate), 'yyyy-MM-dd')}</td>
                  <td className="px-4 py-3 text-gray-500">{t.endDate ? format(new Date(t.endDate), 'yyyy-MM-dd') : '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{t.vehicle.name} ({t.vehicle.registrationNo})</td>
                  <td className="px-4 py-3 text-gray-500">{t.customer.name}</td>
                  <td className="px-4 py-3">
                    <Badge label={t.status.toLowerCase().replace('_', ' ')} variant={STATUS_VARIANT[t.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
          <span>{sorted.length === 0 ? 'No entries' : `Showing ${showingFrom} to ${showingTo} of ${sorted.length} entries`}</span>
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
