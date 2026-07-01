import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, AlertCircle, Eye, ChevronRight } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';

/* ─── Types ─── */
interface VehicleDetail {
  id: number;
  name: string;
  registrationNo: string;
  chassisNo: string;
  engineNo: string;
  isActive: boolean;
  registrationExpiry: string | null;
  createdAt: string;
  updatedAt: string;
  group: { id: number; name: string } | null;
  reminders: { id: number }[];
  _count: { trips: number };
}

interface Trip {
  id: number;
  fromLocation: string;
  toLocation: string;
  amount: number | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  customer: { id: number; name: string } | null;
  driver: { id: number; name: string } | null;
}

interface IncomeExpense {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
}

interface VehicleGroup { id: number; name: string; }

/* ─── Edit form schema ─── */
const schema = z.object({
  name: z.string().min(1, 'Vehicle name is required'),
  registrationNo: z.string().min(1, 'Registration number is required'),
  chassisNo: z.string().min(1, 'Chassis number is required'),
  engineNo: z.string().min(1, 'Engine number is required'),
  registrationExpiry: z.string().optional(),
  isActive: z.boolean().default(true),
  groupId: z.coerce.number().optional().nullable(),
});
type FormData = z.infer<typeof schema>;

/* ─── Helpers ─── */
const STATUS_BADGE: Record<Trip['status'], { label: string; variant: 'green' | 'blue' | 'yellow' | 'red' }> = {
  COMPLETED:   { label: 'Completed',   variant: 'green'  },
  IN_PROGRESS: { label: 'In Progress', variant: 'blue'   },
  PENDING:     { label: 'Pending',     variant: 'yellow' },
  CANCELLED:   { label: 'Cancelled',   variant: 'red'    },
};

const PAGE_SIZE = 5;

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtDate(dateStr: string) {
  return dateStr.split('T')[0];
}

