import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import {
  Plus, Trash2, Loader2, AlertCircle, Container,
  MapPin, Package, ChevronDown, ChevronUp, CheckCircle2,
  Route, Weight, AlertTriangle, ClipboardCheck,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { format } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRAILER_TYPES = ['FLAT_12M', 'SUPERLINK_FLAT_DECK', 'TAUTLINER', 'LOWBED'] as const;
type TrailerType = typeof TRAILER_TYPES[number];

const TRAILER_LABELS: Record<TrailerType, string> = {
  FLAT_12M:            '12m Flat Deck',
  SUPERLINK_FLAT_DECK: 'Superlink Flat Deck',
  TAUTLINER:           'Tautliner',
  LOWBED:              'Lowbed',
};

const TRAILER_COLORS: Record<TrailerType, string> = {
  FLAT_12M:            'bg-blue-100 text-blue-800',
  SUPERLINK_FLAT_DECK: 'bg-purple-100 text-purple-800',
  TAUTLINER:           'bg-green-100 text-green-800',
  LOWBED:              'bg-orange-100 text-orange-800',
};

const JOB_STATUS_COLORS: Record<string, string> = {
  PLANNED:    'bg-gray-100 text-gray-700',
  LOADING:    'bg-yellow-100 text-yellow-700',
  IN_TRANSIT: 'bg-blue-100 text-blue-700',
  DELIVERED:  'bg-green-100 text-green-700',
  CANCELLED:  'bg-red-100 text-red-700',
};

const SPECIAL_REQS = ['STANDARD', 'OVERSIZED', 'HAZARDOUS', 'FRAGILE', 'HEAVY_LIFT'] as const;
type SpecialReq = typeof SPECIAL_REQS[number];

const SPECIAL_COLORS: Record<SpecialReq, string> = {
  STANDARD:   'bg-gray-100 text-gray-600',
  OVERSIZED:  'bg-orange-100 text-orange-700',
  HAZARDOUS:  'bg-red-100 text-red-700',
  FRAGILE:    'bg-yellow-100 text-yellow-700',
  HEAVY_LIFT: 'bg-purple-100 text-purple-700',
};

type Tab = 'jobs' | 'routes' | 'compatibility';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Cargo {
  id: number; jobId: number; description: string; quantity: number;
  weightPerUnit: number; totalWeight: number;
  lengthM?: number; widthM?: number; heightM?: number;
  specialRequirement: SpecialReq; notes?: string;
}

interface Job {
  id: number; reference: string; trailerType: TrailerType;
  trailer?: { id: number; registrationNo: string; category: string; loadCapacity?: number };
  vehicle?: { id: number; name: string; registrationNo: string };
  driverName?: string; origin: string; destination: string;
  plannedDate: string; deliveredAt?: string;
  status: string; totalWeight: number; notes?: string;
  cargo: Cargo[];
}

interface RouteRecord {
  id: number; name: string; origin: string; destination: string;
  distanceKm?: number; maxWeightTonnes?: number; maxHeightM?: number; maxLengthM?: number;
  allows12mFlat: boolean; allowsSuperlink: boolean; allowsTautliner: boolean; allowsLowbed: boolean;
  notes?: string; isActive: boolean;
}

interface TrailerOption { id: number; registrationNo: string; category: string; loadCapacity?: number; }
interface VehicleOption { id: number; name: string; registrationNo: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : format(d, 'dd MMM yyyy');
};

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}

function PageLoading() {
  return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={32} /></div>;
}

function PageError({ msg }: { msg: string }) {
  return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20} /><span>{msg}</span></div>;
}

// ─── Zod schemas (frontend) ───────────────────────────────────────────────────

const cargoItem = z.object({
  description:        z.string().min(1, 'Description required'),
  quantity:           z.coerce.number().int().positive().default(1),
  weightPerUnit:      z.coerce.number().positive('Weight required'),
  lengthM:            z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  widthM:             z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  heightM:            z.coerce.number().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  specialRequirement: z.enum(SPECIAL_REQS).default('STANDARD'),
  notes:              z.string().optional(),
});

const jobSchema = z.object({
  trailerType: z.enum(TRAILER_TYPES),
  trailerId:   z.coerce.number().int().positive().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v === 0 ? null : v),
  vehicleId:   z.coerce.number().int().positive().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v === 0 ? null : v),
  driverName:  z.string().optional(),
  origin:      z.string().min(1, 'Origin required'),
  destination: z.string().min(1, 'Destination required'),
  plannedDate: z.string().min(1, 'Date required'),
  notes:       z.string().optional(),
  cargo:       z.array(cargoItem).min(1, 'At least one cargo item required'),
});

