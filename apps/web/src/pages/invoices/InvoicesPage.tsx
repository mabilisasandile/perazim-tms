import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2, AlertCircle, Eye, Trash2, CheckCircle2 } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
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

interface Invoice {
  id: number;
  number: string;
  amount: number;
  vatAmount: number;
  total: number;
  status: 'unpaid' | 'paid' | 'overdue';
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  vehicleDescription: string | null;
  vehicleCondition: 'Runner' | 'Non-Runner' | null;
  createdAt: string;
  customer?: { id: number; name: string } | null;
}

const schema = z.object({
  customerId:         z.coerce.number().int().positive('Customer required'),
  amount:             z.coerce.number().min(0, 'Amount required'),
  vatRate:            z.coerce.number().min(0).default(15),
  dueDate:            z.string().optional(),
  notes:              z.string().optional(),
  vehicleDescription: z.string().optional(),
  vehicleCondition:   z.enum(['Runner', 'Non-Runner']).optional().nullable(),
});
type FormData = z.infer<typeof schema>;

interface CustomerOption { id: number; name: string; }

const statusMeta: Record<string, { label: string; variant: 'red'|'green'|'yellow' }> = {
  unpaid:  { label: 'Unpaid',  variant: 'yellow' },
  paid:    { label: 'Paid',    variant: 'green' },
  overdue: { label: 'Overdue', variant: 'red' },
};

/* ── component ──────────────────────────────────────── */

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: invoices = [], isLoading, isError } = useQuery<Invoice[]>({
    queryKey: ['invoices', statusFilter],
    queryFn: () => api.get('/invoices', { params: statusFilter ? { status: statusFilter } : {} }).then(r => normalizeList(r.data)),
  });

  const { data: customers = [] } = useQuery<CustomerOption[]>({
    queryKey: ['customers-select'],
    queryFn: () => api.get('/customers').then(r => normalizeList(r.data).map((c: any) => ({ id: c.id, name: c.name }))),
  });

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { vatRate: 15 },
  });

  const amount  = Number(watch('amount')) || 0;
  const vatRate = Number(watch('vatRate')) || 15;
  const vat     = (amount * vatRate / 100).toFixed(2);
  const total   = (amount + amount * vatRate / 100).toFixed(2);

  const createMut = useMutation({
    mutationFn: (d: FormData) => api.post('/invoices', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setModalOpen(false); reset(); },
  });

  const markPaid = useMutation({
    mutationFn: (id: number) => api.patch(`/invoices/${id}/status`, { status: 'paid' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/invoices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const fmt = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);

  const totalUnpaid = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + (Number(i.total) || 0), 0);
  const totalPaid   = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (Number(i.total) || 0), 0);

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={32} /></div>;
  if (isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20} /><span>Failed to load invoices.</span></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <button onClick={() => { reset({ vatRate: 15 }); setModalOpen(true); }}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> New Invoice
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Total Invoices</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{invoices.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Outstanding</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{fmt(totalUnpaid)}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Collected</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmt(totalPaid)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['', 'unpaid', 'paid', 'overdue'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600 hover:border-brand-500'}`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Invoice #</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">VAT</th>
                <th className="px-4 py-3 text-left">Total</th>
                <th className="px-4 py-3 text-left">Due Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No invoices found.</td></tr>
              ) : invoices.map(inv => {
                const sm = statusMeta[inv.status] ?? { label: inv.status, variant: 'yellow' as const };
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 font-semibold">{inv.number}</td>
                    {/* FIX: customer can be null from API */}
                    <td className="px-4 py-3 font-medium">{inv.customer?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{fmt(Number(inv.amount || 0))}</td>
                    <td className="px-4 py-3 text-gray-500">{fmt(Number(inv.vatAmount || 0))}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{fmt(Number(inv.total || 0))}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {safeDate(inv.dueDate, 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3"><Badge label={sm.label} variant={sm.variant} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewInvoice(inv)} className="p-1.5 text-gray-400 hover:text-brand-600"><Eye size={16} /></button>
                        {inv.status !== 'paid' && (
                          <button onClick={() => markPaid.mutate(inv.id)}
                            className="p-1.5 text-gray-400 hover:text-green-600" title="Mark as paid">
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        <button onClick={() => { if (confirm('Delete this invoice?')) deleteMut.mutate(inv.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <Modal title="New Invoice" open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit(d => createMut.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
            <select {...register('customerId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Select customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.customerId && <p className="text-red-500 text-xs mt-1">{errors.customerId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (excl. VAT) *</label>
              <input type="number" step="0.01" {...register('amount')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="0.00" />
              {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">VAT %</label>
              <input type="number" {...register('vatRate')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">VAT Amount</label>
              <div className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700">R {vat}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total (incl. VAT)</label>
              <div className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-900 font-semibold">R {total}</div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input type="date" {...register('dueDate')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea {...register('notes')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Description</label>
              <input {...register('vehicleDescription')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Toyota Hilux – ABC 123 GP" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Condition</label>
              <select {...register('vehicleCondition')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">Select condition</option>
                <option value="Runner">Runner</option>
                <option value="Non-Runner">Non-Runner</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={isSubmitting || createMut.isPending}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {createMut.isPending ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal — FIX: Badge moved outside <p> to avoid div-inside-p HTML error */}
      {viewInvoice && (
        <Modal title={`Invoice ${viewInvoice.number}`} open={!!viewInvoice} onClose={() => setViewInvoice(null)}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Customer</p>
              <p className="font-medium">{viewInvoice.customer?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <div className="font-medium mt-1">
                <Badge label={statusMeta[viewInvoice.status]?.label ?? viewInvoice.status} variant={statusMeta[viewInvoice.status]?.variant ?? 'yellow'} />
              </div>
            </div>
            {([
              ['Amount (excl. VAT)', fmt(Number(viewInvoice.amount || 0))],
              ['VAT', fmt(Number(viewInvoice.vatAmount || 0))],
              ['Total', fmt(Number(viewInvoice.total || 0))],
              ['Due Date', safeDate(viewInvoice.dueDate, 'dd MMM yyyy')],
              ['Paid At', safeDate(viewInvoice.paidAt, 'dd MMM yyyy')],
              ['Created', safeDate(viewInvoice.createdAt, 'dd MMM yyyy')],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label}>
                <p className="text-gray-500">{label}</p>
                <p className="font-medium">{value}</p>
              </div>
            ))}
            {viewInvoice.vehicleDescription && (
              <div className="col-span-2">
                <p className="text-gray-500">Vehicle</p>
                <p className="font-medium">{viewInvoice.vehicleDescription}</p>
              </div>
            )}
            {viewInvoice.vehicleCondition && (
              <div>
                <p className="text-gray-500">Vehicle Condition</p>
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${viewInvoice.vehicleCondition === 'Non-Runner' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                  {viewInvoice.vehicleCondition}
                </span>
              </div>
            )}
            {viewInvoice.notes && (
              <div className="col-span-2">
                <p className="text-gray-500">Notes</p>
                <p className="font-medium">{viewInvoice.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}