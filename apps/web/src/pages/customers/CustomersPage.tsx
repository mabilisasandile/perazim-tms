import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Eye } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  alternativePhone: string | null;
  address: string | null;
  companyName: string | null;
  vatNumber: string | null;
  contactPerson: string | null;
  notes: string | null;
  isActive: boolean;
  _count?: { trips: number; quotations: number };
}

const schema = z.object({
  name:             z.string().min(1, 'Name is required'),
  email:            z.string().email('Valid email required'),
  companyName:      z.string().optional(),
  vatNumber:        z.string().optional(),
  contactPerson:    z.string().optional(),
  phone:            z.string().optional(),
  alternativePhone: z.string().optional(),
  address:          z.string().optional(),
  notes:            z.string().optional(),
  isActive:         z.boolean().default(true),
});
type FormData = z.infer<typeof schema>;

const INPUT = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function CustomersPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await api.get('/customers');
      return Array.isArray(response.data) ? response.data : response.data?.data ?? [];
    },
  });

  const customers: Customer[] = data ?? [];

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const createMut = useMutation({
    mutationFn: (d: FormData) => api.post('/customers', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: (d: FormData) => api.put(`/customers/${editing!.id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); closeModal(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => { setDeleteError(null); qc.invalidateQueries({ queryKey: ['customers'] }); },
    onError: (err: any) => setDeleteError(err?.response?.data?.error ?? 'Failed to delete customer.'),
  });

  const emptyForm = (): FormData => ({
    name: '', email: '', companyName: '', vatNumber: '', contactPerson: '',
    phone: '', alternativePhone: '', address: '', notes: '', isActive: true,
  });

  const openAdd = () => {
    setEditing(null);
    reset(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    reset({
      name:             c.name,
      email:            c.email,
      companyName:      c.companyName      ?? '',
      vatNumber:        c.vatNumber        ?? '',
      contactPerson:    c.contactPerson    ?? '',
      phone:            c.phone            ?? '',
      alternativePhone: c.alternativePhone ?? '',
      address:          c.address          ?? '',
      notes:            c.notes            ?? '',
      isActive:         c.isActive,
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search) ||
    (c.companyName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="flex flex-col items-center justify-center h-64 gap-3"><Loader2 className="animate-spin text-brand-600" size={32} /><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>;
  if (isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20} /><span>Failed to load customers.</span></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {deleteError && (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <input
        type="search"
        placeholder="Search by name, company, email or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Trips</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">{search ? 'No results found.' : 'No customers yet.'}</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.companyName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.email}</td>
                  <td className="px-4 py-3 text-gray-500">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c._count?.trips ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge label={c.isActive ? 'Active' : 'Inactive'} variant={c.isActive ? 'green' : 'red'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setViewCustomer(c)} className="p-1.5 text-gray-400 hover:text-brand-600"><Eye size={16} /></button>
                      <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-brand-600"><Pencil size={16} /></button>
                      <button onClick={() => { if (confirm(`Delete "${c.name}"?`)) { setDeleteError(null); deleteMut.mutate(c.id); } }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────── */}
      <Modal title={editing ? 'Edit Customer' : 'Add Customer'} open={modalOpen} onClose={closeModal}>
        <form onSubmit={handleSubmit(d => editing ? updateMut.mutate(d) : createMut.mutate(d))} className="space-y-4">

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input {...register('name')} className={INPUT} />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input {...register('contactPerson')} className={INPUT} placeholder="Person to contact" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
            <input type="email" {...register('email')} className={INPUT} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input {...register('phone')} className={INPUT} placeholder="+27 82 000 0000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alternative Phone</label>
              <input {...register('alternativePhone')} className={INPUT} placeholder="+27 83 000 0000" />
            </div>
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-1">Business Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input {...register('companyName')} className={INPUT} placeholder="Trading name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">VAT Number</label>
              <input {...register('vatNumber')} className={INPUT} placeholder="4XXXXXXXXX" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea {...register('address')} rows={2} className={INPUT} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea {...register('notes')} rows={2} className={INPUT} placeholder="Special requirements, delivery instructions, etc." />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" {...register('isActive')} id="custActive" className="rounded" />
            <label htmlFor="custActive" className="text-sm font-medium text-gray-700">Active</label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={isSubmitting || createMut.isPending || updateMut.isPending}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {(createMut.isPending || updateMut.isPending) ? 'Saving...' : editing ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View Modal ───────────────────────────────────────────────── */}
      {viewCustomer && (
        <Modal title={viewCustomer.name} open={!!viewCustomer} onClose={() => setViewCustomer(null)}>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Contact Details</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Contact Person', viewCustomer.contactPerson ?? '—'],
                  ['Email',          viewCustomer.email],
                  ['Phone',          viewCustomer.phone ?? '—'],
                  ['Alt. Phone',     viewCustomer.alternativePhone ?? '—'],
                  ['Status',         viewCustomer.isActive ? 'Active' : 'Inactive'],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-gray-500">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Business Details</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Company',   viewCustomer.companyName ?? '—'],
                  ['VAT No.',   viewCustomer.vatNumber   ?? '—'],
                  ['Trips',     viewCustomer._count?.trips     ?? 0],
                  ['Quotations',viewCustomer._count?.quotations ?? 0],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-gray-500">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {viewCustomer.address && (
              <div>
                <p className="text-gray-500">Address</p>
                <p className="font-medium">{viewCustomer.address}</p>
              </div>
            )}
            {viewCustomer.notes && (
              <div>
                <p className="text-gray-500">Notes</p>
                <p className="font-medium whitespace-pre-wrap">{viewCustomer.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
