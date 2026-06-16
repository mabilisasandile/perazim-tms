import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Plus, Pencil, Trash2, Loader2, Package,
  MapPin, Users, ArrowRightLeft, CheckCircle2, Clock,
  Truck, BarChart3, Building2, X,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

// ── Types ────────────────────────────────────────────────────────────────────

interface Warehouse {
  id: number; name: string; location: string; capacity: number;
  contactName: string | null; contactPhone: string | null;
  isActive: boolean; stored: number; occupancy: number;
}

interface WarehouseVehicle {
  id: number; status: 'IN_STORAGE' | 'AWAITING_DISPATCH' | 'DISPATCHED';
  arrivedAt: string; dispatchedAt: string | null; notes: string | null;
  warehouse: { id: number; name: string; location: string };
  trip: {
    id: number; trackingCode: string; status: string;
    fromLocation: string; toLocation: string;
    customerVehicleRegistration: string | null;
    customerVehicleVin: string | null;
    customerVehicleEngine: string | null;
    customerVehicleStock: string | null;
    customerVehicleMake: string | null;
    customerVehicleColour: string | null;
    vehicleCondition: string | null;
    customer: { id: number; name: string; phone: string | null };
  };
  transfers: {
    fromWarehouse: { id: number; name: string };
    toWarehouse:   { id: number; name: string };
    transferredAt: string; notes: string | null;
  }[];
}

interface Dashboard {
  stored: number; awaiting: number; dispatched: number;
  avgDurationDays: number;
  warehouseStats: { id: number; name: string; location: string; capacity: number; stored: number; occupancy: number }[];
  recentActivity: WarehouseVehicle[];
}

// ── Zod schemas ──────────────────────────────────────────────────────────────

const warehouseSchema = z.object({
  name:         z.string().min(1, 'Name is required'),
  location:     z.string().min(1, 'Location is required'),
  capacity:     z.coerce.number().int().positive('Capacity must be a positive number'),
  contactName:  z.string().optional(),
  contactPhone: z.string().optional(),
  isActive:     z.boolean().default(true),
});
type WarehouseForm = z.infer<typeof warehouseSchema>;

const allocateSchema = z.object({
  tripId:    z.coerce.number().int().positive('Trip is required'),
  arrivedAt: z.string().optional(),
  notes:     z.string().optional(),
});
type AllocateForm = z.infer<typeof allocateSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