const routeSchema = z.object({
  name:            z.string().min(1, 'Name required'),
  origin:          z.string().min(1, 'Origin required'),
  destination:     z.string().min(1, 'Destination required'),
  distanceKm:      z.coerce.number().positive().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
  maxWeightTonnes: z.coerce.number().positive().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
  maxHeightM:      z.coerce.number().positive().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
  maxLengthM:      z.coerce.number().positive().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
  allows12mFlat:   z.boolean().default(true),
  allowsSuperlink: z.boolean().default(true),
  allowsTautliner: z.boolean().default(true),
  allowsLowbed:    z.boolean().default(true),
  notes:           z.string().optional(),
});

type JobForm   = z.infer<typeof jobSchema>;
type RouteForm = z.infer<typeof routeSchema>;

const inp = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — JOBS (Cargo Allocation + Trailer Assignment)
// ═══════════════════════════════════════════════════════════════════════════════

function JobsTab() {
  const qc = useQueryClient();
  const [createOpen,   setCreateOpen]   = useState(false);
  const [expandedId,   setExpandedId]   = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState<TrailerType | ''>('');

  const { data: jobs = [], isLoading, isError } = useQuery<Job[]>({
    queryKey: ['flat-deck-jobs', statusFilter, typeFilter],
    queryFn: () => api.get('/flat-deck/jobs', {
      params: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(typeFilter   ? { trailerType: typeFilter } : {}),
      },
    }).then(r => r.data),
  });

  const { data: trailers = [] } = useQuery<TrailerOption[]>({
    queryKey: ['trailers-flat-deck'],
    queryFn: () => api.get('/trailers').then(r => {
      const list = Array.isArray(r.data) ? r.data : r.data?.data ?? [];
      return list.filter((t: any) => t.isActive && t.status === 'Available');
    }),
  });

  const { data: vehicles = [] } = useQuery<VehicleOption[]>({
    queryKey: ['vehicles-select'],
    queryFn: () => api.get('/vehicles').then(r => {
      const list = Array.isArray(r.data) ? r.data : r.data?.data ?? [];
      return list.filter((v: any) => v.isActive);
    }),
  });

  const form = useForm<JobForm>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      trailerType: 'FLAT_12M',
      plannedDate: new Date().toISOString().split('T')[0],
      cargo: [{ description: '', quantity: 1, weightPerUnit: 0, specialRequirement: 'STANDARD' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'cargo' });

  const createJob = useMutation({
    mutationFn: (d: JobForm) => api.post('/flat-deck/jobs', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flat-deck-jobs'] }); setCreateOpen(false); form.reset(); },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/flat-deck/jobs/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flat-deck-jobs'] }),
  });

  const deleteJob = useMutation({
    mutationFn: (id: number) => api.delete(`/flat-deck/jobs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flat-deck-jobs'] }),
  });

  if (isLoading) return <PageLoading />;
  if (isError)   return <PageError msg="Failed to load jobs." />;

  const NEXT: Record<string, string> = {
    PLANNED: 'LOADING', LOADING: 'IN_TRANSIT', IN_TRANSIT: 'DELIVERED',
  };

  return (
    <div className="space-y-5">
      {/* Filters + action */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(['', 'PLANNED', 'LOADING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s || 'All Status'}
            </button>
          ))}
          <span className="text-gray-300 mx-1">|</span>
          {(['', ...TRAILER_TYPES] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t as TrailerType | '')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t ? TRAILER_LABELS[t as TrailerType] : 'All Types'}
            </button>
          ))}
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0">
          <Plus size={16} /> Create Job
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No jobs found.</div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {
            const isExp    = expandedId === job.id;
            const nextStep = NEXT[job.status];
            return (
              <div key={job.id} className="bg-white rounded-xl border overflow-hidden">
                <div className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 shrink-0">
                    <Container size={16} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{job.reference}</p>
                      <Badge label={TRAILER_LABELS[job.trailerType]} color={TRAILER_COLORS[job.trailerType]} />
                      <Badge label={job.status.replace('_', ' ')} color={JOB_STATUS_COLORS[job.status] ?? 'bg-gray-100 text-gray-600'} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {job.origin} → {job.destination}
                      {job.driverName && ` · ${job.driverName}`}
                      {job.trailer && ` · Trailer: ${job.trailer.registrationNo}`}
                      {` · ${fmtDate(job.plannedDate)}`}
                      {` · ${job.totalWeight.toLocaleString()} kg`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {nextStep && (
                      <button onClick={() => updateStatus.mutate({ id: job.id, status: nextStep })}
                        className="text-xs border border-brand-300 text-brand-700 hover:bg-brand-50 rounded px-2 py-1 font-medium whitespace-nowrap">
                        → {nextStep.replace('_', ' ')}
                      </button>
                    )}
                    {['PLANNED', 'CANCELLED'].includes(job.status) && (
                      <button onClick={() => { if (confirm('Delete this job?')) deleteJob.mutate(job.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                    )}
                    <button onClick={() => setExpandedId(isExp ? null : job.id)} className="p-1.5 text-gray-400">
                      {isExp ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Cargo detail */}
                {isExp && (
                  <div className="border-t bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Cargo Allocation</p>
                    {job.cargo.length === 0 ? (
                      <p className="text-sm text-gray-400">No cargo items.</p>
                    ) : (
                      <div className="space-y-2">
                        {job.cargo.map(c => (
                          <div key={c.id} className="bg-white border rounded-lg px-4 py-3 flex items-center gap-4">
                            <Package size={14} className="text-gray-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800">{c.description}</p>
                              <p className="text-xs text-gray-400">
                                Qty: {c.quantity} · {c.weightPerUnit.toLocaleString()} kg/unit · Total: {c.totalWeight.toLocaleString()} kg
                                {c.lengthM && ` · ${c.lengthM}m L`}
                                {c.widthM  && ` × ${c.widthM}m W`}
                                {c.heightM && ` × ${c.heightM}m H`}
                              </p>
                            </div>
                            <Badge label={c.specialRequirement} color={SPECIAL_COLORS[c.specialRequirement] ?? 'bg-gray-100 text-gray-600'} />
                          </div>
                        ))}
                      </div>
                    )}
                    {(job.vehicle || job.trailer) && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-3 text-xs text-gray-500">
                        {job.trailer && <p><span className="font-medium text-gray-700">Trailer:</span> {job.trailer.registrationNo} ({job.trailer.category})</p>}
                        {job.vehicle && <p><span className="font-medium text-gray-700">Vehicle:</span> {job.vehicle.name} ({job.vehicle.registrationNo})</p>}
                      </div>
                    )}
                    {job.notes && <p className="text-xs text-gray-400 mt-2">Note: {job.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Job Modal */}
      <Modal title="Create Flat Deck Job" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form onSubmit={form.handleSubmit(d => createJob.mutate(d))} className="space-y-4">
          {/* Trailer type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Trailer Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {TRAILER_TYPES.map(t => {
                const selected = form.watch('trailerType') === t;
                return (
                  <label key={t}
                    className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${selected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" {...form.register('trailerType')} value={t} className="sr-only" />
                    <Badge label={TRAILER_LABELS[t]} color={TRAILER_COLORS[t]} />
                  </label>
                );
              })}
            </div>
            {form.formState.errors.trailerType && <p className="text-red-500 text-xs mt-1">{form.formState.errors.trailerType.message}</p>}
          </div>

          {/* Route */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origin *</label>
              <input {...form.register('origin')} className={inp} placeholder="e.g. Cape Town" />
              {form.formState.errors.origin && <p className="text-red-500 text-xs mt-1">{form.formState.errors.origin.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input {...form.register('destination')} className={inp} placeholder="e.g. Johannesburg" />
              {form.formState.errors.destination && <p className="text-red-500 text-xs mt-1">{form.formState.errors.destination.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planned Date *</label>
              <input type="date" {...form.register('plannedDate')} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
              <input {...form.register('driverName')} className={inp} placeholder="Driver name" />
            </div>
          </div>

          {/* Trailer & Vehicle assignment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign Trailer</label>
              <select {...form.register('trailerId')} className={inp}>
                <option value="">Unassigned</option>
                {trailers.map(t => (
                  <option key={t.id} value={t.id}>{t.registrationNo} ({t.category}{t.loadCapacity ? ` · ${(t.loadCapacity/1000).toFixed(0)} t` : ''})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign Vehicle</label>
              <select {...form.register('vehicleId')} className={inp}>
                <option value="">Unassigned</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registrationNo})</option>)}
              </select>
            </div>
          </div>

          {/* Cargo items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Cargo Allocation *</label>
              <button type="button"
                onClick={() => append({ description: '', quantity: 1, weightPerUnit: 0, specialRequirement: 'STANDARD' })}
                className="text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1">
                <Plus size={12} /> Add Item
              </button>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {fields.map((field, i) => (
                <div key={field.id} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">Item {i + 1}</span>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <input {...form.register(`cargo.${i}.description`)} placeholder="Description *" className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      {form.formState.errors.cargo?.[i]?.description && <p className="text-red-500 text-xs">{form.formState.errors.cargo[i]?.description?.message}</p>}
                    </div>
                    <div>
                      <input type="number" {...form.register(`cargo.${i}.quantity`)} placeholder="Qty" className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" defaultValue={1} />
                    </div>
                    <div>
                      <input type="number" step="0.01" {...form.register(`cargo.${i}.weightPerUnit`)} placeholder="kg per unit *" className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      {form.formState.errors.cargo?.[i]?.weightPerUnit && <p className="text-red-500 text-xs">{form.formState.errors.cargo[i]?.weightPerUnit?.message}</p>}
                    </div>
                    <div>
                      <input type="number" step="0.01" {...form.register(`cargo.${i}.lengthM`)} placeholder="Length (m)" className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                    <div>
                      <input type="number" step="0.01" {...form.register(`cargo.${i}.heightM`)} placeholder="Height (m)" className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                    <div>
                      <select {...form.register(`cargo.${i}.specialRequirement`)} className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500">
                        {SPECIAL_REQS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <input {...form.register(`cargo.${i}.notes`)} placeholder="Notes" className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {(form.formState.errors.cargo as any)?.message && <p className="text-red-500 text-xs mt-1">{(form.formState.errors.cargo as any).message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea {...form.register('notes')} rows={2} className={inp} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={createJob.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {createJob.isPending ? 'Creating…' : 'Create Job'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — ROUTE LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════

function RoutesTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RouteRecord | null>(null);

  const { data: routes = [], isLoading, isError } = useQuery<RouteRecord[]>({
    queryKey: ['flat-deck-routes'],
    queryFn: () => api.get('/flat-deck/routes').then(r => r.data),
  });

  const form = useForm<RouteForm>({
    resolver: zodResolver(routeSchema),
    defaultValues: { allows12mFlat: true, allowsSuperlink: true, allowsTautliner: true, allowsLowbed: true },
  });

  const openCreate = () => { setEditing(null); form.reset({ allows12mFlat: true, allowsSuperlink: true, allowsTautliner: true, allowsLowbed: true }); setCreateOpen(true); };
  const openEdit   = (r: RouteRecord) => { setEditing(r); form.reset({ ...r, distanceKm: r.distanceKm ?? undefined, maxWeightTonnes: r.maxWeightTonnes ?? undefined, maxHeightM: r.maxHeightM ?? undefined, maxLengthM: r.maxLengthM ?? undefined }); setCreateOpen(true); };

  const saveMut = useMutation({
    mutationFn: (d: RouteForm) => editing
      ? api.put(`/flat-deck/routes/${editing.id}`, d)
      : api.post('/flat-deck/routes', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flat-deck-routes'] }); setCreateOpen(false); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/flat-deck/routes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flat-deck-routes'] }),
  });

  if (isLoading) return <PageLoading />;
  if (isError)   return <PageError msg="Failed to load routes." />;

  const ALLOW_MAP: { key: keyof RouteRecord; type: TrailerType; label: string }[] = [
    { key: 'allows12mFlat',   type: 'FLAT_12M',            label: '12m Flat Deck' },
    { key: 'allowsSuperlink', type: 'SUPERLINK_FLAT_DECK', label: 'Superlink' },
    { key: 'allowsTautliner', type: 'TAUTLINER',           label: 'Tautliner' },
    { key: 'allowsLowbed',    type: 'LOWBED',              label: 'Lowbed' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus size={16} /> Add Route
        </button>
      </div>

      {routes.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No routes defined yet. Add routes to enable compatibility checks.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {routes.map(r => (
            <div key={r.id} className={`bg-white rounded-xl border p-5 ${!r.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <MapPin size={11} />{r.origin} → {r.destination}
                    {r.distanceKm && ` · ${r.distanceKm} km`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-brand-600 text-xs border rounded px-2">Edit</button>
                  <button onClick={() => { if (confirm('Delete route?')) deleteMut.mutate(r.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Restrictions */}
              {(r.maxWeightTonnes || r.maxHeightM || r.maxLengthM) && (
                <div className="flex gap-3 mb-3 text-xs text-gray-600 bg-orange-50 rounded-lg px-3 py-2">
                  {r.maxWeightTonnes && <span className="flex items-center gap-1"><Weight size={11} /> Max {r.maxWeightTonnes} t</span>}
                  {r.maxHeightM && <span>Max height {r.maxHeightM} m</span>}
                  {r.maxLengthM && <span>Max length {r.maxLengthM} m</span>}
                </div>
              )}

              {/* Allowed trailer types */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Allowed trailer types:</p>
                <div className="flex flex-wrap gap-2">
                  {ALLOW_MAP.map(({ key, type, label }) => (
                    <span key={key}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        r[key] ? TRAILER_COLORS[type] : 'bg-red-100 text-red-500 line-through'
                      }`}>
                      {r[key] ? <CheckCircle2 size={10} /> : '✕'} {label}
                    </span>
                  ))}
                </div>
              </div>
              {r.notes && <p className="text-xs text-gray-400 mt-2">{r.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Route Modal */}
      <Modal title={editing ? `Edit Route — ${editing.name}` : 'Add Route'} open={createOpen} onClose={() => { setCreateOpen(false); setEditing(null); }}>
        <form onSubmit={form.handleSubmit(d => saveMut.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Route Name *</label>
            <input {...form.register('name')} className={inp} placeholder="e.g. Cape Town – Johannesburg N1" />
            {form.formState.errors.name && <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origin *</label>
              <input {...form.register('origin')} className={inp} />
              {form.formState.errors.origin && <p className="text-red-500 text-xs mt-1">{form.formState.errors.origin.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input {...form.register('destination')} className={inp} />
              {form.formState.errors.destination && <p className="text-red-500 text-xs mt-1">{form.formState.errors.destination.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Distance (km)</label>
              <input type="number" step="0.1" {...form.register('distanceKm')} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Load (tonnes)</label>
              <input type="number" step="0.1" {...form.register('maxWeightTonnes')} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Height (m)</label>
              <input type="number" step="0.01" {...form.register('maxHeightM')} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Length (m)</label>
              <input type="number" step="0.01" {...form.register('maxLengthM')} className={inp} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Allowed Trailer Types</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { field: 'allows12mFlat'   as const, label: '12m Flat Deck' },
                { field: 'allowsSuperlink' as const, label: 'Superlink Flat Deck' },
                { field: 'allowsTautliner' as const, label: 'Tautliner' },
                { field: 'allowsLowbed'   as const, label: 'Lowbed' },
              ].map(({ field, label }) => (
                <label key={field} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" {...form.register(field)} className="rounded" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea {...form.register('notes')} rows={2} className={inp} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => { setCreateOpen(false); setEditing(null); }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={saveMut.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {saveMut.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Route'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — ROUTE COMPATIBILITY CHECKER
// ═══════════════════════════════════════════════════════════════════════════════

function CompatibilityTab() {
  const [result, setResult] = useState<{
    compatible: boolean;
    route: RouteRecord;
    trailerType: TrailerType;
    issues: string[];
  } | null>(null);

  const { data: routes = [] } = useQuery<RouteRecord[]>({
    queryKey: ['flat-deck-routes'],
    queryFn: () => api.get('/flat-deck/routes').then(r => r.data),
  });

  const [form, setForm] = useState({
    routeId:       '',
    trailerType:   'FLAT_12M' as TrailerType,
    totalWeightKg: '',
    maxHeightM:    '',
    maxLengthM:    '',
  });

  const checkMut = useMutation({
    mutationFn: (d: typeof form) =>
      api.post('/flat-deck/compatibility', {
        routeId:      +d.routeId,
        trailerType:   d.trailerType,
        totalWeightKg: d.totalWeightKg ? +d.totalWeightKg : undefined,
        maxHeightM:    d.maxHeightM    ? +d.maxHeightM    : undefined,
        maxLengthM:    d.maxLengthM    ? +d.maxLengthM    : undefined,
      }).then(r => r.data),
    onSuccess: (data) => setResult(data),
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardCheck size={18} className="text-brand-600" />
          <h3 className="font-semibold text-gray-900">Route Compatibility Checker</h3>
        </div>
        <p className="text-sm text-gray-500">Select a route and trailer type to instantly check if the combination is permitted and whether your cargo meets route restrictions.</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Route *</label>
            <select value={form.routeId} onChange={e => setForm(f => ({ ...f, routeId: e.target.value }))}
              className={inp}>
              <option value="">Choose a saved route…</option>
              {routes.filter(r => r.isActive).map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.origin} → {r.destination})</option>
              ))}
            </select>
            {routes.length === 0 && <p className="text-xs text-gray-400 mt-1">No routes saved yet. Add routes in the Route Library tab.</p>}
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Trailer Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {TRAILER_TYPES.map(t => (
                <label key={t}
                  className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${form.trailerType === t ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="trailerType" value={t} checked={form.trailerType === t}
                    onChange={() => setForm(f => ({ ...f, trailerType: t }))} className="sr-only" />
                  <Badge label={TRAILER_LABELS[t]} color={TRAILER_COLORS[t]} />
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Cargo Weight (kg)</label>
            <input type="number" step="0.1" value={form.totalWeightKg} onChange={e => setForm(f => ({ ...f, totalWeightKg: e.target.value }))}
              className={inp} placeholder="e.g. 28000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Cargo Height (m)</label>
            <input type="number" step="0.01" value={form.maxHeightM} onChange={e => setForm(f => ({ ...f, maxHeightM: e.target.value }))}
              className={inp} placeholder="e.g. 4.3" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Cargo Length (m)</label>
            <input type="number" step="0.01" value={form.maxLengthM} onChange={e => setForm(f => ({ ...f, maxLengthM: e.target.value }))}
              className={inp} placeholder="e.g. 12.5" />
          </div>
        </div>

        <button
          onClick={() => { if (form.routeId) checkMut.mutate(form); }}
          disabled={!form.routeId || checkMut.isPending}
          className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
          {checkMut.isPending ? <Loader2 className="animate-spin" size={16} /> : <ClipboardCheck size={16} />}
          {checkMut.isPending ? 'Checking…' : 'Check Compatibility'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-xl border p-5 ${result.compatible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3 mb-3">
            {result.compatible
              ? <CheckCircle2 size={22} className="text-green-600" />
              : <AlertTriangle size={22} className="text-red-600" />}
            <div>
              <p className={`font-semibold text-base ${result.compatible ? 'text-green-800' : 'text-red-800'}`}>
                {result.compatible ? 'Compatible — Route approved for this trailer type' : 'Incompatible — Issues found'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {TRAILER_LABELS[result.trailerType]} on {result.route.name}
              </p>
            </div>
          </div>

          {result.issues.length > 0 && (
            <ul className="space-y-1.5 mt-2">
              {result.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          )}

          {result.compatible && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-green-700">
              {result.route.maxWeightTonnes && <p>✓ Within weight limit ({result.route.maxWeightTonnes} t)</p>}
              {result.route.maxHeightM      && <p>✓ Within height clearance ({result.route.maxHeightM} m)</p>}
              {result.route.distanceKm      && <p>Route distance: {result.route.distanceKm} km</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'jobs',          label: 'Jobs & Cargo',          icon: Package },
  { key: 'routes',        label: 'Route Library',          icon: Route },
  { key: 'compatibility', label: 'Route Compatibility',    icon: ClipboardCheck },
];

export default function FlatDeckPage() {
  const [activeTab, setActiveTab] = useState<Tab>('jobs');

  const { data: stats } = useQuery({
    queryKey: ['flat-deck-stats'],
    queryFn: () => api.get('/flat-deck/stats').then(r => r.data),
  });

  const activeJobs = (stats?.byStatus ?? []).find((s: any) => s.status === 'IN_TRANSIT')?._count?.id ?? 0;
  const totalJobs  = (stats?.byStatus ?? []).reduce((s: number, b: any) => s + b._count.id, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-indigo-100">
          <Container size={22} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flat Deck Division</h1>
          <p className="text-sm text-gray-500">12m Flat Deck · Superlink · Tautliner · Lowbed</p>
        </div>
      </div>

      {/* Quick stats */}
      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Jobs</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalJobs}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">In Transit</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{activeJobs}</p>
          </div>
          {(stats.byType ?? []).slice(0, 2).map((b: any) => (
            <div key={b.trailerType} className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{TRAILER_LABELS[b.trailerType as TrailerType] ?? b.trailerType}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{b._count.id} jobs</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'jobs'          && <JobsTab />}
      {activeTab === 'routes'        && <RoutesTab />}
      {activeTab === 'compatibility' && <CompatibilityTab />}
    </div>
  );
}
