import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import {
  Plus, Trash2, Loader2, AlertCircle, Fuel, Truck,
  MapPin, Package, ChevronDown, ChevronUp, CheckCircle2,
  ClipboardList, Navigation,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { format } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────────────────────

const FUEL_TYPES = ['DIESEL', 'PETROL', 'PARAFFIN'] as const;
type FuelType = typeof FUEL_TYPES[number];

const FUEL_COLORS: Record<FuelType, string> = {
  DIESEL:   'bg-yellow-100 text-yellow-800',
  PETROL:   'bg-green-100 text-green-800',
  PARAFFIN: 'bg-blue-100 text-blue-800',
};

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  PLANNED:    'bg-gray-100 text-gray-700',
  LOADING:    'bg-yellow-100 text-yellow-700',
  IN_TRANSIT: 'bg-blue-100 text-blue-700',
  COMPLETED:  'bg-green-100 text-green-700',
  CANCELLED:  'bg-red-100 text-red-700',
};

const STOP_STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-gray-100 text-gray-600',
  DELIVERED: 'bg-green-100 text-green-700',
  SKIPPED:   'bg-red-100 text-red-600',
};

type Tab = 'tankers' | 'deliveries' | 'loads';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (v: string | null | undefined) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : format(d, 'dd MMM yyyy');
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2 }).format(n);

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Compartment {
  id: number; tankerId: number; compartmentNo: number;
  capacity: number; fuelType: FuelType; currentVolume: number; notes?: string;
}

interface Tanker {
  id: number; name: string; registrationNo: string;
  totalCapacity: number; isActive: boolean; notes?: string;
  compartments: Compartment[];
  _count: { deliveries: number; loads: number };
}

interface Stop {
  id: number; deliveryId: number; order: number;
  customerName: string; address: string; fuelType: FuelType;
  plannedVolume: number; deliveredVolume: number;
  status: string; deliveredAt?: string; notes?: string;
}

interface Delivery {
  id: number; reference: string; tankerId: number;
  tanker: { id: number; name: string; registrationNo: string };
  driverName?: string; status: string;
  plannedDate: string; departedAt?: string; completedAt?: string;
  notes?: string; stops: Stop[];
}

interface Load {
  id: number; tankerId: number;
  tanker: { id: number; name: string; registrationNo: string };
  fuelType: FuelType; volume: number;
  pricePerLitre: number; totalCost: number;
  depotName: string; driverName?: string;
  loadDate: string; notes?: string;
}

// ─── Zod schemas (frontend) ───────────────────────────────────────────────────

const tankerSchema = z.object({
  name:           z.string().min(1, 'Name required'),
  registrationNo: z.string().min(1, 'Registration required'),
  totalCapacity:  z.coerce.number().positive('Capacity must be positive'),
  notes:          z.string().optional(),
});

const compartmentSchema = z.object({
  compartmentNo: z.coerce.number().int().positive(),
  capacity:      z.coerce.number().positive('Capacity required'),
  fuelType:      z.enum(FUEL_TYPES),
  currentVolume: z.coerce.number().min(0).optional(),
  notes:         z.string().optional(),
});

const stopItemSchema = z.object({
  order:         z.coerce.number().int().positive(),
  customerName:  z.string().min(1, 'Customer required'),
  address:       z.string().min(1, 'Address required'),
  fuelType:      z.enum(FUEL_TYPES),
  plannedVolume: z.coerce.number().positive('Volume required'),
  notes:         z.string().optional(),
});

const deliverySchema = z.object({
  tankerId:   z.coerce.number().int().positive('Tanker required'),
  driverName: z.string().optional(),
  plannedDate: z.string().min(1, 'Date required'),
  notes:       z.string().optional(),
  stops:       z.array(stopItemSchema).min(1, 'At least one stop required'),
});

const loadSchema = z.object({
  tankerId:      z.coerce.number().int().positive('Tanker required'),
  fuelType:      z.enum(FUEL_TYPES),
  volume:        z.coerce.number().positive('Volume required'),
  pricePerLitre: z.coerce.number().positive('Price required'),
  depotName:     z.string().min(1, 'Depot required'),
  driverName:    z.string().optional(),
  loadDate:      z.string().min(1, 'Date required'),
  notes:         z.string().optional(),
});

