import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2, AlertCircle, Fuel } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { format } from 'date-fns';

/* ── helpers ─────────────────────────────────────────── */

const safeDate = (v: string | null | undefined, fmtStr: string, fallback = '—') => {
  if (!v) return fallback;
  const d = new Date(v);
  return isNaN(d.getTime()) ? fallback : format(d, fmtStr);
};

const normalizeList = (res: unknown): any[] => {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    for (const key of ['data', 'items', 'results', 'records']) {
      if (Array.isArray(obj[key])) return obj[key] as any[];
    }
  }
  return [];
};

/* ── types ──────────────────────────────────────────── */

interface FuelRecord {
  id: number;
  litres: number;
  costPerLitre: number;
  totalCost: number;
  odometer: number | null;
  fillDate: string;
  notes: string | null;
  vehicle: { id: number; name: string; registrationNo: string } | null;
  driver: { id: number; name: string } | null;
}

const schema = z.object({
  vehicleId:    z.coerce.number().int().positive('Vehicle is required'),
  driverId:     z.coerce.number().optional().nullable(),
  litres:       z.coerce.number().positive('Litres must be positive'),
  costPerLitre: z.coerce.number().positive('Cost per litre required'),
  odometer:     z.coerce.number().optional().nullable(),
  fillDate:     z.string().min(1, 'Date is required'),
  notes:        z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface VehicleOption { id: number; name: string; registrationNo: string; }
interface DriverOption  { id: number; name: string; }

/* ── component ──────────────────────────────────────── */

export default function FuelPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: records = [], isLoading, isError } = useQuery<FuelRecord[]>({
    queryKey: ['fuel'],
    queryFn: () => api.get('/fuel').then(r => normalizeList(r.data)),
  });

  const { data: vehicles = [] } = useQuery<VehicleOption[]>({
    queryKey: ['vehicles-select'],
    queryFn: () => api.get('/vehicles').then(r => normalizeList(r.data).filter((v: any) => v.isActive)),
  });

  const { data: drivers = [] } = useQuery<DriverOption[]>({
    queryKey: ['drivers-select'],
    queryFn: () => api.get('/drivers').then(r => normalizeList(r.data).filter((d: any) => d.isActive)),
  });

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fillDate: new Date().toISOString().split('T')[0] },
  });

  const litres = watch('litres') || 0;
  const cpl    = watch('costPerLitre') || 0;
  const total  = (Number(litres) * Number(cpl)).toFixed(2);

  const createMut = useMutation({
    mutationFn: (d: FormData) => api.post('/fuel', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fuel'] }); setModalOpen(false); reset(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/fuel/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel'] }),
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);

  const totalSpend = records.reduce((s, r) => s + (Number(r.totalCost) || 0), 0);
  const totalLitres = records.reduce((s, r) => s + (Number(r.litres) || 0), 0);

  if (isLoading) return <div className="flex flex-col items-center justify-center h-64 gap-3"><Loader2 className="animate-spin text-brand-600" size={32} /><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>;
  if (isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20} /><span>Failed to load fuel records.</span></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Fuel</h1>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Log Fill-up
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Total Records</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{records.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Total Litres</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalLitres.toFixed(1)} L</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Total Spend</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(totalSpend)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Vehicle</th>
                <th className="px-4 py-3 text-left">Driver</th>
                <th className="px-4 py-3 text-left">Litres</th>
                <th className="px-4 py-3 text-left">Cost/L</th>
                <th className="px-4 py-3 text-left">Total</th>
                <th className="px-4 py-3 text-left">Odometer</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No fuel records yet.</td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  {/* FIX: safeDate guards against invalid date strings */}
                  <td className="px-4 py-3 whitespace-nowrap">{safeDate(r.fillDate, 'dd MMM yyyy')}</td>
                  {/* FIX: vehicle may be null if the related record was deleted */}
                  <td className="px-4 py-3 font-medium">
                    {r.vehicle?.name ?? 'Unknown'} <span className="text-gray-400 font-normal">({r.vehicle?.registrationNo ?? '—'})</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.driver?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{Number(r.litres || 0).toFixed(1)} L</td>
                  <td className="px-4 py-3 text-gray-700">{fmt(Number(r.costPerLitre || 0))}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{fmt(Number(r.totalCost || 0))}</td>
                  <td className="px-4 py-3 text-gray-500">{r.odometer ? `${r.odometer.toLocaleString()} km` : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { if (confirm('Delete this fuel record?')) deleteMut.mutate(r.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal title="Log Fill-up" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit(d => createMut.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle *</label>
            <select {...register('vehicleId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Select vehicle</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registrationNo})</option>)}
            </select>
            {errors.vehicleId && <p className="text-red-500 text-xs mt-1">{errors.vehicleId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
            <select {...register('driverId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Select driver</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Litres *</label>
              <input type="number" step="0.01" {...register('litres')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="0.00" />
              {errors.litres && <p className="text-red-500 text-xs mt-1">{errors.litres.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Litre (ZAR) *</label>
              <input type="number" step="0.01" {...register('costPerLitre')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="0.00" />
              {errors.costPerLitre && <p className="text-red-500 text-xs mt-1">{errors.costPerLitre.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Cost</label>
              <div className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 font-semibold">
                R {total}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Odometer (km)</label>
              <input type="number" {...register('odometer')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fill Date *</label>
            <input type="date" {...register('fillDate')}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            {errors.fillDate && <p className="text-red-500 text-xs mt-1">{errors.fillDate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea {...register('notes')} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={isSubmitting || createMut.isPending}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {createMut.isPending ? 'Saving...' : 'Log Fill-up'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}