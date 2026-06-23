import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2, AlertCircle, Bell, Check } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';

interface Reminder {
  id: number;
  title: string;
  description: string | null;
  dueDate: string;
  isRead: boolean;
  vehicle: { id: number; name: string; registrationNo: string } | null;
}

const schema = z.object({
  vehicleId:   z.coerce.number().int().positive().optional().nullable(),
  title:       z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueDate:     z.string().min(1, 'Due date is required'),
});
type FormData = z.infer<typeof schema>;

function dueBadge(dueDate: string) {
  const d = new Date(dueDate);
  if (isPast(d)) return { label: 'Overdue', cls: 'bg-red-100 text-red-700' };
  if (isWithinInterval(d, { start: new Date(), end: addDays(new Date(), 7) }))
    return { label: 'Due Soon', cls: 'bg-yellow-100 text-yellow-700' };
  return { label: 'Upcoming', cls: 'bg-blue-100 text-blue-700' };
}

export default function RemindersPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data: reminders = [], isLoading, isError } = useQuery<Reminder[]>({
    queryKey: ['reminders', unreadOnly],
    queryFn: () => api.get('/reminders', { params: unreadOnly ? { unread: 'true' } : {} }).then(r =>
      Array.isArray(r.data) ? r.data : r.data?.data ?? []),
  });

  const { data: vehicles = [] } = useQuery<{id:number;name:string;registrationNo:string}[]>({
    queryKey: ['vehicles-select'],
    queryFn: () => api.get('/vehicles').then(r => (Array.isArray(r.data)?r.data:r.data?.data??[]).filter((v:any)=>v.isActive)),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const createMut = useMutation({
    mutationFn: (d: FormData) => api.post('/reminders', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); setModalOpen(false); reset(); },
  });
  const markReadMut = useMutation({
    mutationFn: (id: number) => api.patch(`/reminders/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/reminders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  });

  if (isLoading) return <div className="flex flex-col items-center justify-center h-64 gap-3"><Loader2 className="animate-spin text-brand-600" size={32}/><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>;
  if (isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20}/><span>Failed to load reminders.</span></div>;

  const unreadCount = reminders.filter(r => !r.isRead).length;
  const inp = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Reminders</h1>
          {unreadCount > 0 && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{unreadCount} unread</span>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setUnreadOnly(!unreadOnly)}
            className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${unreadOnly ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 hover:border-brand-500'}`}>
            <Bell size={15}/> {unreadOnly ? 'Unread only' : 'All'}
          </button>
          <button onClick={() => { reset(); setModalOpen(true); }} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus size={16}/> Add Reminder
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {reminders.length === 0
          ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No reminders found.</div>
          : reminders.map(r => {
            const badge = dueBadge(r.dueDate);
            return (
              <div key={r.id} className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${r.isRead ? 'opacity-60' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`font-semibold text-gray-900 ${r.isRead ? 'line-through text-gray-400' : ''}`}>{r.title}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                  </div>
                  {r.description && <p className="text-sm text-gray-500 mb-1">{r.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Due: {format(new Date(r.dueDate), 'dd MMM yyyy')}</span>
                    {r.vehicle && <span>Vehicle: {r.vehicle.name} ({r.vehicle.registrationNo})</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!r.isRead && <button onClick={() => markReadMut.mutate(r.id)} className="p-1.5 text-gray-400 hover:text-green-600" title="Mark read"><Check size={16}/></button>}
                  <button onClick={() => confirm(`Delete "${r.title}"?`) && deleteMut.mutate(r.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                </div>
              </div>
            );
          })}
      </div>

      <Modal title="Add Reminder" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit(d => createMut.mutate(d))} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input {...register('title')} className={inp} placeholder="e.g. Vehicle service due"/>
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}</div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register('description')} rows={3} className={inp} placeholder="Optional notes..."/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
              <input type="date" {...register('dueDate')} className={inp}/>
              {errors.dueDate && <p className="text-red-500 text-xs mt-1">{errors.dueDate.message}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Vehicle (optional)</label>
              <select {...register('vehicleId')} className={`${inp} bg-white`}>
                <option value="">No specific vehicle</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registrationNo})</option>)}
              </select></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSubmitting || createMut.isPending}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {createMut.isPending && <Loader2 className="animate-spin" size={16}/>} Add Reminder
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
