import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, ArrowUpDown, Loader2 } from 'lucide-react';

interface Timesheet {
  id: number;
  clockIn: string;
  clockOut: string | null;
  notes: string | null;
  driver: { id: number; name: string };
}

type SortKey = 'name' | 'date' | 'start' | 'end';
type SortDir = 'asc' | 'desc';

export default function TimesheetsTab() {
  const { data, isLoading, isError } = useQuery<Timesheet[]>({
    queryKey: ['timesheets'],
    queryFn: async () => {
      const res = await api.get('/timesheets');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });

  const timesheets = data ?? [];

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

  const filtered = useMemo(
    () => timesheets.filter(t => t.driver.name.toLowerCase().includes(search.toLowerCase())),
    [timesheets, search]
  );

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.driver.name.localeCompare(b.driver.name);
      else if (sortKey === 'end') cmp = new Date(a.clockOut ?? a.clockIn).getTime() - new Date(b.clockOut ?? b.clockIn).getTime();
      else cmp = new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  const totalPages   = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage     = Math.min(page, totalPages);
  const start        = (safePage - 1) * pageSize;
  const pageRows      = sorted.slice(start, start + pageSize);
  const showingFrom  = sorted.length === 0 ? 0 : start + 1;
  const showingTo    = Math.min(start + pageSize, sorted.length);

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => toggleSort(sortKeyName)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown size={12} className={sortKey === sortKeyName ? 'text-brand-600' : 'text-gray-300'} />
      </span>
    </th>
  );

  if (isLoading) return <div className="flex flex-col items-center justify-center h-64 gap-3"><Loader2 className="animate-spin text-brand-600" size={32} /><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>;
  if (isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20} /><span>Failed to load timesheets.</span></div>;

  return (
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
              <SortHeader label="Name" sortKeyName="name" />
              <SortHeader label="Date" sortKeyName="date" />
              <SortHeader label="Start Time" sortKeyName="start" />
              <SortHeader label="End Time" sortKeyName="end" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageRows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">{search ? 'No results found.' : 'No timesheet entries yet.'}</td></tr>
            ) : pageRows.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{t.driver.name}</td>
                <td className="px-4 py-3 text-gray-500">{format(new Date(t.clockIn), 'dd MMMM yyyy')}</td>
                <td className="px-4 py-3 text-gray-500">{format(new Date(t.clockIn), 'HH:mm')}</td>
                <td className="px-4 py-3 text-gray-500">{t.clockOut ? format(new Date(t.clockOut), 'HH:mm') : '—'}</td>
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
  );
}
