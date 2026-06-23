import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Eye, FolderOpen, AlertTriangle } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { format, differenceInDays, parseISO } from 'date-fns';
import DriverDocsModal from './DriverDocsModal';

/* ── helpers ─────────────────────────────────────────── */

/** safely format a date-ish value; returns fallback on null / invalid */
const safeDate = (v: string | null | undefined, fmtStr: string, fallback = '—') => {
  if (!v) return fallback;
  const d = new Date(v);
  return isNaN(d.getTime()) ? fallback : format(d, fmtStr);
};

/**
 * Normalize API list responses. Many backends wrap arrays inside
 * { data: [...], total: ... } — this always extracts the array.
 */
const normalizeList = (res: unknown): any[] => {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    // common wrapper keys — check each
    for (const key of ['data', 'items', 'results', 'records']) {
      if (Array.isArray(obj[key])) return obj[key] as any[];
    }
  }
  return [];
};

/* ── types ──────────────────────────────────────────── */

interface Driver {
  id: number;
  name: string;
  mobile: string;
  alternativePhone: string | null;
  email: string;
  idNumber: string | null;
  nationality: string | null;
  age: number | null;
  bloodGroup: string | null;
  address: string | null;
  licenseNo: string;
  licenseType: string | null;
  licenseExpiry: string | null;
  pdpNumber: string | null;
  pdpExpiry: string | null;
  totalExperience: string | null;
  dateOfJoining: string | null;
  reference: string | null;
  notes: string | null;
  isActive: boolean;
  assignedVehicle: { id: number; name: string; registrationNo: string } | null;
  assignedTrailer: { id: number; registrationNo: string } | null;
  _count: { trips: number } | null;
}

const schema = z.object({
  name:             z.string().min(1, 'Name is required'),
  mobile:           z.string().min(1, 'Mobile is required'),
  alternativePhone: z.string().optional(),
  email:            z.string().email('Valid email required'),
  idNumber:         z.string().optional(),
  nationality:      z.string().optional(),
  age:              z.coerce.number().int().positive().optional(),
  bloodGroup:       z.string().optional(),
  address:          z.string().optional(),
  licenseNo:        z.string().min(1, 'License number is required'),
  licenseType:      z.string().optional(),
  licenseExpiry:    z.string().optional(),
  pdpNumber:        z.string().optional(),
  pdpExpiry:        z.string().optional(),
  dateOfJoining:    z.string().optional(),
  totalExperience:  z.string().optional(),
  reference:        z.string().optional(),
  notes:            z.string().optional(),
  isActive:         z.boolean().default(true),
  assignedVehicleId: z.coerce.number().optional().nullable(),
  assignedTrailerId: z.coerce.number().optional().nullable(),
});
type FormData = z.infer<typeof schema>;

interface VehicleOption { id: number; name: string; registrationNo: string; }
interface TrailerOption { id: number; registrationNo: string; }

/* ── component ──────────────────────────────────────── */