/* ─── Page ─── */
type Tab = 'basic' | 'bookings' | 'income';

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const vehicleId = Number(id);
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('basic');
  const [editOpen, setEditOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /* bookings tab state */
  const [bSearch, setBSearch] = useState('');
  const [bPage, setBPage] = useState(1);

  /* income tab state */
  const [iPage, setIPage] = useState(1);

  /* ─── Queries ─── */
  const { data: vehicle, isLoading, isError } = useQuery<VehicleDetail>({
    queryKey: ['vehicle', vehicleId],
    queryFn: () => api.get(`/vehicles/${vehicleId}`).then(r => r.data),
    enabled: !isNaN(vehicleId),
  });

  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ['vehicle-trips', vehicleId],
    queryFn: () => api.get(`/trips?vehicleId=${vehicleId}`).then(r => r.data),
    enabled: !isNaN(vehicleId) && tab === 'bookings',
  });

  const { data: incomeExpenses = [] } = useQuery<IncomeExpense[]>({
    queryKey: ['vehicle-income', vehicleId],
    queryFn: () => api.get(`/income-expenses?vehicleId=${vehicleId}`).then(r => r.data),
    enabled: !isNaN(vehicleId) && tab === 'income',
  });

  const { data: groups = [] } = useQuery<VehicleGroup[]>({
    queryKey: ['vehicle-groups'],
    queryFn: () => api.get('/vehicles/groups').then(r => r.data),
    enabled: editOpen,
  });

  /* ─── Edit mutation ─── */
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const updateMut = useMutation({
    mutationFn: (d: any) => api.put(`/vehicles/${vehicleId}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      setEditOpen(false);
      setFormError(null);
    },
    onError: (e: any) => setFormError(e?.response?.data?.error ?? 'An unexpected error occurred.'),
  });

  const openEdit = () => {
    if (!vehicle) return;
    setFormError(null);
    reset({
      name: vehicle.name,
      registrationNo: vehicle.registrationNo,
      chassisNo: vehicle.chassisNo,
      engineNo: vehicle.engineNo,
      isActive: vehicle.isActive,
      groupId: vehicle.group?.id ?? null,
      registrationExpiry: vehicle.registrationExpiry?.split('T')[0] ?? '',
    });
    setEditOpen(true);
  };

  const onSubmit = (data: FormData) => {
    const payload: any = { ...data };
    if (!payload.groupId || payload.groupId < 1) payload.groupId = null;
    payload.registrationExpiry = payload.registrationExpiry
      ? new Date(payload.registrationExpiry).toISOString()
      : null;
    updateMut.mutate(payload);
  };

  /* ─── Bookings pagination ─── */
  const filteredTrips = trips.filter(t => {
    const q = bSearch.toLowerCase();
    return (
      (t.driver?.name ?? '').toLowerCase().includes(q) ||
      (t.customer?.name ?? '').toLowerCase().includes(q) ||
      t.fromLocation.toLowerCase().includes(q) ||
      t.toLocation.toLowerCase().includes(q)
    );
  });
  const bTotalPages = Math.max(1, Math.ceil(filteredTrips.length / PAGE_SIZE));
  const bSafePage = Math.min(bPage, bTotalPages);
  const bStart = (bSafePage - 1) * PAGE_SIZE;
  const bRows = filteredTrips.slice(bStart, bStart + PAGE_SIZE);

  /* ─── Income pagination ─── */
  const iTotalPages = Math.max(1, Math.ceil(incomeExpenses.length / PAGE_SIZE));
  const iSafePage = Math.min(iPage, iTotalPages);
  const iStart = (iSafePage - 1) * PAGE_SIZE;
  const iRows = incomeExpenses.slice(iStart, iStart + PAGE_SIZE);

  /* ─── Render ─── */
  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="animate-spin text-brand-600" size={32} />
      <p className="text-sm text-gray-400 animate-pulse">Loading...</p>
    </div>
  );

  if (isError || !vehicle) return (
    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
      <AlertCircle size={20} /><span>Failed to load vehicle details.</span>
    </div>
  );

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`px-5 py-2 text-sm font-medium rounded-sm transition-colors ${
        tab === t
          ? 'bg-brand-600 text-white'
          : 'text-gray-600 hover:text-brand-600'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Vehicle Details</h1>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Link to="/app/vehicles" className="hover:text-brand-600">Home</Link>
          <ChevronRight size={12} />
          <span className="text-gray-600">Vehicle Details</span>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* ── Left card ── */}
        <div className="w-64 shrink-0 bg-white rounded-xl border p-6 text-center space-y-4">
          <div>
            <p className="text-base font-bold text-gray-900 leading-tight">{vehicle.name}</p>
            <div className="mt-2 flex justify-center">
              <Badge label={vehicle.isActive ? 'Active' : 'Inactive'} variant={vehicle.isActive ? 'green' : 'red'} />
            </div>
          </div>
          <div className="border-t pt-4 w-full text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500 font-medium">Bookings</span>
              <span className="font-semibold text-gray-800">{vehicle._count.trips}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500 font-medium">Notifications</span>
              <span className="font-semibold text-gray-800">{vehicle.reminders.length}</span>
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 bg-white rounded-xl border overflow-hidden">
          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-3 pb-0 border-b">
            {tabBtn('basic',    'Basic Info')}
            {tabBtn('bookings', 'Bookings')}
            {tabBtn('income',   'Income & Expense')}
          </div>

          {/* ── Basic Info ── */}
          {tab === 'basic' && (
            <div className="p-6 space-y-4">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {[
                    ['Registration No', vehicle.registrationNo],
                    ['Name', vehicle.name],
                    ['Chassis No.', vehicle.chassisNo],
                    ['Engine No.', vehicle.engineNo],
                    ['License Expiry', vehicle.registrationExpiry ? fmtDate(vehicle.registrationExpiry) : '—'],
                    ['Created Date', fmt(vehicle.createdAt)],
                    ['Modified Date', fmt(vehicle.updatedAt)],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td className="py-3 pr-6 text-gray-500 font-medium w-40">{label}</td>
                      <td className="py-3 text-gray-800">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pt-2">
                <button
                  onClick={openEdit}
                  className="bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-8 py-2 rounded transition-colors"
                >
                  Edit Info
                </button>
              </div>
            </div>
          )}

          {/* ── Bookings ── */}
          {tab === 'bookings' && (
            <div>
              <div className="flex justify-end px-4 py-3 border-b">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Search:</span>
                  <input
                    value={bSearch}
                    onChange={e => { setBSearch(e.target.value); setBPage(1); }}
                    className="border rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['#', 'Driver', 'Customer', 'From & To', 'Booking Value', 'Trip Status', 'Action'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                          {bSearch ? 'No bookings match your search.' : 'No bookings found for this vehicle.'}
                        </td>
                      </tr>
                    ) : (
                      bRows.map((t, i) => {
                        const sb = STATUS_BADGE[t.status] ?? { label: t.status, variant: 'yellow' as const };
                        return (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-500">{bStart + i + 1}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">{t.driver?.name ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-600 font-medium">{t.customer?.name ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">
                              <div>{t.fromLocation}</div>
                              <span className="inline-block bg-green-500 text-white text-[10px] px-2 py-0.5 rounded my-1">to</span>
                              <div>{t.toLocation}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{t.amount ?? '—'}</td>
                            <td className="px-4 py-3">
                              <Badge label={sb.label} variant={sb.variant} />
                            </td>
                            <td className="px-4 py-3">
                              <Link to={`/app/trips/${t.id}`} className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors inline-block">
                                <Eye size={16} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {/* Bookings pagination */}
              <div className="flex items-center justify-end px-4 py-3 border-t gap-1">
                <button
                  onClick={() => setBPage(p => Math.max(1, p - 1))}
                  disabled={bSafePage === 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
                >Previous</button>
                {Array.from({ length: bTotalPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setBPage(n)}
                    className={`px-3 py-1 border rounded text-sm ${bSafePage === n ? 'bg-brand-600 text-white border-brand-600' : 'hover:bg-gray-50'}`}
                  >{n}</button>
                ))}
                <button
                  onClick={() => setBPage(p => Math.min(bTotalPages, p + 1))}
                  disabled={bSafePage === bTotalPages}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
                >Next</button>
              </div>
            </div>
          )}

          {/* ── Income & Expense ── */}
          {tab === 'income' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['#', 'Date', 'Description', 'Amount', 'Type', 'Action'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {iRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                          No income or expense records found for this vehicle.
                        </td>
                      </tr>
                    ) : (
                      iRows.map((ie, i) => (
                        <tr key={ie.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-500">{iStart + i + 1}</td>
                          <td className="px-4 py-3 text-gray-600">{fmtDate(ie.date)}</td>
                          <td className="px-4 py-3 text-gray-600">{ie.description}</td>
                          <td className="px-4 py-3 text-gray-800 font-medium">{ie.amount.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <Badge
                              label={ie.type === 'INCOME' ? 'Income' : 'Expense'}
                              variant={ie.type === 'INCOME' ? 'green' : 'red'}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Link to={`/app/income-expenses/${ie.id}`} className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors inline-block">
                              <Eye size={16} />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Income pagination */}
              <div className="flex items-center justify-end px-4 py-3 border-t gap-1">
                <button
                  onClick={() => setIPage(p => Math.max(1, p - 1))}
                  disabled={iSafePage === 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
                >Previous</button>
                {Array.from({ length: iTotalPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setIPage(n)}
                    className={`px-3 py-1 border rounded text-sm ${iSafePage === n ? 'bg-brand-600 text-white border-brand-600' : 'hover:bg-gray-50'}`}
                  >{n}</button>
                ))}
                <button
                  onClick={() => setIPage(p => Math.min(iTotalPages, p + 1))}
                  disabled={iSafePage === iTotalPages}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
                >Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit modal ── */}
      <Modal title="Edit Vehicle" open={editOpen} onClose={() => { setEditOpen(false); setFormError(null); }}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Name *</label>
              <input {...register('name')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration No *</label>
              <input {...register('registrationNo')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.registrationNo && <p className="text-red-500 text-xs mt-1">{errors.registrationNo.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chassis No *</label>
              <input {...register('chassisNo')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.chassisNo && <p className="text-red-500 text-xs mt-1">{errors.chassisNo.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Engine No *</label>
              <input {...register('engineNo')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.engineNo && <p className="text-red-500 text-xs mt-1">{errors.engineNo.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Group</label>
              <select {...register('groupId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">Select a group (Optional)</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration Expiry</label>
              <input {...register('registrationExpiry')} type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input {...register('isActive')} type="checkbox" id="isActive" className="rounded" />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
          </div>
          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={15} className="shrink-0" />{formError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => { setEditOpen(false); setFormError(null); }} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={updateMut.isPending} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
              {updateMut.isPending && <Loader2 className="animate-spin" size={16} />}
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