type TankerForm = z.infer<typeof tankerSchema>;
type CompartmentForm = z.infer<typeof compartmentSchema>;
type DeliveryForm = z.infer<typeof deliverySchema>;
type LoadForm = z.infer<typeof loadSchema>;

// ─── Loading / Error states ───────────────────────────────────────────────────

function PageLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-600" size={32} />
    </div>
  );
}

function PageError({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
      <AlertCircle size={20} /><span>{msg}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — TANKERS & TANK ALLOCATION
// ═══════════════════════════════════════════════════════════════════════════════

function TankersTab() {
  const qc = useQueryClient();
  const [addTankerOpen, setAddTankerOpen] = useState(false);
  const [allocateFor, setAllocateFor] = useState<Tanker | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: tankers = [], isLoading, isError } = useQuery<Tanker[]>({
    queryKey: ['fuel-tankers'],
    queryFn: () => api.get('/fuel-tanker/tankers').then(r => r.data),
  });

  const tankerForm = useForm<TankerForm>({ resolver: zodResolver(tankerSchema) });
  const compartForm = useForm<CompartmentForm>({
    resolver: zodResolver(compartmentSchema),
    defaultValues: { fuelType: 'DIESEL', currentVolume: 0 },
  });

  const createTanker = useMutation({
    mutationFn: (d: TankerForm) => api.post('/fuel-tanker/tankers', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel-tankers'] });
      setAddTankerOpen(false); tankerForm.reset();
    },
  });

  const deleteTanker = useMutation({
    mutationFn: (id: number) => api.delete(`/fuel-tanker/tankers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-tankers'] }),
  });

  const createCompartment = useMutation({
    mutationFn: (d: CompartmentForm & { tankerId: number }) =>
      api.post('/fuel-tanker/compartments', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel-tankers'] });
      setAllocateFor(null); compartForm.reset();
    },
  });

  const deleteCompartment = useMutation({
    mutationFn: (id: number) => api.delete(`/fuel-tanker/compartments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-tankers'] }),
  });

  if (isLoading) return <PageLoading />;
  if (isError) return <PageError msg="Failed to load tankers." />;

  const totalCapacity = tankers.reduce((s, t) => s + t.totalCapacity, 0);
  const activeTankers = tankers.filter(t => t.isActive).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Tankers', value: tankers.length },
          { label: 'Active',        value: activeTankers },
          { label: 'Total Capacity', value: `${totalCapacity.toLocaleString()} L` },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={() => setAddTankerOpen(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus size={16} /> Add Tanker
        </button>
      </div>

      {/* Tanker cards */}
      {tankers.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
          No tankers registered yet.
        </div>
      ) : (
        <div className="space-y-4">
          {tankers.map(t => {
            const isExpanded = expandedId === t.id;
            const allocatedCapacity = t.compartments.reduce((s, c) => s + c.capacity, 0);
            const unallocated = t.totalCapacity - allocatedCapacity;

            return (
              <div key={t.id} className="bg-white rounded-xl border overflow-hidden">
                {/* Header */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100">
                      <Truck size={18} className="text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.registrationNo} · {t.totalCapacity.toLocaleString()} L total</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge label={t.isActive ? 'Active' : 'Inactive'} color={t.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} />
                    <span className="text-xs text-gray-400">{t._count.deliveries} deliveries</span>
                    <button onClick={() => setAllocateFor(t)}
                      className="text-xs text-brand-600 hover:text-brand-800 font-medium border border-brand-200 rounded px-2 py-1">
                      + Add Compartment
                    </button>
                    <button onClick={() => { if (confirm('Delete this tanker?')) deleteTanker.mutate(t.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                    <button onClick={() => setExpandedId(isExpanded ? null : t.id)} className="p-1.5 text-gray-400 hover:text-gray-700">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Compartments */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Tank Allocation</p>
                    {t.compartments.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">No compartments allocated. Add a compartment to assign fuel types.</p>
                    ) : (
                      <div className="space-y-2">
                        {t.compartments.map(c => {
                          const fillPct = c.capacity > 0 ? Math.round((c.currentVolume / c.capacity) * 100) : 0;
                          return (
                            <div key={c.id} className="bg-white border rounded-lg p-3 flex items-center gap-4">
                              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                {c.compartmentNo}
                              </div>
                              <Badge label={c.fuelType} color={FUEL_COLORS[c.fuelType]} />
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                  <span>{c.currentVolume.toLocaleString()} / {c.capacity.toLocaleString()} L</span>
                                  <span>{fillPct}%</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${fillPct > 80 ? 'bg-green-500' : fillPct > 30 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                    style={{ width: `${fillPct}%` }}
                                  />
                                </div>
                              </div>
                              {c.notes && <p className="text-xs text-gray-400 truncate max-w-[120px]">{c.notes}</p>}
                              <button onClick={() => { if (confirm('Remove compartment?')) deleteCompartment.mutate(c.id); }}
                                className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                            </div>
                          );
                        })}
                        {unallocated > 0 && (
                          <p className="text-xs text-gray-400 pt-1">{unallocated.toLocaleString()} L unallocated capacity</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Tanker Modal */}
      <Modal title="Add Fuel Tanker" open={addTankerOpen} onClose={() => setAddTankerOpen(false)}>
        <form onSubmit={tankerForm.handleSubmit(d => createTanker.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanker Name *</label>
              <input {...tankerForm.register('name')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Tanker Alpha" />
              {tankerForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{tankerForm.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration No *</label>
              <input {...tankerForm.register('registrationNo')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. GP 123-456" />
              {tankerForm.formState.errors.registrationNo && <p className="text-red-500 text-xs mt-1">{tankerForm.formState.errors.registrationNo.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Capacity (litres) *</label>
            <input type="number" step="0.01" {...tankerForm.register('totalCapacity')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. 30000" />
            {tankerForm.formState.errors.totalCapacity && <p className="text-red-500 text-xs mt-1">{tankerForm.formState.errors.totalCapacity.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea {...tankerForm.register('notes')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setAddTankerOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={createTanker.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {createTanker.isPending ? 'Saving…' : 'Add Tanker'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Allocate Compartment Modal */}
      <Modal title={`Add Compartment — ${allocateFor?.name ?? ''}`} open={!!allocateFor} onClose={() => setAllocateFor(null)}>
        <form onSubmit={compartForm.handleSubmit(d => createCompartment.mutate({ ...d, tankerId: allocateFor!.id }))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Compartment # *</label>
              <input type="number" {...compartForm.register('compartmentNo')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="1" />
              {compartForm.formState.errors.compartmentNo && <p className="text-red-500 text-xs mt-1">{compartForm.formState.errors.compartmentNo.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type *</label>
              <select {...compartForm.register('fuelType')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (L) *</label>
              <input type="number" step="0.01" {...compartForm.register('capacity')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {compartForm.formState.errors.capacity && <p className="text-red-500 text-xs mt-1">{compartForm.formState.errors.capacity.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Volume (L)</label>
              <input type="number" step="0.01" {...compartForm.register('currentVolume')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" defaultValue={0} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input {...compartForm.register('notes')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setAllocateFor(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={createCompartment.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {createCompartment.isPending ? 'Saving…' : 'Allocate'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — DELIVERIES (Route Planning + Delivery Tracking)
// ═══════════════════════════════════════════════════════════════════════════════

function DeliveriesTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: deliveries = [], isLoading, isError } = useQuery<Delivery[]>({
    queryKey: ['fuel-tanker-deliveries', statusFilter],
    queryFn: () => api.get('/fuel-tanker/deliveries', { params: { ...(statusFilter ? { status: statusFilter } : {}) } }).then(r => r.data),
  });

  const { data: tankers = [] } = useQuery<Tanker[]>({
    queryKey: ['fuel-tankers'],
    queryFn: () => api.get('/fuel-tanker/tankers').then(r => r.data),
  });

  const form = useForm<DeliveryForm>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      plannedDate: new Date().toISOString().split('T')[0],
      stops: [{ order: 1, customerName: '', address: '', fuelType: 'DIESEL', plannedVolume: 0, notes: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'stops' });

  const createDelivery = useMutation({
    mutationFn: (d: DeliveryForm) => api.post('/fuel-tanker/deliveries', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel-tanker-deliveries'] });
      setCreateOpen(false); form.reset();
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/fuel-tanker/deliveries/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-tanker-deliveries'] }),
  });

  const updateStop = useMutation({
    mutationFn: ({ deliveryId, stopId, status, deliveredVolume }: { deliveryId: number; stopId: number; status: string; deliveredVolume?: number }) =>
      api.patch(`/fuel-tanker/deliveries/${deliveryId}/stops/${stopId}`, { status, deliveredVolume }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-tanker-deliveries'] }),
  });

  const deleteDelivery = useMutation({
    mutationFn: (id: number) => api.delete(`/fuel-tanker/deliveries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-tanker-deliveries'] }),
  });

  if (isLoading) return <PageLoading />;
  if (isError) return <PageError msg="Failed to load deliveries." />;

  const NEXT_STATUS: Record<string, string> = {
    PLANNED: 'LOADING', LOADING: 'IN_TRANSIT', IN_TRANSIT: 'COMPLETED',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {(['', 'PLANNED', 'LOADING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${statusFilter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0">
          <Plus size={16} /> Plan Route
        </button>
      </div>

      {deliveries.length === 0 ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No deliveries found.</div>
      ) : (
        <div className="space-y-3">
          {deliveries.map(d => {
            const isExp = expandedId === d.id;
            const completedStops = d.stops.filter(s => s.status === 'DELIVERED').length;
            const nextStatus = NEXT_STATUS[d.status];

            return (
              <div key={d.id} className="bg-white rounded-xl border overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-blue-100 shrink-0">
                    <Navigation size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{d.reference}</p>
                      <Badge label={d.status.replace('_', ' ')} color={DELIVERY_STATUS_COLORS[d.status] ?? 'bg-gray-100 text-gray-600'} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {d.tanker.name} ({d.tanker.registrationNo})
                      {d.driverName && ` · ${d.driverName}`}
                      {' · '}{fmtDate(d.plannedDate)}
                      {' · '}{completedStops}/{d.stops.length} stops done
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {nextStatus && (
                      <button onClick={() => updateStatus.mutate({ id: d.id, status: nextStatus })}
                        className="text-xs border border-brand-300 text-brand-700 hover:bg-brand-50 rounded px-2 py-1 font-medium">
                        → {nextStatus.replace('_', ' ')}
                      </button>
                    )}
                    {['PLANNED', 'CANCELLED'].includes(d.status) && (
                      <button onClick={() => { if (confirm('Delete delivery?')) deleteDelivery.mutate(d.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                    )}
                    <button onClick={() => setExpandedId(isExp ? null : d.id)} className="p-1.5 text-gray-400">
                      {isExp ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Stops detail */}
                {isExp && (
                  <div className="border-t bg-gray-50 p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Delivery Stops</p>
                    {d.stops.map(stop => (
                      <div key={stop.id} className="bg-white border rounded-lg p-3 flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                          {stop.order}
                        </div>
                        <MapPin size={14} className="text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{stop.customerName}</p>
                          <p className="text-xs text-gray-400 truncate">{stop.address}</p>
                        </div>
                        <Badge label={stop.fuelType} color={FUEL_COLORS[stop.fuelType]} />
                        <span className="text-xs text-gray-500 shrink-0">
                          {stop.deliveredVolume > 0
                            ? `${stop.deliveredVolume.toLocaleString()} / ${stop.plannedVolume.toLocaleString()} L`
                            : `${stop.plannedVolume.toLocaleString()} L`}
                        </span>
                        <Badge label={stop.status} color={STOP_STATUS_COLORS[stop.status] ?? 'bg-gray-100 text-gray-600'} />
                        {stop.status === 'PENDING' && d.status === 'IN_TRANSIT' && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => updateStop.mutate({ deliveryId: d.id, stopId: stop.id, status: 'DELIVERED', deliveredVolume: stop.plannedVolume })}
                              className="p-1 text-green-600 hover:bg-green-50 rounded" title="Mark delivered">
                              <CheckCircle2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {d.notes && <p className="text-xs text-gray-400 pt-1">Note: {d.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Delivery Modal */}
      <Modal title="Plan New Route" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form onSubmit={form.handleSubmit(d => createDelivery.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanker *</label>
              <select {...form.register('tankerId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select tanker</option>
                {tankers.filter(t => t.isActive).map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.registrationNo})</option>
                ))}
              </select>
              {form.formState.errors.tankerId && <p className="text-red-500 text-xs mt-1">{form.formState.errors.tankerId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planned Date *</label>
              <input type="date" {...form.register('plannedDate')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {form.formState.errors.plannedDate && <p className="text-red-500 text-xs mt-1">{form.formState.errors.plannedDate.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
              <input {...form.register('driverName')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Driver name" />
            </div>
          </div>

          {/* Stops */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Delivery Stops *</label>
              <button type="button"
                onClick={() => append({ order: fields.length + 1, customerName: '', address: '', fuelType: 'DIESEL', plannedVolume: 0, notes: '' })}
                className="text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1">
                <Plus size={12} /> Add Stop
              </button>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {fields.map((field, i) => (
                <div key={field.id} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-500">Stop {i + 1}</span>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                    )}
                  </div>
                  <input type="hidden" {...form.register(`stops.${i}.order`)} value={i + 1} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input {...form.register(`stops.${i}.customerName`)} placeholder="Customer / Site *" className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      {form.formState.errors.stops?.[i]?.customerName && <p className="text-red-500 text-xs">{form.formState.errors.stops[i]?.customerName?.message}</p>}
                    </div>
                    <div>
                      <select {...form.register(`stops.${i}.fuelType`)} className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500">
                        {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input {...form.register(`stops.${i}.address`)} placeholder="Delivery address *" className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      {form.formState.errors.stops?.[i]?.address && <p className="text-red-500 text-xs">{form.formState.errors.stops[i]?.address?.message}</p>}
                    </div>
                    <div>
                      <input type="number" step="0.01" {...form.register(`stops.${i}.plannedVolume`)} placeholder="Volume (L) *" className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      {form.formState.errors.stops?.[i]?.plannedVolume && <p className="text-red-500 text-xs">{form.formState.errors.stops[i]?.plannedVolume?.message}</p>}
                    </div>
                    <div>
                      <input {...form.register(`stops.${i}.notes`)} placeholder="Notes (optional)" className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {form.formState.errors.stops?.root && <p className="text-red-500 text-xs mt-1">{form.formState.errors.stops.root.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea {...form.register('notes')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={createDelivery.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {createDelivery.isPending ? 'Creating…' : 'Create Delivery'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — LOAD MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

function LoadsTab() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: loads = [], isLoading, isError } = useQuery<Load[]>({
    queryKey: ['fuel-tanker-loads'],
    queryFn: () => api.get('/fuel-tanker/loads').then(r => r.data),
  });

  const { data: tankers = [] } = useQuery<Tanker[]>({
    queryKey: ['fuel-tankers'],
    queryFn: () => api.get('/fuel-tanker/tankers').then(r => r.data),
  });

  const form = useForm<LoadForm>({
    resolver: zodResolver(loadSchema),
    defaultValues: { fuelType: 'DIESEL', loadDate: new Date().toISOString().split('T')[0] },
  });

  const volume = form.watch('volume') || 0;
  const ppl    = form.watch('pricePerLitre') || 0;
  const estCost = (Number(volume) * Number(ppl)).toFixed(2);

  const createLoad = useMutation({
    mutationFn: (d: LoadForm) => api.post('/fuel-tanker/loads', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fuel-tanker-loads'] });
      setCreateOpen(false); form.reset();
    },
  });

  const deleteLoad = useMutation({
    mutationFn: (id: number) => api.delete(`/fuel-tanker/loads/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-tanker-loads'] }),
  });

  if (isLoading) return <PageLoading />;
  if (isError) return <PageError msg="Failed to load records." />;

  const totalVolume = loads.reduce((s, l) => s + l.volume, 0);
  const totalCost   = loads.reduce((s, l) => s + Number(l.totalCost), 0);

  const byFuelType = FUEL_TYPES.reduce<Record<string, number>>((acc, ft) => {
    acc[ft] = loads.filter(l => l.fuelType === ft).reduce((s, l) => s + l.volume, 0);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Loads</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{loads.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Volume</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalVolume.toLocaleString()} L</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Cost</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{fmtMoney(totalCost)}</p>
        </div>
        {FUEL_TYPES.map(ft => (
          <div key={ft} className="bg-white rounded-xl border p-4">
            <p className={`text-xs font-semibold uppercase tracking-wide ${FUEL_COLORS[ft].split(' ')[1]}`}>{ft}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{byFuelType[ft].toLocaleString()} L</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus size={16} /> Log Load
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Tanker</th>
                <th className="px-4 py-3 text-left">Fuel Type</th>
                <th className="px-4 py-3 text-left">Depot</th>
                <th className="px-4 py-3 text-left">Driver</th>
                <th className="px-4 py-3 text-right">Volume (L)</th>
                <th className="px-4 py-3 text-right">Price/L</th>
                <th className="px-4 py-3 text-right">Total Cost</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loads.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No load records yet.</td></tr>
              ) : loads.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">{fmtDate(l.loadDate)}</td>
                  <td className="px-4 py-3 font-medium">{l.tanker.name} <span className="text-gray-400 font-normal">({l.tanker.registrationNo})</span></td>
                  <td className="px-4 py-3"><Badge label={l.fuelType} color={FUEL_COLORS[l.fuelType]} /></td>
                  <td className="px-4 py-3 text-gray-600">{l.depotName}</td>
                  <td className="px-4 py-3 text-gray-500">{l.driverName ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{l.volume.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(Number(l.pricePerLitre))}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtMoney(Number(l.totalCost))}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { if (confirm('Delete this load record?')) deleteLoad.mutate(l.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Load Modal */}
      <Modal title="Log Fuel Load" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form onSubmit={form.handleSubmit(d => createLoad.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanker *</label>
              <select {...form.register('tankerId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select tanker</option>
                {tankers.filter(t => t.isActive).map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.registrationNo})</option>
                ))}
              </select>
              {form.formState.errors.tankerId && <p className="text-red-500 text-xs mt-1">{form.formState.errors.tankerId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type *</label>
              <select {...form.register('fuelType')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Volume (L) *</label>
              <input type="number" step="0.01" {...form.register('volume')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {form.formState.errors.volume && <p className="text-red-500 text-xs mt-1">{form.formState.errors.volume.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Litre (ZAR) *</label>
              <input type="number" step="0.0001" {...form.register('pricePerLitre')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {form.formState.errors.pricePerLitre && <p className="text-red-500 text-xs mt-1">{form.formState.errors.pricePerLitre.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost</label>
              <div className="border rounded-lg px-3 py-2 text-sm bg-gray-50 font-semibold">R {estCost}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Load Date *</label>
              <input type="date" {...form.register('loadDate')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {form.formState.errors.loadDate && <p className="text-red-500 text-xs mt-1">{form.formState.errors.loadDate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Depot / Supplier *</label>
              <input {...form.register('depotName')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Engen Depot Johannesburg" />
              {form.formState.errors.depotName && <p className="text-red-500 text-xs mt-1">{form.formState.errors.depotName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
              <input {...form.register('driverName')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea {...form.register('notes')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={createLoad.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {createLoad.isPending ? 'Saving…' : 'Log Load'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'tankers',    label: 'Tankers & Tank Allocation', icon: Truck },
  { key: 'deliveries', label: 'Route Planning & Tracking',  icon: Navigation },
  { key: 'loads',      label: 'Load Management',            icon: Package },
];

export default function FuelTankerPage() {
  const [activeTab, setActiveTab] = useState<Tab>('tankers');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-orange-100">
          <Fuel size={22} className="text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fuel Tanker Division</h1>
          <p className="text-sm text-gray-500">Diesel · Petrol · Paraffin</p>
        </div>
      </div>

      {/* Tab switcher */}
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

      {activeTab === 'tankers'    && <TankersTab />}
      {activeTab === 'deliveries' && <DeliveriesTab />}
      {activeTab === 'loads'      && <LoadsTab />}
    </div>
  );
}