export default function DriversPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [viewDriver, setViewDriver] = useState<Driver | null>(null);
  const [docsDriverId, setDocsDriverId] = useState<number | null>(null);

  const { data: drivers = [], isLoading, isError } = useQuery<Driver[]>({
    queryKey: ['drivers'],
    queryFn: () => api.get('/drivers').then(r => normalizeList(r.data)),
  });

  const { data: vehicles = [] } = useQuery<VehicleOption[]>({
    queryKey: ['vehicles-select'],
    queryFn: () => api.get('/vehicles').then(r => normalizeList(r.data).filter((v: any) => v.isActive)),
  });

  const { data: trailers = [] } = useQuery<TrailerOption[]>({
    queryKey: ['trailers-select'],
    queryFn: () => api.get('/trailers').then(r => normalizeList(r.data).filter((t: any) => t.isActive)),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMut = useMutation({
    mutationFn: (d: FormData) => api.post('/drivers', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers'] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: (d: FormData) => api.put(`/drivers/${editing!.id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers'] }); closeModal(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/drivers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers'] }),
  });

  const openAdd = () => {
    setEditing(null);
    reset({ name: '', mobile: '', email: '', licenseNo: '', isActive: true });
    setModalOpen(true);
  };

  const openEdit = (d: Driver) => {
    setEditing(d);
    const toDate = (v: string | null | undefined) =>
      typeof v === 'string' ? v.split('T')[0] : '';
    reset({
      name:             d.name,
      mobile:           d.mobile,
      alternativePhone: d.alternativePhone  ?? '',
      email:            d.email,
      idNumber:         d.idNumber          ?? '',
      nationality:      d.nationality       ?? '',
      age:              d.age               ?? undefined,
      bloodGroup:       d.bloodGroup        ?? '',
      address:          d.address           ?? '',
      licenseNo:        d.licenseNo,
      licenseType:      d.licenseType       ?? '',
      licenseExpiry:    toDate(d.licenseExpiry),
      pdpNumber:        d.pdpNumber         ?? '',
      pdpExpiry:        toDate(d.pdpExpiry),
      dateOfJoining:    toDate(d.dateOfJoining),
      totalExperience:  d.totalExperience   ?? '',
      reference:        d.reference         ?? '',
      notes:            d.notes             ?? '',
      isActive:         d.isActive,
      assignedVehicleId: d.assignedVehicle?.id ?? null,
      assignedTrailerId: d.assignedTrailer?.id ?? null,
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); };

  if (isLoading) return <div className="flex flex-col items-center justify-center h-64 gap-3"><Loader2 className="animate-spin text-brand-600" size={32} /><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>;
  if (isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20} /><span>Failed to load drivers.</span></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Add Driver
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Mobile</th>
                <th className="px-4 py-3 text-left">License No</th>
                <th className="px-4 py-3 text-left">Assigned Vehicle</th>
                <th className="px-4 py-3 text-left">Trips</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">License Expiry</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drivers.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No drivers yet.</td></tr>
              ) : drivers.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-gray-500">{d.mobile}</td>
                  <td className="px-4 py-3 text-gray-500">{d.licenseNo}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {d.assignedVehicle ? `${d.assignedVehicle.name} (${d.assignedVehicle.registrationNo})` : '—'}
                  </td>
                  {/* FIX: guard against _count being null */}
                  <td className="px-4 py-3 text-gray-500">{d._count?.trips ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge label={d.isActive ? 'Active' : 'Inactive'} variant={d.isActive ? 'green' : 'red'} />
                  </td>
                  <td className="px-4 py-3">
                    {d.licenseExpiry ? (() => {
                      const days = differenceInDays(parseISO(d.licenseExpiry!), new Date());
                      if (days < 0)   return <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle size={12}/>Expired</span>;
                      if (days <= 30) return <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium"><AlertTriangle size={12}/>{days}d left</span>;
                      if (days <= 90) return <span className="text-xs text-yellow-600">{safeDate(d.licenseExpiry, 'dd MMM yyyy')}</span>;
                      return <span className="text-xs text-gray-500">{safeDate(d.licenseExpiry, 'dd MMM yyyy')}</span>;
                    })() : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setDocsDriverId(d.id)} title="Driver Profile & Documents"
                        className="p-1.5 text-gray-400 hover:text-brand-600"><FolderOpen size={16} /></button>
                      <button onClick={() => setViewDriver(d)} className="p-1.5 text-gray-400 hover:text-brand-600"><Eye size={16} /></button>
                      <button onClick={() => openEdit(d)} className="p-1.5 text-gray-400 hover:text-brand-600"><Pencil size={16} /></button>
                      <button onClick={() => { if (confirm(`Delete driver "${d.name}"?`)) deleteMut.mutate(d.id); }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal title={editing ? 'Edit Driver' : 'Add Driver'} open={modalOpen} onClose={closeModal} width="max-w-2xl">
        <form onSubmit={handleSubmit(d => editing ? updateMut.mutate(d) : createMut.mutate(d))} className="space-y-5">
          {/* Personal Details */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Personal Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input {...register('name')} placeholder="e.g. John Doe"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID / Passport Number</label>
                <input {...register('idNumber')} placeholder="SA ID or passport"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                <input {...register('nationality')} placeholder="e.g. South African"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                <input type="number" {...register('age')} placeholder="35"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                <select {...register('bloodGroup')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select</option>
                  {['A+','A−','B+','B−','AB+','AB−','O+','O−'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining</label>
                <input type="date" {...register('dateOfJoining')}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile *</label>
                <input {...register('mobile')} placeholder="+27 82 000 0000"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alternative Phone</label>
                <input {...register('alternativePhone')} placeholder="+27 83 000 0000"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" {...register('email')} placeholder="driver@email.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea {...register('address')} rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
          </div>

          {/* Licence & Compliance */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Licence &amp; Compliance</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Number *</label>
                <input {...register('licenseNo')}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                {errors.licenseNo && <p className="text-red-500 text-xs mt-1">{errors.licenseNo.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Type / Code</label>
                <select {...register('licenseType')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select</option>
                  {['Code 8','Code 10','Code 14','EB','EC','EC1'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry</label>
                <input type="date" {...register('licenseExpiry')}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDP Number</label>
                <input {...register('pdpNumber')} placeholder="Professional Driving Permit"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDP Expiry</label>
                <input type="date" {...register('pdpExpiry')}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
          </div>

          {/* Employment */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Employment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Experience</label>
                <input {...register('totalExperience')} placeholder="e.g. 5 years"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input {...register('reference')}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Vehicle</label>
                <select {...register('assignedVehicleId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">No vehicle</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registrationNo})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Trailer</label>
                <select {...register('assignedTrailerId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">No trailer</option>
                  {trailers.map(t => <option key={t.id} value={t.id}>{t.registrationNo}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea {...register('notes')} rows={2} placeholder="Special conditions, restrictions, etc."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" {...register('isActive')} id="driverActive" className="rounded" />
                <label htmlFor="driverActive" className="text-sm font-medium text-gray-700">Active</label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={isSubmitting || createMut.isPending || updateMut.isPending}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {(createMut.isPending || updateMut.isPending) ? 'Saving...' : editing ? 'Save Changes' : 'Add Driver'}
            </button>
          </div>
        </form>
      </Modal>

      {viewDriver && (
        <Modal title={viewDriver.name} open={!!viewDriver} onClose={() => setViewDriver(null)} width="max-w-2xl">
          <div className="space-y-5 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Personal Details</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['ID / Passport', viewDriver.idNumber],
                  ['Nationality',   viewDriver.nationality],
                  ['Age',           viewDriver.age],
                  ['Blood Group',   viewDriver.bloodGroup],
                  ['Date of Joining', safeDate(viewDriver.dateOfJoining, 'dd MMM yyyy')],
                  ['Status',        viewDriver.isActive ? 'Active' : 'Inactive'],
                ] as [string, React.ReactNode][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-gray-500">{label}</p>
                    <p className="font-medium">{value ?? '—'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Mobile',        viewDriver.mobile],
                  ['Alt. Phone',    viewDriver.alternativePhone],
                  ['Email',         viewDriver.email],
                ] as [string, React.ReactNode][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-gray-500">{label}</p>
                    <p className="font-medium">{value ?? '—'}</p>
                  </div>
                ))}
                {viewDriver.address && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Address</p>
                    <p className="font-medium">{viewDriver.address}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Licence &amp; Compliance</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['License No',     viewDriver.licenseNo],
                  ['License Type',   viewDriver.licenseType],
                  ['License Expiry', safeDate(viewDriver.licenseExpiry, 'dd MMM yyyy')],
                  ['PDP Number',     viewDriver.pdpNumber],
                  ['PDP Expiry',     safeDate(viewDriver.pdpExpiry, 'dd MMM yyyy')],
                ] as [string, React.ReactNode][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-gray-500">{label}</p>
                    <p className="font-medium">{value ?? '—'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Employment</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Experience',       viewDriver.totalExperience],
                  ['Reference',        viewDriver.reference],
                  ['Assigned Vehicle', viewDriver.assignedVehicle ? `${viewDriver.assignedVehicle.name} (${viewDriver.assignedVehicle.registrationNo})` : '—'],
                  ['Assigned Trailer', viewDriver.assignedTrailer?.registrationNo ?? '—'],
                  ['Total Trips',      viewDriver._count?.trips ?? 0],
                ] as [string, React.ReactNode][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-gray-500">{label}</p>
                    <p className="font-medium">{value ?? '—'}</p>
                  </div>
                ))}
              </div>
              {viewDriver.notes && (
                <div className="mt-3">
                  <p className="text-gray-500">Notes</p>
                  <p className="font-medium whitespace-pre-wrap">{viewDriver.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t mt-4">
            <button onClick={() => { setViewDriver(null); setDocsDriverId(viewDriver.id); }}
              className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
              <FolderOpen size={15}/> Open Documents &amp; Profile
            </button>
          </div>
        </Modal>
      )}

      <DriverDocsModal
        driverId={docsDriverId}
        open={docsDriverId !== null}
        onClose={() => setDocsDriverId(null)}
      />
    </div>
  );
}