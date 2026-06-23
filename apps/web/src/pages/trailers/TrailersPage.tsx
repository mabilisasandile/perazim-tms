import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Pencil, Trash2, Loader2, AlertCircle, Eye,
  CheckCircle2, Wrench, TruckIcon, Container,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';

/* ── constants ──────────────────────────────────────────── */
const CATEGORIES = ['Flat Deck', 'Superlink', 'Lowbed', 'Tautliner'] as const;
const STATUSES   = ['Available', 'In Use', 'Under Maintenance']       as const;
type Category = typeof CATEGORIES[number];
type Status   = typeof STATUSES[number];

/* ── types ─────────────────────────────────────────────── */
interface Trailer {
  id: number;
  registrationNo: string;
  make: string | null;
  type: string | null;
  category: Category | null;
  chassisNo: string | null;
  loadCapacity: number | null;
  colour: string | null;
  licenseNo: string | null;
  licenseExpiry: string | null;
  status: Status;
  isActive: boolean;
  assignedVehicle: { id: number; name: string; registrationNo: string } | null;
  _count: { trips: number };
}
interface Availability { available: number; inUse: number; maintenance: number; total: number; }
interface VehicleOption { id: number; name: string; registrationNo: string; }

/* ── form schema ────────────────────────────────────────── */
const schema = z.object({
  registrationNo:    z.string().min(1, 'Registration number is required'),
  make:              z.string().optional(),
  category:          z.enum(CATEGORIES).optional().nullable(),
  chassisNo:         z.string().optional(),
  loadCapacity:      z.coerce.number().positive().optional().nullable(),
  colour:            z.string().optional(),
  licenseNo:         z.string().optional(),
  licenseExpiry:     z.string().optional(),
  status:            z.enum(STATUSES).default('Available'),
  isActive:          z.boolean().default(true),
  assignedVehicleId: z.preprocess(
    v => (!v || v === '' || Number(v) === 0) ? null : Number(v),
    z.number().int().positive().optional().nullable()
  ),
});
type FormData = z.infer<typeof schema>;

/* ── helpers ────────────────────────────────────────────── */
const safeDate = (v: string | null | undefined, fallback = '—') => {
  if (!v) return fallback;
  const d = new Date(v);
  return isNaN(d.getTime()) ? fallback : format(d, 'dd MMM yyyy');
};
const norm = (r: unknown): any[] => {
  if (Array.isArray(r)) return r;
  if (r && typeof r === 'object')
    for (const k of ['data','items','results']) if (Array.isArray((r as any)[k])) return (r as any)[k];
  return [];
};

const statusMeta: Record<Status, { label: string; variant: 'green'|'blue'|'yellow'; icon: React.ElementType }> = {
  'Available':         { label: 'Available',         variant: 'green',  icon: CheckCircle2 },
  'In Use':            { label: 'In Use',             variant: 'blue',   icon: TruckIcon    },
  'Under Maintenance': { label: 'Under Maintenance',  variant: 'yellow', icon: Wrench       },
};

