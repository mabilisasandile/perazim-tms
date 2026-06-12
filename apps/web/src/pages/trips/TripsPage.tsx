import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2, AlertCircle, Eye, Trash2, CheckCircle2, Clock, XCircle, TruckIcon } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';

interface Trip {
  id: number;
  trackingCode: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  fromLocation: string;
  toLocation: string;
  startDate: string;
  endDate: string | null;
  totalAmount: number | null;
  customer: { id: number; name: string };
  vehicle: { id: number; name: string; registrationNo: string };
  driver: { id: number; name: string };
  trailer: { id: number; registrationNo: string } | null;
}

interface SelectOption { id: number; name: string; }
interface VehicleOption { id: number; name: string; registrationNo: string; }
interface DriverOption { id: number; name: string; assignedVehicle?: { name: string } | null; }

const schema = z.object({
  customerId:   z.coerce.number().int().positive('Customer is required'),
  vehicleId:    z.coerce.number().int().positive('Vehicle is required'),
  driverId:     z.coerce.number().int().positive('Driver is required'),
  trailerId:    z.coerce.number().optional().nullable(),
  fromLocation: z.string().min(1, 'From location is required'),
  toLocation:   z.string().min(1, 'To location is required'),
  startDate:    z.string().min(1, 'Start date is required'),
  endDate:      z.string().optional(),
  amount:       z.coerce.number().min(0).optional(),
  customerVehicleMake:         z.string().optional(),
  customerVehicleColour:       z.string().optional(),
  customerVehicleRegistration: z.string().optional(),
  customerVehicleVin:          z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const statusMeta: Record<string, { label: string; variant: 'yellow'|'blue'|'green'|'red'; icon: React.ElementType }> = {
  PENDING:     { label: 'Pending',     variant: 'yellow', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', variant: 'blue',   icon: TruckIcon },
  COMPLETED:   { label: 'Completed',   variant: 'green',  icon: CheckCircle2 },
  CANCELLED:   { label: 'Cancelled',   variant: 'red',    icon: XCircle },
};

export default function TripsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: trips = [], isLoading, isError } = useQuery<Trip[]>({
    queryKey: ['trips', statusFilter],
    queryFn: () => api.get('/trips', { params: statusFilter ? { status: statusFilter } : {} }).then(r => r.data),
  });

  const { data: customers = [] } = useQuery<SelectOption[]>({
    queryKey: ['customers-select'],
    queryFn: () => api.get('/customers').then(r => r.data.map((c: any) => ({ id: c.id, name: c.name }))),
  });
  const { data: vehicles = [] } = useQuery<VehicleOption[]>({
    queryKey: ['vehicles-select'],
    queryFn: () => api.get('/vehicles').then(r => r.data.filter((v: any) => v.isActive)),
  });
  const { data: drivers = [] } = useQuery<DriverOption[]>({
    queryKey: ['drivers-select'],
    queryFn: () => api.get('/drivers').then(r => r.data.filter((d: any) => d.isActive)),
  });
  const { data: trailers = [] } = useQuery<SelectOption[]>({
    queryKey: ['trailers-select'],
    queryFn: () => api.get('/trailers').then(r => r.data.filter((t: any) => t.isActive).map((t: any) => ({ id: t.id, name: t.registrationNo }))),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMut = useMutation({
    mutationFn: (d: FormData) => api.post('/trips', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); setModalOpen(false); reset(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/trips/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.patch(`/trips/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  });

  const fmt = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={32} /></div>;
  if (isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20} /><span>Failed to load trips.</span></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Trips</h1>
        <button onClick={() => { reset(); setModalOpen(true); }} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> New Trip
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600 hover:border-brand-500'}`}
          >
            {s === '' ? 'All' : statusMeta[s]?.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Tracking</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Route</th>
                <th className="px-4 py-3 text-left">Vehicle</th>
                <th className="px-4 py-3 text-left">Driver</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trips.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No trips found.</td></tr>
              ) : trips.map(t => {
                const sm = statusMeta[t.status];
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.trackingCode.slice(0, 8)}…</td>
                    <td className="px-4 py-3 font-medium">{t.customer.name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px]">
                      <span className="truncate block">{t.fromLocation} → {t.toLocation}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t.vehicle.registrationNo}</td>
                    <td className="px-4 py-3 text-gray-500">{t.driver.name}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(t.startDate), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3 text-gray-700">{t.totalAmount ? fmt(Number(t.totalAmount)) : '—'}</td>
                    <td className="px-4 py-3"><Badge label={sm.label} variant={sm.variant} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewTrip(t)} className="p-1.5 text-gray-400 hover:text-brand-600"><Eye size={15} /></button>
                        {t.status === 'PENDING' && (
                          <button onClick={() => statusMut.mutate({ id: t.id, status: 'IN_PROGRESS' })} className="p-1.5 text-gray-400 hover:text-blue-600" title="Start trip"><TruckIcon size={15} /></button>
                        )}
                        {t.status === 'IN_PROGRESS' && (
                          <button onClick={() => statusMut.mutate({ id: t.id, status: 'COMPLETED' })} className="p-1.5 text-gray-400 hover:text-green-600" title="Complete trip"><CheckCircle2 size={15} /></button>
                        )}
                        <button onClick={() => { if (confirm('Delete this trip?')) deleteMut.mutate(t.id); }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Trip Modal */}
      <Modal title="New Trip" open={modalOpen} onClose={() => setModalOpen(false)} width="max-w-2xl">
        <form onSubmit={handleSubmit(d => createMut.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <select {...register('customerId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.customerId && <p className="text-red-500 text-xs mt-1">{errors.customerId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle *</label>
              <select {...register('vehicleId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select vehicle</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registrationNo})</option>)}
              </select>
              {errors.vehicleId && <p className="text-red-500 text-xs mt-1">{errors.vehicleId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver *</label>
              <select {...register('driverId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select driver</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {errors.driverId && <p className="text-red-500 text-xs mt-1">{errors.driverId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trailer</label>
              <select {...register('trailerId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">No trailer</option>
                {trailers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Location *</label>
              <input {...register('fromLocation')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Johannesburg" />
              {errors.fromLocation && <p className="text-red-500 text-xs mt-1">{errors.fromLocation.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Location *</label>
              <input {...register('toLocation')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Cape Town" />
              {errors.toLocation && <p className="text-red-500 text-xs mt-1">{errors.toLocation.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input type="date" {...register('startDate')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" {...register('endDate')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trip Amount (excl. VAT)</label>
              <input type="number" step="0.01" {...register('amount')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="0.00" />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Customer's Vehicle (being transported)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Make/Model</label>
                <input {...register('customerVehicleMake')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Toyota Hilux" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Colour</label>
                <input {...register('customerVehicleColour')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. White" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Registration</label>
                <input {...register('customerVehicleRegistration')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">VIN Number</label>
                <input {...register('customerVehicleVin')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={isSubmitting || createMut.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {createMut.isPending ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Trip Modal */}
      {viewTrip && (
        <Modal title={`Trip #${viewTrip.id}`} open={!!viewTrip} onClose={() => setViewTrip(null)} width="max-w-xl">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-gray-500">Tracking Code</p><p className="font-mono font-medium">{viewTrip.trackingCode}</p></div>
              <div><p className="text-gray-500">Status</p><Badge label={statusMeta[viewTrip.status].label} variant={statusMeta[viewTrip.status].variant} /></div>
              <div><p className="text-gray-500">Customer</p><p className="font-medium">{viewTrip.customer.name}</p></div>
              <div><p className="text-gray-500">Vehicle</p><p className="font-medium">{viewTrip.vehicle.name} ({viewTrip.vehicle.registrationNo})</p></div>
              <div><p className="text-gray-500">Driver</p><p className="font-medium">{viewTrip.driver.name}</p></div>
              <div><p className="text-gray-500">Trailer</p><p className="font-medium">{viewTrip.trailer?.registrationNo ?? '—'}</p></div>
              <div className="col-span-2"><p className="text-gray-500">Route</p><p className="font-medium">{viewTrip.fromLocation} → {viewTrip.toLocation}</p></div>
              <div><p className="text-gray-500">Start Date</p><p className="font-medium">{format(new Date(viewTrip.startDate), 'dd MMM yyyy')}</p></div>
              <div><p className="text-gray-500">End Date</p><p className="font-medium">{viewTrip.endDate ? format(new Date(viewTrip.endDate), 'dd MMM yyyy') : '—'}</p></div>
              <div><p className="text-gray-500">Total Amount</p><p className="font-medium text-lg">{viewTrip.totalAmount ? new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(viewTrip.totalAmount)) : '—'}</p></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
