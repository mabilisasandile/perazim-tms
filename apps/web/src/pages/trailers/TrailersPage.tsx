import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Eye } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';

interface Trailer {
  id: number;
  registrationNo: string;
  make: string | null;
  type: string | null;
  chassisNo: string | null;
  loadCapacity: number | null;
  colour: string | null;
  licenseExpiry: string | null;
  isActive: boolean;
  _count: { trips: number };
}

const schema = z.object({
  registrationNo: z.string().min(1, 'Registration number is required'),
  make:           z.string().optional(),
  type:           z.string().optional(),
  chassisNo:      z.string().optional(),
  loadCapacity:   z.coerce.number().positive().optional().nullable(),
  colour:         z.string().optional(),
  licenseExpiry:  z.string().optional(),
  isActive:       z.boolean().default(true),
});
type FormData = z.infer<typeof schema>;

const safeDate = (v: string | null | undefined, fallback = '—') => {
  if (!v) return fallback;
  const d = new Date(v);
  return isNaN(d.getTime()) ? fallback : format(d, 'dd MMM yyyy');
};

const norm = (r: unknown): any[] => {
  if (Array.isArray(r)) return r;
  if (r && typeof r === 'object') {
    for (const k of ['data','items','results']) if (Array.isArray((r as any)[k])) return (r as any)[k];
  }
  return [];
};

export default function TrailersPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Trailer | null>(null);
  const [viewing, setViewing] = useState<Trailer | null>(null);

  const { data: trailers = [], isLoading, isError } = useQuery<Trailer[]>({
    queryKey: ['trailers'],
    queryFn: () => api.get('/trailers').then(r => norm(r.data)),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMut = useMutation({
    mutationFn: (d: FormData) => api.post('/trailers', prep(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trailers'] }); close(); },
  });
  const updateMut = useMutation({
    mutationFn: (d: FormData) => api.put(`/trailers/${editing!.id}`, prep(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trailers'] }); close(); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/trailers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trailers'] }),
  });

  const prep = (d: FormData) => ({
    ...d,
    licenseExpiry: d.licenseExpiry ? new Date(d.licenseExpiry).toISOString() : null,
    loadCapacity: d.loadCapacity || null,
  });

  const openAdd = () => { setEditing(null); reset({ registrationNo: '', isActive: true }); setModalOpen(true); };
  const openEdit = (t: Trailer) => {
    setEditing(t);
    reset({ registrationNo: t.registrationNo, make: t.make ?? '', type: t.type ?? '', chassisNo: t.chassisNo ?? '',
      loadCapacity: t.loadCapacity ?? undefined, colour: t.colour ?? '',
      licenseExpiry: t.licenseExpiry ? t.licenseExpiry.split('T')[0] : '', isActive: t.isActive });
    setModalOpen(true);
  };
  const close = () => { setModalOpen(false); setEditing(null); };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={32} /></div>;
  if (isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20}/><span>Failed to load trailers.</span></div>;

  const inp = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Trailers</h1>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus size={16}/> Add Trailer
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Registration</th>
              <th className="px-4 py-3 text-left">Make / Type</th>
              <th className="px-4 py-3 text-left">Colour</th>
              <th className="px-4 py-3 text-left">Capacity</th>
              <th className="px-4 py-3 text-left">License Expiry</th>
              <th className="px-4 py-3 text-left">Trips</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {trailers.length === 0
              ? <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No trailers yet.</td></tr>
              : trailers.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{t.registrationNo}</td>
                <td className="px-4 py-3 text-gray-500">{[t.make, t.type].filter(Boolean).join(' / ') || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{t.colour ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{t.loadCapacity ? `${t.loadCapacity.toLocaleString()} kg` : '—'}</td>
                <td className="px-4 py-3 text-gray-500">{safeDate(t.licenseExpiry)}</td>
                <td className="px-4 py-3 text-gray-500">{t._count?.trips ?? 0}</td>
                <td className="px-4 py-3"><Badge label={t.isActive ? 'Active' : 'Inactive'} variant={t.isActive ? 'green' : 'red'}/></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setViewing(t)} className="p-1.5 text-gray-400 hover:text-brand-600"><Eye size={16}/></button>
                    <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-brand-600"><Pencil size={16}/></button>
                    <button onClick={() => confirm(`Delete trailer "${t.registrationNo}"?`) && deleteMut.mutate(t.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={editing ? 'Edit Trailer' : 'Add Trailer'} open={modalOpen} onClose={close} width="max-w-2xl">
        <form onSubmit={handleSubmit(d => editing ? updateMut.mutate(d) : createMut.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Registration No *</label>
              <input {...register('registrationNo')} className={inp} placeholder="e.g. CA T123-456"/>
              {errors.registrationNo && <p className="text-red-500 text-xs mt-1">{errors.registrationNo.message}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Make</label><input {...register('make')} className={inp} placeholder="e.g. Henred"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><input {...register('type')} className={inp} placeholder="e.g. Flat Deck"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Chassis No</label><input {...register('chassisNo')} className={inp}/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Load Capacity (kg)</label><input type="number" {...register('loadCapacity')} className={inp} placeholder="30000"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Colour</label><input {...register('colour')} className={inp} placeholder="White"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">License Expiry</label><input type="date" {...register('licenseExpiry')} className={inp}/></div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" {...register('isActive')} id="tActive" className="rounded"/>
              <label htmlFor="tActive" className="text-sm font-medium text-gray-700">Active</label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={close} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSubmitting || createMut.isPending || updateMut.isPending}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="animate-spin" size={16}/>}
              {editing ? 'Save Changes' : 'Add Trailer'}
            </button>
          </div>
        </form>
      </Modal>

      {viewing && (
        <Modal title={viewing.registrationNo} open={!!viewing} onClose={() => setViewing(null)}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {([['Make', viewing.make??'—'],['Type', viewing.type??'—'],['Chassis No', viewing.chassisNo??'—'],
               ['Load Capacity', viewing.loadCapacity ? `${viewing.loadCapacity.toLocaleString()} kg` : '—'],
               ['Colour', viewing.colour??'—'],['License Expiry', safeDate(viewing.licenseExpiry)],
               ['Trips', viewing._count?.trips??0],['Status', viewing.isActive?'Active':'Inactive']] as [string,React.ReactNode][])
              .map(([l,v]) => <div key={l}><p className="text-gray-500">{l}</p><p className="font-medium">{v}</p></div>)}
          </div>
        </Modal>
      )}
    </div>
  );
}
