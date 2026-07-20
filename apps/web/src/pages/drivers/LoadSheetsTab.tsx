import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, PlusCircle, Loader2, AlertCircle, Eye, Pencil, ArrowUpDown } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { format } from 'date-fns';

/* ── helpers ─────────────────────────────────────────── */

const norm = (r: unknown): any[] => {
  if (Array.isArray(r)) return r;
  if (r && typeof r === 'object') for (const k of ['data', 'items', 'results', 'records']) if (Array.isArray((r as any)[k])) return (r as any)[k];
  return [];
};

const safeDate = (v: string | null | undefined, fmtStr: string, fallback = '—') => {
  if (!v) return fallback;
  const d = new Date(v);
  return isNaN(d.getTime()) ? fallback : format(d, fmtStr);
};

/* ── types ──────────────────────────────────────────── */

interface LoadSheetVehicle { id: number; tripId: number; status: string; trip?: TripOption; orderNumber?: string | null; invoiceNumber?: string | null; }
interface LoadSheet {
  id: number; loadSheetNo: string; status: string; notes: string | null;
  createdAt: string; startDate: string | null; endDate: string | null;
  pickupLocation: string | null; dropOffLocation: string | null;
  truck: { id: number; name: string; registrationNo: string };
  trailer: { id: number; registrationNo: string } | null;
  driver: { id: number; name: string; mobile: string };
  vehicles: LoadSheetVehicle[];
}

interface TripOption {
  id: number; trackingCode: string; fromLocation: string; toLocation: string;
  startDate: string; endDate: string | null;
  customer: { name: string } | null;
  vehicleCondition: string | null;
}

interface DriverOption { id: number; name: string; }
interface TruckOption { id: number; name: string; registrationNo: string; }
interface TrailerOption { id: number; registrationNo: string; }

type SortKey = 'id' | 'sheetNo' | 'date' | 'driver' | 'start' | 'end' | 'vehicle' | 'trailer' | 'loaded';
type SortDir = 'asc' | 'desc';

/* ── form schema ────────────────────────────────────── */

const itemSchema = z.object({ tripId: z.coerce.number().int().positive('Select a trip') });
const schema = z.object({
  driverId:        z.coerce.number().int().positive('Driver required'),
  truckId:         z.coerce.number().int().positive('Truck required'),
  trailerId:       z.coerce.number().int().positive().optional().nullable(),
  startDate:       z.string().optional(),
  endDate:         z.string().optional(),
  pickupLocation:  z.string().optional(),
  dropOffLocation: z.string().optional(),
  notes:           z.string().optional(),
  items:           z.array(itemSchema).min(1, 'Add at least one load sheet item'),
});
type FormData = z.infer<typeof schema>;

const emptyItem = { tripId: undefined as unknown as number };

/* ── component ──────────────────────────────────────── */