const statusConfig = {
  IN_STORAGE:        { label: 'In Storage',        variant: 'blue'   as const },
  AWAITING_DISPATCH: { label: 'Awaiting Dispatch',  variant: 'yellow' as const },
  DISPATCHED:        { label: 'Dispatched',         variant: 'green'  as const },
};

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color?: string;
}) {
  const bg: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', yellow: 'bg-yellow-50 text-yellow-600', purple: 'bg-purple-50 text-purple-600' };
  return (
    <div className="bg-white rounded-xl border p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${bg[color]}`}><Icon size={20} /></div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function OccupancyBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'warehouses' | 'vehicles';

export default function WarehousesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('dashboard');

  // Warehouse modal
  const [whModal, setWhModal]   = useState(false);
  const [editing, setEditing]   = useState<Warehouse | null>(null);

  // Allocate modal
  const [allocModal, setAllocModal]     = useState<Warehouse | null>(null);

  // Transfer modal
  const [transferTarget, setTransferTarget] = useState<WarehouseVehicle | null>(null);
  const [transferWarehouseId, setTransferWarehouseId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Status modal
  const [statusTarget, setStatusTarget] = useState<WarehouseVehicle | null>(null);

  // Vehicles filter
  const [statusFilter, setStatusFilter] = useState('');
  const [whFilter, setWhFilter]         = useState('');

  // ── Queries ──────────────────────────────────────────────────────

  const { data: dashboard, isLoading: dbLoading } = useQuery<Dashboard>({
    queryKey: ['warehouse-dashboard'],
    queryFn: () => api.get('/warehouses/dashboard').then(r => r.data),
  });

  const { data: warehouses = [], isLoading: whLoading } = useQuery<Warehouse[]>({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then(r => r.data),
  });

  const { data: wvehicles = [], isLoading: wvLoading } = useQuery<WarehouseVehicle[]>({
    queryKey: ['warehouse-vehicles', statusFilter, whFilter],
    queryFn: () => api.get('/warehouses/vehicles', {
      params: {
        status:      statusFilter || undefined,
        warehouseId: whFilter || undefined,
      },
    }).then(r => r.data),
  });

  // For trip allocate dropdown — trips that aren't in a warehouse yet
  const { data: trips = [] } = useQuery<{ id: number; trackingCode: string; customerVehicleRegistration: string | null; customer: { name: string } }[]>({
    queryKey: ['trips-for-warehouse'],
    queryFn: () => api.get('/trips').then(r =>
      r.data.filter((t: any) => !t.warehouseVehicle).map((t: any) => ({
        id: t.id,
        trackingCode: t.trackingCode,
        customerVehicleRegistration: t.customerVehicleRegistration,
        customer: t.customer,
      }))
    ),
    enabled: !!allocModal,
  });

  // ── Mutations ─────────────────────────────────────────────────────

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['warehouses'] });
    qc.invalidateQueries({ queryKey: ['warehouse-dashboard'] });
    qc.invalidateQueries({ queryKey: ['warehouse-vehicles'] });
  };

  const createWh = useMutation({ mutationFn: (d: WarehouseForm) => api.post('/warehouses', d), onSuccess: () => { invalidate(); setWhModal(false); whForm.reset(); } });
  const updateWh = useMutation({ mutationFn: (d: WarehouseForm) => api.put(`/warehouses/${editing!.id}`, d), onSuccess: () => { invalidate(); setWhModal(false); setEditing(null); } });
  const deleteWh = useMutation({ mutationFn: (id: number) => api.delete(`/warehouses/${id}`), onSuccess: () => invalidate() });

  const allocate = useMutation({
    mutationFn: ({ warehouseId, data }: { warehouseId: number; data: AllocateForm }) =>
      api.post(`/warehouses/${warehouseId}/allocate`, data),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ['trips-for-warehouse'] }); setAllocModal(null); allocForm.reset(); },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/warehouses/vehicles/${id}/status`, { status }),
    onSuccess: () => { invalidate(); setStatusTarget(null); },
  });

  const transfer = useMutation({
    mutationFn: ({ id, toWarehouseId, notes }: { id: number; toWarehouseId: number; notes?: string }) =>
      api.post(`/warehouses/vehicles/${id}/transfer`, { toWarehouseId, notes }),
    onSuccess: () => { invalidate(); setTransferTarget(null); setTransferWarehouseId(''); setTransferNotes(''); },
  });

  // ── Forms ────────────────────────────────────────────────────────

  const whForm = useForm<WarehouseForm>({ resolver: zodResolver(warehouseSchema) });
  const allocForm = useForm<AllocateForm>({ resolver: zodResolver(allocateSchema) });

  const openAdd = () => {
    setEditing(null);
    whForm.reset({ name: '', location: '', capacity: 10, contactName: '', contactPhone: '', isActive: true });
    setWhModal(true);
  };

  const openEdit = (w: Warehouse) => {
    setEditing(w);
    whForm.reset({ name: w.name, location: w.location, capacity: w.capacity, contactName: w.contactName ?? '', contactPhone: w.contactPhone ?? '', isActive: w.isActive });
    setWhModal(true);
  };

  const onWhSubmit = (d: WarehouseForm) => editing ? updateWh.mutate(d) : createWh.mutate(d);

  // ── Render ───────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard',  label: 'Dashboard',  icon: BarChart3 },
    { id: 'warehouses', label: 'Warehouses', icon: Building2 },
    { id: 'vehicles',   label: 'Vehicles',   icon: Package },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Warehouse Management</h1>
        {tab === 'warehouses' && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Add Warehouse
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === id ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD TAB ──────────────────────────────────────── */}
      {tab === 'dashboard' && (
        dbLoading ? <div className="flex justify-center h-40 items-center"><Loader2 className="animate-spin text-brand-600" size={28} /></div> :
        dashboard ? (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Package}     label="Vehicles Stored"      value={dashboard.stored}           color="blue" />
              <StatCard icon={Clock}       label="Awaiting Dispatch"     value={dashboard.awaiting}         color="yellow" />
              <StatCard icon={CheckCircle2} label="Dispatched"           value={dashboard.dispatched}       color="green" />
              <StatCard icon={Truck}       label="Avg Storage Duration"  value={`${dashboard.avgDurationDays}d`} sub="for vehicles in storage" color="purple" />
            </div>

            {/* Warehouse occupancy cards */}
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3">Warehouse Occupancy</h2>
              {dashboard.warehouseStats.length === 0 ? (
                <p className="text-gray-400 text-sm">No warehouses yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboard.warehouseStats.map(w => (
                    <div key={w.id} className="bg-white rounded-xl border p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{w.name}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin size={11} />{w.location}</p>
                        </div>
                        <span className={`text-sm font-bold ${w.occupancy >= 90 ? 'text-red-600' : w.occupancy >= 70 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {w.occupancy}%
                        </span>
                      </div>
                      <OccupancyBar pct={w.occupancy} />
                      <p className="text-xs text-gray-400 mt-2">{w.stored} / {w.capacity} vehicles</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3">Vehicle Movement History</h2>
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Customer Vehicle</th>
                        <th className="px-4 py-3 text-left">Customer</th>
                        <th className="px-4 py-3 text-left">Warehouse</th>
                        <th className="px-4 py-3 text-left">Arrived</th>
                        <th className="px-4 py-3 text-left">Duration</th>
                        <th className="px-4 py-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dashboard.recentActivity.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No vehicle movements yet.</td></tr>
                      ) : dashboard.recentActivity.map(v => (
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{v.trip.customerVehicleRegistration ?? '—'}</p>
                            <p className="text-xs text-gray-400">{v.trip.customerVehicleMake ?? ''}{v.trip.customerVehicleColour ? ` · ${v.trip.customerVehicleColour}` : ''}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{v.trip.customer.name}</td>
                          <td className="px-4 py-3 text-gray-600">{v.warehouse.name}</td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(v.arrivedAt), 'dd MMM yyyy')}</td>
                          <td className="px-4 py-3 text-gray-500">{formatDistanceToNow(new Date(v.arrivedAt), { addSuffix: false })}</td>
                          <td className="px-4 py-3">
                            <Badge label={statusConfig[v.status].label} variant={statusConfig[v.status].variant} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null
      )}

      {/* ── WAREHOUSES TAB ─────────────────────────────────────── */}
      {tab === 'warehouses' && (
        whLoading ? <div className="flex justify-center h-40 items-center"><Loader2 className="animate-spin text-brand-600" size={28} /></div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.length === 0 && (
              <div className="col-span-3 text-center py-16 text-gray-400">No warehouses yet. Add your first one.</div>
            )}
            {warehouses.map(w => (
              <div key={w.id} className="bg-white rounded-xl border p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{w.name}</h3>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin size={11} />{w.location}</p>
                  </div>
                  <Badge label={w.isActive ? 'Active' : 'Inactive'} variant={w.isActive ? 'green' : 'red'} />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Occupancy</span>
                    <span className={`font-medium ${w.occupancy >= 90 ? 'text-red-600' : w.occupancy >= 70 ? 'text-yellow-600' : 'text-green-600'}`}>{w.stored}/{w.capacity}</span>
                  </div>
                  <OccupancyBar pct={w.occupancy} />
                </div>

                {(w.contactName || w.contactPhone) && (
                  <div className="text-xs text-gray-500">
                    <Users size={11} className="inline mr-1" />
                    {w.contactName}{w.contactPhone ? ` · ${w.contactPhone}` : ''}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setAllocModal(w)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-brand-50 hover:bg-brand-100 text-brand-700 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus size={13} /> Allocate Vehicle
                  </button>
                  <button onClick={() => openEdit(w)} className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors"><Pencil size={15} /></button>
                  <button
                    onClick={() => { if (confirm(`Delete warehouse "${w.name}"?`)) deleteWh.mutate(w.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  ><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── VEHICLES TAB ───────────────────────────────────────── */}
      {tab === 'vehicles' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select value={whFilter} onChange={e => setWhFilter(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">All Warehouses</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {(['', 'IN_STORAGE', 'AWAITING_DISPATCH', 'DISPATCHED'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600 hover:border-brand-500'}`}
              >
                {s === '' ? 'All' : statusConfig[s].label}
              </button>
            ))}
          </div>

          {wvLoading ? <div className="flex justify-center h-40 items-center"><Loader2 className="animate-spin text-brand-600" size={28} /></div> : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Vehicle</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Warehouse</th>
                      <th className="px-4 py-3 text-left">Arrived</th>
                      <th className="px-4 py-3 text-left">Duration</th>
                      <th className="px-4 py-3 text-left">Route</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {wvehicles.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No vehicles found.</td></tr>
                    ) : wvehicles.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{v.trip.customerVehicleRegistration ?? '—'}</p>
                          <p className="text-xs text-gray-400">{[v.trip.customerVehicleMake, v.trip.customerVehicleColour].filter(Boolean).join(' · ')}</p>
                          {v.trip.customerVehicleVin && <p className="text-xs text-gray-400 font-mono">VIN: {v.trip.customerVehicleVin}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{v.trip.customer.name}</td>
                        <td className="px-4 py-3 text-gray-600">{v.warehouse.name}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(v.arrivedAt), 'dd MMM yyyy')}</td>
                        <td className="px-4 py-3 text-gray-500">{formatDistanceToNow(new Date(v.arrivedAt), { addSuffix: false })}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[160px]">
                          <span className="truncate block text-xs">{v.trip.fromLocation} → {v.trip.toLocation}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge label={statusConfig[v.status].label} variant={statusConfig[v.status].variant} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setStatusTarget(v)}
                              className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors"
                              title="Update status"
                            ><CheckCircle2 size={15} /></button>
                            {v.status !== 'DISPATCHED' && (
                              <button
                                onClick={() => { setTransferTarget(v); setTransferWarehouseId(''); setTransferNotes(''); }}
                                className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors"
                                title="Transfer to another warehouse"
                              ><ArrowRightLeft size={15} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── WAREHOUSE ADD/EDIT MODAL ────────────────────────────── */}
      <Modal title={editing ? 'Edit Warehouse' : 'Add Warehouse'} open={whModal} onClose={() => { setWhModal(false); setEditing(null); }}>
        <form onSubmit={whForm.handleSubmit(onWhSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse Name *</label>
              <input {...whForm.register('name')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Joburg North Hub" />
              {whForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{whForm.formState.errors.name.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Location / Address *</label>
              <input {...whForm.register('location')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. 12 Industrial Rd, Johannesburg" />
              {whForm.formState.errors.location && <p className="text-red-500 text-xs mt-1">{whForm.formState.errors.location.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Capacity *</label>
              <input type="number" min="1" {...whForm.register('capacity')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {whForm.formState.errors.capacity && <p className="text-red-500 text-xs mt-1">{whForm.formState.errors.capacity.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select {...whForm.register('isActive', { setValueAs: v => v === 'true' || v === true })} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input {...whForm.register('contactName')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input {...whForm.register('contactPhone')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => { setWhModal(false); setEditing(null); }} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={createWh.isPending || updateWh.isPending} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {(createWh.isPending || updateWh.isPending) && <Loader2 className="animate-spin" size={14} />}
              {editing ? 'Save Changes' : 'Add Warehouse'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── ALLOCATE VEHICLE MODAL ─────────────────────────────── */}
      {allocModal && (
        <Modal title={`Allocate Vehicle to ${allocModal.name}`} open={!!allocModal} onClose={() => { setAllocModal(null); allocForm.reset(); }}>
          <form onSubmit={allocForm.handleSubmit(d => allocate.mutate({ warehouseId: allocModal.id, data: d }))} className="space-y-4">
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
              <span className="font-medium text-gray-700">{allocModal.name}</span> — {allocModal.stored}/{allocModal.capacity} vehicles ({allocModal.occupancy}% full)
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trip / Booking *</label>
              <select {...allocForm.register('tripId')} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select a trip</option>
                {trips.map(t => (
                  <option key={t.id} value={t.id}>
                    #{t.id} — {t.customer.name}{t.customerVehicleRegistration ? ` · ${t.customerVehicleRegistration}` : ''}
                  </option>
                ))}
              </select>
              {allocForm.formState.errors.tripId && <p className="text-red-500 text-xs mt-1">{allocForm.formState.errors.tripId.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Date/Time</label>
              <input type="datetime-local" {...allocForm.register('arrivedAt')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea {...allocForm.register('notes')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <button type="button" onClick={() => { setAllocModal(null); allocForm.reset(); }} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={allocate.isPending} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                {allocate.isPending && <Loader2 className="animate-spin" size={14} />}
                Allocate Vehicle
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── STATUS UPDATE MODAL ────────────────────────────────── */}
      {statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Update Vehicle Status</h3>
              <button onClick={() => setStatusTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-500">
              {statusTarget.trip.customerVehicleRegistration ?? 'Vehicle'} — {statusTarget.trip.customer.name}
            </p>
            <div className="space-y-2">
              {(['IN_STORAGE', 'AWAITING_DISPATCH', 'DISPATCHED'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => updateStatus.mutate({ id: statusTarget.id, status: s })}
                  disabled={statusTarget.status === s || updateStatus.isPending}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors disabled:opacity-50 ${statusTarget.status === s ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 hover:border-brand-400'}`}
                >
                  {statusConfig[s].label}
                  {statusTarget.status === s && ' (current)'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSFER MODAL ─────────────────────────────────────── */}
      {transferTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Transfer Vehicle</h3>
              <button onClick={() => setTransferTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-500">
              Moving <span className="font-medium">{transferTarget.trip.customerVehicleRegistration ?? 'vehicle'}</span> from <span className="font-medium">{transferTarget.warehouse.name}</span>
            </p>

            {/* Transfer history */}
            {transferTarget.transfers.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                <p className="font-medium text-gray-600 mb-1">Transfer history</p>
                {transferTarget.transfers.map((t, i) => (
                  <p key={i} className="text-gray-500">{format(new Date(t.transferredAt), 'dd MMM')} · {t.fromWarehouse.name} → {t.toWarehouse.name}</p>
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination Warehouse *</label>
              <select
                value={transferWarehouseId}
                onChange={e => setTransferWarehouseId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select warehouse</option>
                {warehouses.filter(w => w.id !== transferTarget.warehouse.id && w.isActive).map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.stored}/{w.capacity})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={transferNotes} onChange={e => setTransferNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setTransferTarget(null)} className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                disabled={!transferWarehouseId || transfer.isPending}
                onClick={() => transfer.mutate({ id: transferTarget.id, toWarehouseId: Number(transferWarehouseId), notes: transferNotes || undefined })}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 rounded-lg disabled:opacity-50"
              >
                {transfer.isPending && <Loader2 className="animate-spin" size={14} />}
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
