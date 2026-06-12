import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Eye } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { Link } from 'react-router-dom';

interface Vehicle {
  id: number;
  registrationNo: string;
  name: string;
  chassisNo: string;
  engineNo: string;
  isActive: boolean;
  registrationExpiry: string | null;
  group: { id: number; name: string } | null;
  _count: { trips: number; drivers: number };
}

const schema = z.object({
  name: z.string().min(1, 'Vehicle name is required'),
  registrationNo: z.string().min(1, 'Registration number is required'),
  chassisNo: z.string().min(1, 'Chassis number is required'),
  engineNo: z.string().min(1, 'Engine number is required'),
  apiUsername: z.string().optional(),
  registrationExpiry: z.string().optional(),
  isActive: z.boolean().default(true),
  groupId: z.coerce.number().optional().nullable(),
});
type FormData = z.infer<typeof schema>;

interface VehicleGroup { id: number; name: string; }

export default function VehiclesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const { data: vehicles = [], isLoading, isError } = useQuery<Vehicle[]>({
    queryKey: ['vehicles'],
    queryFn: () => api.get('/vehicles').then(r => r.data),
  });

  const { data: groups = [] } = useQuery<VehicleGroup[]>({
    queryKey: ['vehicle-groups'],
    queryFn: () => api.get('/vehicles/groups').then(r => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/vehicles', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      closeModal();
    },
  });

  const updateMut = useMutation({
    mutationFn: (d: any) => api.put(`/vehicles/${editing!.id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      closeModal();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/vehicles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });

  const openAdd = () => {
    setEditing(null);
    reset({ name: '', registrationNo: '', chassisNo: '', engineNo: '', isActive: true, groupId: null });
    setModalOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditing(v);
    reset({
      name: v.name,
      registrationNo: v.registrationNo,
      chassisNo: v.chassisNo,
      engineNo: v.engineNo,
      isActive: v.isActive,
      groupId: v.group?.id ?? null,
      registrationExpiry: v.registrationExpiry?.split('T')[0] ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const onSubmit = (data: FormData) => {
    const payload: any = { ...data };

    // 1. If groupId is missing or 0, explicitly set it to null for the DB
    if (!payload.groupId || payload.groupId < 1) {
      payload.groupId = null;
    }

    // 2. Format the date properly into an ISO string or set it to null
    if (!payload.registrationExpiry) {
      payload.registrationExpiry = null;
    } else {
      // Converts "YYYY-MM-DD" into an ISO string ("YYYY-MM-DDT00:00:00.000Z")
      payload.registrationExpiry = new Date(payload.registrationExpiry).toISOString();
    }

    editing ? updateMut.mutate(payload) : createMut.mutate(payload);
  };


  const confirmDelete = (v: Vehicle) => {
    if (confirm(`Delete vehicle "${v.name} (${v.registrationNo})"? This cannot be undone.`)) {
      deleteMut.mutate(v.id);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-600" size={32} />
    </div>
  );

  if (isError) return (
    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
      <AlertCircle size={20} /><span>Failed to load vehicles.</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Vehicle</th>
                <th className="px-4 py-3 text-left">Registration</th>
                <th className="px-4 py-3 text-left">Group</th>
                <th className="px-4 py-3 text-left">Trips</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No vehicles yet. Add your first one.</td></tr>
              ) : (
                vehicles.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{v.name}</td>
                    <td className="px-4 py-3 text-gray-500">{v.registrationNo}</td>
                    <td className="px-4 py-3 text-gray-500">{v.group?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{v._count.trips}</td>
                    <td className="px-4 py-3">
                      <Badge label={v.isActive ? 'Active' : 'Inactive'} variant={v.isActive ? 'green' : 'red'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/vehicles/${v.id}`} className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors">
                          <Eye size={16} />
                        </Link>
                        <button onClick={() => openEdit(v)} className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => confirmDelete(v)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal title={editing ? 'Edit Vehicle' : 'Add Vehicle'} open={modalOpen} onClose={closeModal}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Name *</label>
              <input {...register('name')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Volvo FH16" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration No *</label>
              <input {...register('registrationNo')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. CA 123-456" />
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
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration Expiry</label>
              <input {...register('registrationExpiry')} type="date" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="animate-spin" size={16} />}
              {editing ? 'Save Changes' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