export default function LoadSheetsTab() {
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<LoadSheet | null>(null);
  const [editing, setEditing] = useState<LoadSheet | null>(null);

  const { data: sheetsRaw = [], isLoading, isError } = useQuery<LoadSheet[]>({
    queryKey: ['drivers-loadsheets'],
    queryFn: () => api.get('/loadsheets', { params: { limit: 200 } }).then(r => norm(r.data)),
  });
  const sheets = sheetsRaw;

  const { data: drivers = [] } = useQuery<DriverOption[]>({
    queryKey: ['drivers-select'],
    queryFn: () => api.get('/drivers').then(r => norm(r.data).filter((d: any) => d.isActive)),
  });
  const { data: trucks = [] } = useQuery<TruckOption[]>({
    queryKey: ['vehicles-select'],
    queryFn: () => api.get('/vehicles').then(r => norm(r.data).filter((v: any) => v.isActive)),
  });
  const { data: trailers = [] } = useQuery<TrailerOption[]>({
    queryKey: ['trailers-select'],
    queryFn: () => api.get('/trailers').then(r => norm(r.data).filter((t: any) => t.isActive)),
  });

  const { register, handleSubmit, control, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { items: [emptyItem] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const selectedDriverId = watch('driverId');

  const { data: driverTrips = [] } = useQuery<TripOption[]>({
    queryKey: ['drivers-loadsheets-trips', selectedDriverId],
    queryFn: () => api.get('/trips', { params: { driverId: selectedDriverId } }).then(r => norm(r.data)),
    enabled: !!selectedDriverId,
  });

  const takenTripIds = useMemo(
    () => new Set(sheets.flatMap(s => s.vehicles.map(v => v.tripId))),
    [sheets]
  );
  const availableTrips = useMemo(
    () => driverTrips.filter(t => !takenTripIds.has(t.id)),
    [driverTrips, takenTripIds]
  );

  const createMut = useMutation({
    mutationFn: (d: FormData) => api.post('/loadsheets', {
      truckId:         d.truckId,
      trailerId:       d.trailerId || null,
      driverId:        d.driverId,
      startDate:       d.startDate || undefined,
      endDate:         d.endDate || undefined,
      pickupLocation:  d.pickupLocation || undefined,
      dropOffLocation: d.dropOffLocation || undefined,
      notes:           d.notes || undefined,
      items:           d.items.map(i => ({ tripId: i.tripId })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers-loadsheets'] });
      reset({ items: [emptyItem] } as any);
    },
  });

  const updateMut = useMutation({
    mutationFn: (d: { id: number; trailerId: number | null; startDate: string; endDate: string; pickupLocation: string; dropOffLocation: string; notes: string }) =>
      api.put(`/loadsheets/${d.id}`, {
        trailerId:       d.trailerId,
        startDate:       d.startDate || null,
        endDate:         d.endDate || null,
        pickupLocation:  d.pickupLocation || null,
        dropOffLocation: d.dropOffLocation || null,
        notes:           d.notes || null,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers-loadsheets'] }); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/loadsheets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers-loadsheets'] }),
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Failed to delete load sheet.'),
  });

  const { data: viewingDetail } = useQuery<LoadSheet>({
    queryKey: ['drivers-loadsheet-detail', viewing?.id],
    queryFn: () => api.get(`/loadsheets/${viewing!.id}`).then(r => r.data),
    enabled: !!viewing,
  });

  /* ── table state ──────────────────────────────────── */

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
    const q = search.toLowerCase();
    if (!q) return sheets;
    return sheets.filter(s =>
      s.loadSheetNo.toLowerCase().includes(q) ||
      s.driver.name.toLowerCase().includes(q) ||
      s.truck.name.toLowerCase().includes(q) ||
      s.truck.registrationNo.toLowerCase().includes(q) ||
      (s.trailer?.registrationNo ?? '').toLowerCase().includes(q)
    );
  }, [sheets, search]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'id':      cmp = a.id - b.id; break;
        case 'sheetNo': cmp = a.loadSheetNo.localeCompare(b.loadSheetNo); break;
        case 'driver':  cmp = a.driver.name.localeCompare(b.driver.name); break;
        case 'vehicle': cmp = a.truck.name.localeCompare(b.truck.name); break;
        case 'trailer': cmp = (a.trailer?.registrationNo ?? '').localeCompare(b.trailer?.registrationNo ?? ''); break;
        case 'loaded':  cmp = a.vehicles.length - b.vehicles.length; break;
        case 'start':   cmp = new Date(a.startDate ?? a.createdAt).getTime() - new Date(b.startDate ?? b.createdAt).getTime(); break;
        case 'end':     cmp = new Date(a.endDate ?? a.createdAt).getTime() - new Date(b.endDate ?? b.createdAt).getTime(); break;
        default:        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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

  const inp = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  if (isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20} /><span>Failed to load load sheets.</span></div>;

  return (
    <div className="space-y-6">
      {/* New Loadsheet form */}
      <div className="bg-white rounded-xl border p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">New Loadsheet</p>
        <form onSubmit={handleSubmit(d => createMut.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Driver</label>
              <select {...register('driverId')} className={`${inp} bg-white`}>
                <option value="">Select driver...</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {errors.driverId && <p className="text-red-500 text-xs mt-1">{errors.driverId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Truck</label>
              <select {...register('truckId')} className={`${inp} bg-white`}>
                <option value="">Select truck...</option>
                {trucks.map(t => <option key={t.id} value={t.id}>{t.name} ({t.registrationNo})</option>)}
              </select>
              {errors.truckId && <p className="text-red-500 text-xs mt-1">{errors.truckId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Trailer</label>
              <select {...register('trailerId')} className={`${inp} bg-white`}>
                <option value="">Select trailer...</option>
                {trailers.map(t => <option key={t.id} value={t.id}>{t.registrationNo}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" {...register('startDate')} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" {...register('endDate')} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
              <input {...register('pickupLocation')} placeholder="Enter a location" className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Drop Off Location</label>
              <input {...register('dropOffLocation')} placeholder="Enter a location" className={inp} />
            </div>
          </div>

          <textarea {...register('notes')} rows={2} placeholder="Add notes here" className={inp} />

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Load Sheet Items</p>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="flex items-center gap-2">
                  <select {...register(`items.${i}.tripId`)} className={`${inp} bg-white`}>
                    <option value="">Select trip...</option>
                    {availableTrips.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.trackingCode} — {t.customer?.name ?? 'Unknown'} ({t.fromLocation} → {t.toLocation})
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => fields.length > 1 && remove(i)}
                    className="shrink-0 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            {errors.items?.root && <p className="text-red-500 text-xs mt-1">{errors.items.root.message}</p>}
            {!selectedDriverId && <p className="text-xs text-gray-400 mt-1">Select a driver to see their available trips.</p>}
            <button type="button" onClick={() => append(emptyItem)}
              className="mt-3 flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-3 py-2 rounded-lg">
              <PlusCircle size={14} /> Add a New Line
            </button>
          </div>

          <button type="submit" disabled={isSubmitting || createMut.isPending}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">
            {createMut.isPending && <Loader2 className="animate-spin" size={16} />} Create Load Sheet
          </button>
          {createMut.isError && <p className="text-red-500 text-xs">{(createMut.error as any)?.response?.data?.message ?? 'Failed to create load sheet.'}</p>}
        </form>
      </div>

      {/* Results table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3"><Loader2 className="animate-spin text-brand-600" size={32} /><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>
      ) : (
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
                  <SortHeader label="Sheet ID" sortKeyName="id" />
                  <SortHeader label="Sheet No." sortKeyName="sheetNo" />
                  <SortHeader label="Date" sortKeyName="date" />
                  <SortHeader label="Driver Name" sortKeyName="driver" />
                  <SortHeader label="Start Date" sortKeyName="start" />
                  <SortHeader label="End Date" sortKeyName="end" />
                  <SortHeader label="Vehicle" sortKeyName="vehicle" />
                  <SortHeader label="Trailer" sortKeyName="trailer" />
                  <SortHeader label="Vehicles Loaded" sortKeyName="loaded" />
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">{search ? 'No results found.' : 'No load sheets yet.'}</td></tr>
                ) : pageRows.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{s.id}</td>
                    <td className="px-4 py-3 text-gray-500">{s.loadSheetNo}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{safeDate(s.createdAt, 'yyyy-MM-dd HH:mm:ss')}</td>
                    <td className="px-4 py-3 font-medium">{s.driver.name}</td>
                    <td className="px-4 py-3 text-gray-500">{safeDate(s.startDate, 'yyyy-MM-dd')}</td>
                    <td className="px-4 py-3 text-gray-500">{safeDate(s.endDate, 'yyyy-MM-dd')}</td>
                    <td className="px-4 py-3 text-gray-500">{s.truck.name} ({s.truck.registrationNo})</td>
                    <td className="px-4 py-3 text-gray-500">{s.trailer?.registrationNo ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{s.vehicles.length}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setViewing(s)} className="p-1.5 text-gray-400 hover:text-brand-600"><Eye size={16} /></button>
                        <button onClick={() => setEditing(s)} className="p-1.5 text-gray-400 hover:text-brand-600"><Pencil size={16} /></button>
                        <button onClick={() => { if (confirm(`Delete load sheet "${s.loadSheetNo}"?`)) deleteMut.mutate(s.id); }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                      </div>
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
      )}

      {/* View modal */}
      {viewing && (
        <Modal title={`Load Sheet ${viewing.loadSheetNo}`} open={!!viewing} onClose={() => setViewing(null)} width="max-w-3xl">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><p className="text-gray-500">Driver</p><p className="font-medium">{viewing.driver.name}</p></div>
              <div><p className="text-gray-500">Truck</p><p className="font-medium">{viewing.truck.name} ({viewing.truck.registrationNo})</p></div>
              <div><p className="text-gray-500">Trailer</p><p className="font-medium">{viewing.trailer?.registrationNo ?? '—'}</p></div>
              <div><p className="text-gray-500">Status</p><p className="font-medium">{viewing.status}</p></div>
              <div><p className="text-gray-500">Start Date</p><p className="font-medium">{safeDate(viewing.startDate, 'dd MMM yyyy')}</p></div>
              <div><p className="text-gray-500">End Date</p><p className="font-medium">{safeDate(viewing.endDate, 'dd MMM yyyy')}</p></div>
              <div><p className="text-gray-500">Pickup</p><p className="font-medium">{viewing.pickupLocation ?? '—'}</p></div>
              <div><p className="text-gray-500">Drop Off</p><p className="font-medium">{viewing.dropOffLocation ?? '—'}</p></div>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-2">Loaded Trips ({(viewingDetail ?? viewing).vehicles.length})</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border rounded-lg overflow-hidden">
                  <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Tracking Code</th><th className="px-3 py-2 text-left">Pickup</th><th className="px-3 py-2 text-left">Delivery</th><th className="px-3 py-2 text-left">Order #</th><th className="px-3 py-2 text-left">Invoice #</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
                  <tbody className="divide-y">
                    {(viewingDetail ?? viewing).vehicles.map((v: any) => (
                      <tr key={v.id}>
                        <td className="px-3 py-2">{v.trip?.trackingCode ?? v.tripId}</td>
                        <td className="px-3 py-2 text-gray-500">{v.pickupLocation || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{v.deliveryLocation || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">
                          <InlineRefInput loadSheetId={(viewingDetail ?? viewing).id} vehicleId={v.id} field="orderNumber" value={v.orderNumber} />
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          <InlineRefInput loadSheetId={(viewingDetail ?? viewing).id} vehicleId={v.id} field="invoiceNumber" value={v.invoiceNumber} />
                        </td>
                        <td className="px-3 py-2 text-gray-500">{v.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {viewing.notes && <div><p className="text-gray-500 mb-1">Notes</p><p className="bg-gray-50 rounded p-3">{viewing.notes}</p></div>}
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <EditLoadSheetModal
          sheet={editing}
          trailers={trailers}
          onClose={() => setEditing(null)}
          onSave={vals => updateMut.mutate({ id: editing.id, ...vals })}
          saving={updateMut.isPending}
        />
      )}
    </div>
  );
}

/* ── edit modal ─────────────────────────────────────── */

function EditLoadSheetModal({ sheet, trailers, onClose, onSave, saving }: {
  sheet: LoadSheet;
  trailers: TrailerOption[];
  onClose: () => void;
  onSave: (vals: { trailerId: number | null; startDate: string; endDate: string; pickupLocation: string; dropOffLocation: string; notes: string }) => void;
  saving: boolean;
}) {
  const toDate = (v: string | null) => (v ? v.split('T')[0] : '');
  const [trailerId, setTrailerId]             = useState<string>(sheet.trailer?.id ? String(sheet.trailer.id) : '');
  const [startDate, setStartDate]             = useState(toDate(sheet.startDate));
  const [endDate, setEndDate]                 = useState(toDate(sheet.endDate));
  const [pickupLocation, setPickupLocation]   = useState(sheet.pickupLocation ?? '');
  const [dropOffLocation, setDropOffLocation] = useState(sheet.dropOffLocation ?? '');
  const [notes, setNotes]                     = useState(sheet.notes ?? '');
  const inp = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <Modal title={`Edit Load Sheet ${sheet.loadSheetNo}`} open onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trailer</label>
          <select value={trailerId} onChange={e => setTrailerId(e.target.value)} className={`${inp} bg-white`}>
            <option value="">No trailer</option>
            {trailers.map(t => <option key={t.id} value={t.id}>{t.registrationNo}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inp} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">End Date</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inp} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label><input value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} className={inp} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Drop Off Location</label><input value={dropOffLocation} onChange={e => setDropOffLocation(e.target.value)} className={inp} /></div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inp} />
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave({ trailerId: trailerId ? Number(trailerId) : null, startDate, endDate, pickupLocation, dropOffLocation, notes })}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Inline-editable Order # / Invoice # field ───────────────────────── */

function InlineRefInput({ loadSheetId, vehicleId, field, value }: { loadSheetId: number; vehicleId: number; field: 'orderNumber' | 'invoiceNumber'; value: string | null | undefined }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(value ?? '');
  const [saved, setSaved] = useState(false);

  const saveMut = useMutation({
    mutationFn: (val: string) => api.patch(`/loadsheets/${loadSheetId}/vehicles/${vehicleId}`, { [field]: val || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers-loadsheet-detail'] });
      qc.invalidateQueries({ queryKey: ['drivers-loadsheets'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    },
  });

  const commit = () => {
    if (draft === (value ?? '')) return; // no change, skip a needless request
    saveMut.mutate(draft);
  };

  return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      placeholder="—"
      className={`w-24 border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 ${
        saveMut.isPending ? 'opacity-60' : saved ? 'border-green-400 bg-green-50' : 'border-gray-200'
      }`}
    />
  );
}
