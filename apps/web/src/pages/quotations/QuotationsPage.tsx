import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2, AlertCircle, Eye, PlusCircle } from 'lucide-react';
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

interface QuotationItem {
  description: string;
  colour?: string;
  registration?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Quotation {
  id: number;
  number: string | null;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'CONVERTED';
  pickup: string;
  dropoff: string;
  pickupDate: string | null;
  createdAt: string;
  customer: { id: number; name: string; email: string } | null;
  items: QuotationItem[];
}

const itemSchema = z.object({
  description:  z.string().min(1, 'Description required'),
  colour:       z.string().optional(),
  registration: z.string().optional(),
  quantity:     z.coerce.number().int().min(1).default(1),
  unitPrice:    z.coerce.number().min(0, 'Price required'),
});

const schema = z.object({
  customerId:  z.coerce.number().int().positive('Customer required'),
  pickup:      z.string().min(1, 'Pickup location required'),
  dropoff:     z.string().min(1, 'Dropoff location required'),
  pickupDate:  z.string().optional(),
  dropoffDate: z.string().optional(),
  information: z.string().optional(),
  items:       z.array(itemSchema).min(1, 'At least one item required'),
});
type FormData = z.infer<typeof schema>;

interface CustomerOption { id: number; name: string; }

const statusMeta: Record<string, { label: string; variant: 'gray'|'blue'|'green'|'red'|'yellow' }> = {
  DRAFT:     { label: 'Draft',     variant: 'gray' },
  SENT:      { label: 'Sent',      variant: 'blue' },
  ACCEPTED:  { label: 'Accepted',  variant: 'green' },
  DECLINED:  { label: 'Declined',  variant: 'red' },
  CONVERTED: { label: 'Converted', variant: 'yellow' },
};

/* ── component ──────────────────────────────────────── */

export default function QuotationsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewQuote, setViewQuote] = useState<Quotation | null>(null);

  const { data: quotations = [], isLoading, isError } = useQuery<Quotation[]>({
    queryKey: ['quotations'],
    queryFn: () => api.get('/quotations').then(r => normalizeList(r.data)),
  });

  const { data: customers = [] } = useQuery<CustomerOption[]>({
    queryKey: ['customers-select'],
    queryFn: () => api.get('/customers').then(r => normalizeList(r.data).map((c: any) => ({ id: c.id, name: c.name }))),
  });

  const { register, handleSubmit, control, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ description: '', quantity: 1, unitPrice: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  const lineTotal = (i: number) =>
    ((Number(watchedItems?.[i]?.quantity) || 0) * (Number(watchedItems?.[i]?.unitPrice) || 0)).toFixed(2);

  const grandTotal = watchedItems?.reduce(
    (s, item) => s + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0
  ) ?? 0;

  const createMut = useMutation({
    mutationFn: (d: FormData) => api.post('/quotations', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotations'] }); setModalOpen(false); reset(); },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.patch(`/quotations/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/quotations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });

  const fmt = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);

  if (isLoading) return <div className="flex flex-col items-center justify-center h-64 gap-3"><Loader2 className="animate-spin text-brand-600" size={32} /><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>;
  if (isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20} /><span>Failed to load quotations.</span></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
        <button onClick={() => { reset({ items: [{ description: '', quantity: 1, unitPrice: 0 }] }); setModalOpen(true); }}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> New Quotation
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Route</th>
                <th className="px-4 py-3 text-left">Pickup Date</th>
                <th className="px-4 py-3 text-left">Items</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotations.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No quotations yet.</td></tr>
              ) : quotations.map(q => {
                const sm = statusMeta[q.status] ?? { label: q.status, variant: 'gray' as const };
                return (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{q.number ?? `#${q.id}`}</td>
                    {/* FIX: customer may be null if related record was deleted */}
                    <td className="px-4 py-3 font-medium">{q.customer?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{q.pickup} → {q.dropoff}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {safeDate(q.pickupDate, 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{q.items?.length ?? 0}</td>
                    <td className="px-4 py-3"><Badge label={sm.label} variant={sm.variant} /></td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{safeDate(q.createdAt, 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewQuote(q)} className="p-1.5 text-gray-400 hover:text-brand-600"><Eye size={16} /></button>
                        {q.status === 'DRAFT' && (
                          <button onClick={() => updateStatus.mutate({ id: q.id, status: 'SENT' })}
                            className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
                            Send
                          </button>
                        )}
                        {q.status === 'SENT' && (
                          <>
                            <button onClick={() => updateStatus.mutate({ id: q.id, status: 'ACCEPTED' })}
                              className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100">Accept</button>
                            <button onClick={() => updateStatus.mutate({ id: q.id, status: 'DECLINED' })}
                              className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100">Decline</button>
                          </>
                        )}
                        <button onClick={() => { if (confirm('Delete this quotation?')) deleteMut.mutate(q.id); }}
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
      <Modal title="New Quotation" open={modalOpen} onClose={() => setModalOpen(false)} width="max-w-3xl">
        <form onSubmit={handleSubmit(d => createMut.mutate(d))} className="space-y-5">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Date</label>
              <input type="date" {...register('pickupDate')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location *</label>
              <input {...register('pickup')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.pickup && <p className="text-red-500 text-xs mt-1">{errors.pickup.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dropoff Location *</label>
              <input {...register('dropoff')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.dropoff && <p className="text-red-500 text-xs mt-1">{errors.dropoff.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Information</label>
              <textarea {...register('information')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Line Items *</p>
              <button type="button" onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700">
                <PlusCircle size={14} /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-4">
                    <input {...register(`items.${i}.description`)} placeholder="Description"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    {errors.items?.[i]?.description && <p className="text-red-500 text-xs">{errors.items[i]?.description?.message}</p>}
                  </div>
                  <div className="col-span-2">
                    <input {...register(`items.${i}.colour`)} placeholder="Colour"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div className="col-span-2">
                    <input {...register(`items.${i}.registration`)} placeholder="Reg No"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div className="col-span-1">
                    <input type="number" {...register(`items.${i}.quantity`)} placeholder="Qty"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" step="0.01" {...register(`items.${i}.unitPrice`)} placeholder="Unit Price"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div className="col-span-1 flex items-center justify-between gap-1 pt-2">
                    <span className="text-xs text-gray-500">R{lineTotal(i)}</span>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {errors.items?.root && <p className="text-red-500 text-xs mt-1">{errors.items.root.message}</p>}
            <div className="text-right mt-3 text-sm font-semibold text-gray-900">
              Total: {fmt(grandTotal)}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={isSubmitting || createMut.isPending}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {createMut.isPending ? 'Creating...' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal — FIX: customer may be null */}
      {viewQuote && (
        <Modal title={`Quotation ${viewQuote.number ?? `#${viewQuote.id}`}`} open={!!viewQuote} onClose={() => setViewQuote(null)} width="max-w-2xl">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-gray-500">Customer</p><p className="font-medium">{viewQuote.customer?.name ?? '—'}</p></div>
              <div><p className="text-gray-500">Status</p><Badge label={statusMeta[viewQuote.status]?.label ?? viewQuote.status} variant={statusMeta[viewQuote.status]?.variant ?? 'gray'} /></div>
              <div className="col-span-2"><p className="text-gray-500">Route</p><p className="font-medium">{viewQuote.pickup} → {viewQuote.dropoff}</p></div>
            </div>
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Colour</th>
                  <th className="px-3 py-2 text-left">Reg</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {viewQuote.items?.map((item, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-gray-500">{item.colour ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{item.registration ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">{fmt(Number(item.unitPrice || 0))}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(Number(item.total || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}