const isLicenseExpiringSoon = (expiry: string | null) => {
  if (!expiry) return false;
  const days = (new Date(expiry).getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 30;
};
const isLicenseExpired = (expiry: string | null) => {
  if (!expiry) return false;
  return new Date(expiry).getTime() < Date.now();
};

const inp = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';

/* ── component ──────────────────────────────────────────── */
export default function TrailersPage() {
  const qc = useQueryClient();
  const [modalOpen,      setModalOpen]      = useState(false);
  const [editing,        setEditing]        = useState<Trailer | null>(null);
  const [viewing,        setViewing]        = useState<Trailer | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<Category | ''>('');
  const [statusFilter,   setStatusFilter]   = useState<Status | ''>('');
  const [formError,      setFormError]      = useState<string | null>(null);

  /* queries */
  const { data: trailers = [], isLoading, isError } = useQuery<Trailer[]>({
    queryKey: ['trailers'],
    queryFn: () => api.get('/trailers').then(r => norm(r.data)),
  });
  const { data: availability } = useQuery<Availability>({
    queryKey: ['trailer-availability'],
    queryFn: () => api.get('/trailers/availability').then(r => r.data),
  });
  const { data: vehicles = [] } = useQuery<VehicleOption[]>({
    queryKey: ['vehicles-select'],
    queryFn: () => api.get('/vehicles').then(r => norm(r.data).filter((v: any) => v.isActive)),
  });

  /* mutations */
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'Available', isActive: true },
  });

  const onMutError = (e: any) => setFormError(e?.response?.data?.error ?? 'An unexpected error occurred.');

  const createMut = useMutation({
    mutationFn: (d: FormData) => api.post('/trailers', prep(d)),
    onSuccess: () => { invalidate(); close(); },
    onError: onMutError,
  });
  const updateMut = useMutation({
    mutationFn: (d: FormData) => api.put(`/trailers/${editing!.id}`, prep(d)),
    onSuccess: () => { invalidate(); close(); },
    onError: onMutError,
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Status }) =>
      api.patch(`/trailers/${id}/status`, { status }),
    onSuccess: () => invalidate(),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/trailers/${id}`),
    onSuccess: () => invalidate(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['trailers'] });
    qc.invalidateQueries({ queryKey: ['trailer-availability'] });
  };

  const prep = (d: FormData) => ({
    ...d,
    licenseExpiry:     d.licenseExpiry ? new Date(d.licenseExpiry).toISOString() : null,
    loadCapacity:      d.loadCapacity  || null,
    assignedVehicleId: d.assignedVehicleId || null,
  });

  const openAdd = () => {
    setEditing(null);
    setFormError(null);
    reset({ registrationNo: '', status: 'Available', isActive: true });
    setModalOpen(true);
  };
  const openEdit = (t: Trailer) => {
    setEditing(t);
    setFormError(null);
    reset({
      registrationNo:    t.registrationNo,
      make:              t.make              ?? '',
      category:          t.category          ?? undefined,
      chassisNo:         t.chassisNo         ?? '',
      loadCapacity:      t.loadCapacity      ?? undefined,
      colour:            t.colour            ?? '',
      licenseNo:         t.licenseNo         ?? '',
      licenseExpiry:     t.licenseExpiry     ? t.licenseExpiry.split('T')[0] : '',
      status:            t.status,
      isActive:          t.isActive,
      assignedVehicleId: t.assignedVehicle?.id ?? null,
    });
    setModalOpen(true);
  };
  const close = () => { setModalOpen(false); setEditing(null); setFormError(null); };

  /* filtered list */
  const displayed = trailers.filter(t =>
    (!categoryFilter || t.category === categoryFilter) &&
    (!statusFilter   || t.status   === statusFilter)
  );

  if (isLoading) return <div className="flex flex-col items-center justify-center h-64 gap-3"><Loader2 className="animate-spin text-brand-600" size={32} /><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>;
  if (isError)   return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20}/><span>Failed to load trailers.</span></div>;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Trailer Management</h1>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus size={16}/> Register Trailer
        </button>
      </div>

      {/* Availability stats */}
      {availability && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Active',       value: availability.total,       cls: 'text-gray-900',  bg: 'bg-white' },
            { label: 'Available',          value: availability.available,   cls: 'text-green-600', bg: 'bg-green-50' },
            { label: 'In Use',             value: availability.inUse,       cls: 'text-blue-600',  bg: 'bg-blue-50' },
            { label: 'Under Maintenance',  value: availability.maintenance, cls: 'text-yellow-600',bg: 'bg-yellow-50' },
          ].map(({ label, value, cls, bg }) => (
            <div key={label} className={`${bg} rounded-xl border p-5`}>
              <p className="text-sm text-gray-500">{label}</p>
              <p className={`text-3xl font-bold mt-1 ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCategoryFilter('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${categoryFilter === '' ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600 hover:border-brand-500'}`}>
            All Categories
          </button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategoryFilter(c === categoryFilter ? '' : c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${categoryFilter === c ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600 hover:border-brand-500'}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5 flex-wrap ml-auto">
          <button onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === '' ? 'bg-gray-700 text-white' : 'bg-white border text-gray-600 hover:border-gray-400'}`}>
            All Statuses
          </button>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s === statusFilter ? '' : s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-gray-700 text-white' : 'bg-white border text-gray-600 hover:border-gray-400'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Registration</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Make</th>
                <th className="px-4 py-3 text-left">Capacity</th>
                <th className="px-4 py-3 text-left">Assigned Truck</th>
                <th className="px-4 py-3 text-left">License</th>
                <th className="px-4 py-3 text-left">Trips</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No trailers found.</td></tr>
              ) : displayed.map(t => {
                const sm  = statusMeta[t.status] ?? statusMeta['Available'];
                const exp = t.licenseExpiry;
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.registrationNo}</div>
                      {!t.isActive && <span className="text-xs text-red-500">Inactive</span>}
                    </td>
                    <td className="px-4 py-3">
                      {t.category
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full font-medium">
                            <Container size={11}/>{t.category}
                          </span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t.make ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{t.loadCapacity ? `${t.loadCapacity.toLocaleString()} kg` : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {t.assignedVehicle
                        ? <span className="flex items-center gap-1"><TruckIcon size={13} className="text-brand-500"/>{t.assignedVehicle.name} <span className="text-xs text-gray-400">({t.assignedVehicle.registrationNo})</span></span>
                        : <span className="text-gray-300">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">
                      {exp ? (
                        <span className={isLicenseExpired(exp) ? 'text-red-600 font-medium' : isLicenseExpiringSoon(exp) ? 'text-yellow-600 font-medium' : 'text-gray-500'}>
                          {safeDate(exp)}
                          {isLicenseExpired(exp)     && <span className="ml-1 text-xs">(Expired)</span>}
                          {isLicenseExpiringSoon(exp) && !isLicenseExpired(exp) && <span className="ml-1 text-xs">(Soon)</span>}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t._count?.trips ?? 0}</td>
                    <td className="px-4 py-3"><Badge label={sm.label} variant={sm.variant}/></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewing(t)} className="p-1.5 text-gray-400 hover:text-brand-600" title="View"><Eye size={15}/></button>
                        <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-brand-600" title="Edit"><Pencil size={15}/></button>
                        {/* Quick status cycle */}
                        {t.status === 'Available' && (
                          <button onClick={() => statusMut.mutate({ id: t.id, status: 'In Use' })}
                            className="p-1.5 text-gray-400 hover:text-blue-600" title="Mark In Use">
                            <TruckIcon size={15}/>
                          </button>
                        )}
                        {t.status === 'In Use' && (
                          <button onClick={() => statusMut.mutate({ id: t.id, status: 'Available' })}
                            className="p-1.5 text-gray-400 hover:text-green-600" title="Mark Available">
                            <CheckCircle2 size={15}/>
                          </button>
                        )}
                        {t.status !== 'Under Maintenance' && (
                          <button onClick={() => statusMut.mutate({ id: t.id, status: 'Under Maintenance' })}
                            className="p-1.5 text-gray-400 hover:text-yellow-600" title="Send to Maintenance">
                            <Wrench size={15}/>
                          </button>
                        )}
                        <button onClick={() => confirm(`Delete trailer "${t.registrationNo}"?`) && deleteMut.mutate(t.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={15}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal title={editing ? `Edit — ${editing.registrationNo}` : 'Register Trailer'} open={modalOpen} onClose={close} width="max-w-2xl">
        <form onSubmit={handleSubmit(d => editing ? updateMut.mutate(d) : createMut.mutate(d))} className="space-y-4">

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Identification</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration No *</label>
              <input {...register('registrationNo')} className={inp} placeholder="e.g. CA T123-456"/>
              {errors.registrationNo && <p className="text-red-500 text-xs mt-1">{errors.registrationNo.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select {...register('category')} className={inp}>
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Make / Manufacturer</label>
              <input {...register('make')} className={inp} placeholder="e.g. Henred, Afrit"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chassis No</label>
              <input {...register('chassisNo')} className={inp}/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Load Capacity (kg)</label>
              <input type="number" {...register('loadCapacity')} className={inp} placeholder="e.g. 30000"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Colour</label>
              <input {...register('colour')} className={inp} placeholder="White"/>
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">License Details</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
              <input {...register('licenseNo')} className={inp} placeholder="License / disc number"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry Date</label>
              <input type="date" {...register('licenseExpiry')} className={inp}/>
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">Assignment & Status</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Truck</label>
              <select {...register('assignedVehicleId')} className={inp}>
                <option value="">Unassigned</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registrationNo})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select {...register('status')} className={inp}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" {...register('isActive')} id="tActive" className="rounded"/>
              <label htmlFor="tActive" className="text-sm font-medium text-gray-700">Active (appears in selection dropdowns)</label>
            </div>
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={15} className="shrink-0" />{formError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={close} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSubmitting || createMut.isPending || updateMut.isPending}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="animate-spin" size={16}/>}
              {editing ? 'Save Changes' : 'Register Trailer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      {viewing && (() => {
        const sm = statusMeta[viewing.status] ?? statusMeta['Available'];
        return (
          <Modal title={viewing.registrationNo} open={!!viewing} onClose={() => setViewing(null)} width="max-w-lg">
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-gray-500">Category</p>
                  <p className="font-medium">{viewing.category ?? '—'}</p></div>
                <div><p className="text-gray-500">Status</p>
                  <div className="mt-1"><Badge label={sm.label} variant={sm.variant}/></div></div>
                <div><p className="text-gray-500">Make</p><p className="font-medium">{viewing.make ?? '—'}</p></div>
                <div><p className="text-gray-500">Chassis No</p><p className="font-medium">{viewing.chassisNo ?? '—'}</p></div>
                <div><p className="text-gray-500">Load Capacity</p>
                  <p className="font-medium">{viewing.loadCapacity ? `${viewing.loadCapacity.toLocaleString()} kg` : '—'}</p></div>
                <div><p className="text-gray-500">Colour</p><p className="font-medium">{viewing.colour ?? '—'}</p></div>
                <div><p className="text-gray-500">License No</p><p className="font-medium">{viewing.licenseNo ?? '—'}</p></div>
                <div><p className="text-gray-500">License Expiry</p>
                  <p className={`font-medium ${isLicenseExpired(viewing.licenseExpiry) ? 'text-red-600' : isLicenseExpiringSoon(viewing.licenseExpiry) ? 'text-yellow-600' : ''}`}>
                    {safeDate(viewing.licenseExpiry)}
                    {isLicenseExpired(viewing.licenseExpiry)     && ' — Expired'}
                    {isLicenseExpiringSoon(viewing.licenseExpiry) && !isLicenseExpired(viewing.licenseExpiry) && ' — Expiring Soon'}
                  </p></div>
                <div><p className="text-gray-500">Assigned Truck</p>
                  <p className="font-medium">
                    {viewing.assignedVehicle
                      ? `${viewing.assignedVehicle.name} (${viewing.assignedVehicle.registrationNo})`
                      : 'Unassigned'}
                  </p></div>
                <div><p className="text-gray-500">Total Trips</p><p className="font-medium">{viewing._count?.trips ?? 0}</p></div>
                <div><p className="text-gray-500">Active</p><p className="font-medium">{viewing.isActive ? 'Yes' : 'No'}</p></div>
              </div>

              {/* Quick status change from view */}
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Status Update</p>
                <div className="flex gap-2">
                  {STATUSES.map(s => (
                    <button key={s}
                      onClick={() => { statusMut.mutate({ id: viewing.id, status: s }); setViewing({ ...viewing, status: s }); }}
                      disabled={viewing.status === s}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                        ${viewing.status === s
                          ? 'bg-brand-600 text-white border-brand-600 cursor-default'
                          : 'bg-white text-gray-600 hover:border-brand-500'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

    </div>
  );
}
