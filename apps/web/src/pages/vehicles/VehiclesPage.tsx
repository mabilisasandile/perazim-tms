import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Eye, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
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

type SortKey = 'id' | 'name' | 'registrationNo' | 'chassisNo' | 'engineNo' | 'registrationExpiry' | 'isActive';

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc' }) {
  if (sortKey !== col) return <ChevronsUpDown size={13} className="text-gray-400 ml-1 inline" />;
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-gray-700 ml-1 inline" />
    : <ChevronDown size={13} className="text-gray-700 ml-1 inline" />;
}

export default function VehiclesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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

  const onMutError = (e: any) => setFormError(e?.response?.data?.error ?? 'An unexpected error occurred.');

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/vehicles', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); closeModal(); },
    onError: onMutError,
  });

  const updateMut = useMutation({
    mutationFn: (d: any) => api.put(`/vehicles/${editing!.id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); closeModal(); },
    onError: onMutError,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/vehicles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });

  const openAdd = () => {
    setEditing(null);
    setFormError(null);
    reset({ name: '', registrationNo: '', chassisNo: '', engineNo: '', isActive: true, groupId: null });
    setModalOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setFormError(null);
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

  const closeModal = () => { setModalOpen(false); setEditing(null); setFormError(null); };

  const onSubmit = (data: FormData) => {
    const payload: any = { ...data };
    if (!payload.groupId || payload.groupId < 1) payload.groupId = null;
    if (!payload.registrationExpiry) {
      payload.registrationExpiry = null;
    } else {
      payload.registrationExpiry = new Date(payload.registrationExpiry).toISOString();
    }
    editing ? updateMut.mutate(payload) : createMut.mutate(payload);
  };

  const confirmDelete = (v: Vehicle) => {
    if (confirm(`Delete vehicle "${v.name} (${v.registrationNo})"? This cannot be undone.`)) {
      deleteMut.mutate(v.id);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      v.registrationNo.toLowerCase().includes(q) ||
      v.chassisNo.toLowerCase().includes(q) ||
      v.engineNo.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let av: any = a[sortKey as keyof Vehicle];
    let bv: any = b[sortKey as keyof Vehicle];
    if (av === null || av === undefined) av = '';
    if (bv === null || bv === undefined) bv = '';
    if (typeof av === 'boolean') av = av ? 1 : 0;
    if (typeof bv === 'boolean') bv = bv ? 1 : 0;
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);
  const showingFrom = sorted.length === 0 ? 0 : start + 1;
  const showingTo = Math.min(start + pageSize, sorted.length);

  const thClass = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap';

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="animate-spin text-brand-600" size={32} />
      <p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p>
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles Management</h1>
          <p className="text-xs text-gray-400 mt-0.5">Dashboard / Vehicles Management</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {/* Table controls */}
        <div className="flex items-center justify-between px-4 py-3 border-b gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>entries</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Search:</span>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="border rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder=""
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className={thClass} onClick={() => toggleSort('id')}>
                  S.No <SortIcon col="id" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('name')}>
                  Vehicle Name <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('registrationNo')}>
                  Registration Number <SortIcon col="registrationNo" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('chassisNo')}>
                  Chassis No <SortIcon col="chassisNo" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('engineNo')}>
                  Engine Number <SortIcon col="engineNo" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('registrationExpiry')}>
                  License Expiry <SortIcon col="registrationExpiry" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('isActive')}>
                  Vehicle Status <SortIcon col="isActive" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    {search ? 'No vehicles match your search.' : 'No vehicles yet. Add your first one.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((v, i) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{start + i + 1}</td>
                    <td className="px-4 py-3 font-medium text-brand-600 hover:underline">
                      <Link to={`/app/vehicles/${v.id}`}>{v.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{v.registrationNo}</td>
                    <td className="px-4 py-3 text-gray-500">{v.chassisNo}</td>
                    <td className="px-4 py-3 text-gray-500">{v.engineNo}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {v.registrationExpiry ? v.registrationExpiry.split('T')[0] : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={v.isActive ? 'Active' : 'Inactive'} variant={v.isActive ? 'green' : 'red'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link to={`/app/vehicles/${v.id}`} className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors">
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

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
          <span>
            {sorted.length === 0
              ? 'No entries'
              : `Showing ${showingFrom} to ${showingTo} of ${sorted.length} entries`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`px-3 py-1 border rounded text-sm ${
                  safePage === n
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'hover:bg-gray-50'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
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

          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={15} className="shrink-0" />{formError}
            </div>
          )}
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
