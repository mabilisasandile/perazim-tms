import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Loader2, AlertCircle, Eye, Trash2, CheckCircle2,
  Upload, History, CreditCard, PlusCircle, X, Layers,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';

/* ── helpers ─────────────────────────────────────────── */

const safeDate = (v: string | null | undefined, fmtStr: string, fallback = '—') => {
  if (!v) return fallback;
  const d = new Date(v);
  return isNaN(d.getTime()) ? fallback : format(d, fmtStr);
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);

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

interface InvoiceItem {
  id: number;
  description: string;
  vehicleCondition: 'Runner' | 'Non-Runner' | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoicePayment {
  id: number;
  type: 'DEPOSIT' | 'PAYMENT';
  amount: number;
  method: string;
  reference: string | null;
  proofPath: string | null;
  notes: string | null;
  createdAt: string;
}

interface Invoice {
  id: number;
  number: string;
  amount: number;
  vatAmount: number;
  total: number;
  depositRequired: number | null;
  depositPaid: number;
  amountPaid: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  vehicleDescription: string | null;
  vehicleCondition: 'Runner' | 'Non-Runner' | null;
  tripId: number | null;
  createdAt: string;
  customer?: { id: number; name: string; payLaterApproved?: boolean } | null;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
}

interface CustomerOption { id: number; name: string; payLaterApproved?: boolean; }

/* ── schemas ─────────────────────────────────────────── */

// HTML selects emit "" for the blank option — coerce that to null for enums
const conditionField = z.preprocess(
  v => (v === '' ? null : v),
  z.enum(['Runner', 'Non-Runner']).optional().nullable(),
);

const itemSchema = z.object({
  description:      z.string().min(1, 'Description required'),
  vehicleCondition: conditionField,
  quantity:         z.coerce.number().int().min(1).default(1),
  unitPrice:        z.coerce.number().min(0, 'Price required'),
});

const invoiceSchema = z.object({
  customerId:         z.coerce.number().int().positive('Customer required'),
  amount:             z.coerce.number().min(0).default(0),
  vatRate:            z.coerce.number().min(0).default(15),
  depositRequired:    z.coerce.number().min(0).optional().nullable(),
  dueDate:            z.string().optional(),
  notes:              z.string().optional(),
  vehicleDescription: z.string().optional(),
  vehicleCondition:   conditionField,
  items:              z.array(itemSchema).optional(),
});
type InvoiceForm = z.infer<typeof invoiceSchema>;

const paymentSchema = z.object({
  type:      z.enum(['DEPOSIT', 'PAYMENT']),
  amount:    z.coerce.number().positive('Amount required'),
  method:    z.enum(['payfast', 'manual', 'eft', 'cash']),
  reference: z.string().optional(),
  notes:     z.string().optional(),
});
type PaymentForm = z.infer<typeof paymentSchema>;

/* ── status config ───────────────────────────────────── */

const statusMeta: Record<string, { label: string; variant: 'red' | 'green' | 'yellow' | 'blue' }> = {
  unpaid:  { label: 'Unpaid',   variant: 'yellow' },
  partial: { label: 'Partial',  variant: 'blue'   },
  paid:    { label: 'Paid',     variant: 'green'  },
  overdue: { label: 'Overdue',  variant: 'red'    },
};

/* ── component ──────────────────────────────────────── */

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [modalOpen,       setModalOpen]       = useState(false);
  const [bulkModalOpen,   setBulkModalOpen]   = useState(false);
  const [viewInvoice,     setViewInvoice]     = useState<Invoice | null>(null);
  const [paymentInvoice,  setPaymentInvoice]  = useState<Invoice | null>(null);
  const [historyInvoice,  setHistoryInvoice]  = useState<Invoice | null>(null);
  const [statusFilter,    setStatusFilter]    = useState('');
  const [activeTab,       setActiveTab]       = useState<'details' | 'items' | 'history'>('details');
  const proofRef = useRef<HTMLInputElement>(null);

  /* ── queries ────────────────────────────────────────── */

  const { data: invoices = [], isLoading, isError } = useQuery<Invoice[]>({
    queryKey: ['invoices', statusFilter],
    queryFn: () =>
      api.get('/invoices', { params: statusFilter ? { status: statusFilter } : {} })
         .then(r => normalizeList(r.data)),
  });

  const { data: stats } = useQuery<any>({
    queryKey: ['invoice-stats'],
    queryFn: () => api.get('/invoices/stats').then(r => r.data),
  });

  const { data: customers = [] } = useQuery<CustomerOption[]>({
    queryKey: ['customers-select'],
    queryFn: () =>
      api.get('/customers')
         .then(r => normalizeList(r.data).map((c: any) => ({
           id: c.id,
           name: c.name,
           payLaterApproved: c.payLaterApproved ?? false,
         }))),
  });

  const { data: paymentHistory = [] } = useQuery<InvoicePayment[]>({
    queryKey: ['invoice-payments', historyInvoice?.id],
    queryFn: () =>
      api.get(`/invoices/${historyInvoice!.id}/payments`).then(r => normalizeList(r.data)),
    enabled: !!historyInvoice,
  });

  /* ── invoice create form ────────────────────────────── */

  const {
    register, handleSubmit, watch, reset, control,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { vatRate: 15, items: [] },
  });

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control, name: 'items',
  });

  const watchItems  = watch('items') ?? [];
  const amount      = Number(watch('amount')) || 0;
  const vatRate     = Number(watch('vatRate')) || 15;

  const derivedAmount = watchItems.length > 0
    ? watchItems.reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0)
    : amount;
  const vat   = (derivedAmount * vatRate / 100).toFixed(2);
  const total = (derivedAmount + derivedAmount * vatRate / 100).toFixed(2);

  /* ── payment form ───────────────────────────────────── */

  const {
    register: regPay, handleSubmit: handlePay, reset: resetPay,
    formState: { isSubmitting: isPaySubmitting },
  } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { type: 'PAYMENT', method: 'manual' },
  });

  /* ── mutations ──────────────────────────────────────── */

  const createMut = useMutation({
    mutationFn: (d: InvoiceForm) => api.post('/invoices', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice-stats'] });
      setModalOpen(false);
      reset();
    },
  });

  const paymentMut = useMutation({
    mutationFn: async ({ invoiceId, data }: { invoiceId: number; data: PaymentForm }) => {
      const fd = new FormData();
      fd.append('type',   data.type);
      fd.append('amount', String(data.amount));
      fd.append('method', data.method);
      if (data.reference) fd.append('reference', data.reference);
      if (data.notes)     fd.append('notes',     data.notes);
      if (proofRef.current?.files?.[0]) fd.append('proof', proofRef.current.files[0]);
      return api.post(`/invoices/${invoiceId}/payments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice-stats'] });
      qc.invalidateQueries({ queryKey: ['invoice-payments'] });
      setPaymentInvoice(null);
      resetPay();
    },
  });

  const markPaid = useMutation({
    mutationFn: (id: number) => api.patch(`/invoices/${id}/status`, { status: 'paid' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
  });

  const payLaterMut = useMutation({
    mutationFn: ({ customerId, approved }: { customerId: number; approved: boolean }) =>
      api.patch(`/customers/${customerId}/pay-later`, { approved }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers-select'] }),
  });

  /* ── helpers ────────────────────────────────────────── */

  const balance = (inv: Invoice) => Math.max(0, Number(inv.total) - Number(inv.amountPaid));
  const depositRemaining = (inv: Invoice) =>
    inv.depositRequired ? Math.max(0, Number(inv.depositRequired) - Number(inv.depositPaid)) : null;

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="animate-spin text-brand-600" size={32} />
      <p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p>
    </div>
  );
  if (isError) return (
    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
      <AlertCircle size={20} /><span>Failed to load invoices.</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { reset({ vatRate: 15, items: [] }); setBulkModalOpen(true); }}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:border-brand-500 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Layers size={16} /> Bulk Invoice
          </button>
          <button
            onClick={() => { reset({ vatRate: 15, items: [] }); setModalOpen(true); }}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> New Invoice
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Invoices',  value: invoices.length,                        color: 'text-gray-900' },
          { label: 'Outstanding',     value: fmt(stats?.outstanding ?? 0),            color: 'text-red-600'  },
          { label: 'Collected',       value: fmt(stats?.paid?.amount ?? 0),           color: 'text-green-600'},
          { label: 'Partial',         value: fmt(stats?.partial?.amount ?? 0),        color: 'text-blue-600' },
          { label: 'Overdue',         value: fmt(stats?.overdue?.amount ?? 0),        color: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-2 flex-wrap">
        {['', 'unpaid', 'partial', 'paid', 'overdue'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600 hover:border-brand-500'}`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Invoice #</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Total</th>
                <th className="px-4 py-3 text-left">Paid</th>
                <th className="px-4 py-3 text-left">Balance</th>
                <th className="px-4 py-3 text-left">Deposit</th>
                <th className="px-4 py-3 text-left">Due Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No invoices found.</td></tr>
              ) : invoices.map(inv => {
                const sm = statusMeta[inv.status] ?? { label: inv.status, variant: 'yellow' as const };
                const bal = balance(inv);
                const depRem = depositRemaining(inv);
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 font-semibold">{inv.number}</td>
                    <td className="px-4 py-3 font-medium">
                      {inv.customer?.name ?? '—'}
                      {inv.customer?.payLaterApproved && (
                        <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Pay-Later</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{fmt(Number(inv.total || 0))}</td>
                    <td className="px-4 py-3 text-green-600">{fmt(Number(inv.amountPaid || 0))}</td>
                    <td className={`px-4 py-3 font-semibold ${bal > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {fmt(bal)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {inv.depositRequired
                        ? <span className={depRem && depRem > 0 ? 'text-orange-600' : 'text-green-600'}>
                            {fmt(Number(inv.depositPaid))} / {fmt(Number(inv.depositRequired))}
                          </span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {safeDate(inv.dueDate, 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3"><Badge label={sm.label} variant={sm.variant} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setViewInvoice(inv); setActiveTab('details'); }} title="View" className="p-1.5 text-gray-400 hover:text-brand-600"><Eye size={16} /></button>
                        <button onClick={() => setPaymentInvoice(inv)} title="Record Payment" className="p-1.5 text-gray-400 hover:text-green-600"><CreditCard size={16} /></button>
                        <button onClick={() => { setHistoryInvoice(inv); }} title="Payment History" className="p-1.5 text-gray-400 hover:text-blue-600"><History size={16} /></button>
                        {inv.status !== 'paid' && (
                          <button onClick={() => markPaid.mutate(inv.id)} title="Mark as paid" className="p-1.5 text-gray-400 hover:text-green-600"><CheckCircle2 size={16} /></button>
                        )}
                        <button onClick={() => { if (confirm('Delete this invoice?')) deleteMut.mutate(inv.id); }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create Invoice Modal ── */}
      <Modal title="New Invoice" open={modalOpen} onClose={() => setModalOpen(false)}>
        <InvoiceForm
          customers={customers}
          register={register}
          handleSubmit={handleSubmit}
          errors={errors}
          isSubmitting={isSubmitting}
          createMut={createMut}
          watch={watch}
          reset={reset}
          onClose={() => setModalOpen(false)}
          itemFields={itemFields}
          appendItem={appendItem}
          removeItem={removeItem}
          derivedAmount={derivedAmount}
          vat={vat}
          total={total}
        />
      </Modal>

      {/* ── Bulk Invoice Modal (multi-vehicle) ── */}
      <Modal title="Bulk Vehicle Invoice" open={bulkModalOpen} onClose={() => setBulkModalOpen(false)}>
        <p className="text-sm text-gray-500 mb-4">Add multiple vehicles as line items on a single invoice.</p>
        <InvoiceForm
          customers={customers}
          register={register}
          handleSubmit={handleSubmit}
          errors={errors}
          isSubmitting={isSubmitting}
          createMut={createMut}
          watch={watch}
          reset={reset}
          onClose={() => setBulkModalOpen(false)}
          itemFields={itemFields}
          appendItem={appendItem}
          removeItem={removeItem}
          derivedAmount={derivedAmount}
          vat={vat}
          total={total}
          bulkMode
        />
      </Modal>

      {/* ── Record Payment Modal ── */}
      {paymentInvoice && (
        <Modal title={`Record Payment — ${paymentInvoice.number}`} open={!!paymentInvoice} onClose={() => { setPaymentInvoice(null); resetPay(); }}>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm grid grid-cols-2 gap-2">
            <div><p className="text-gray-500 text-xs">Invoice Total</p><p className="font-semibold">{fmt(Number(paymentInvoice.total))}</p></div>
            <div><p className="text-gray-500 text-xs">Amount Paid</p><p className="font-semibold text-green-600">{fmt(Number(paymentInvoice.amountPaid))}</p></div>
            <div><p className="text-gray-500 text-xs">Outstanding Balance</p><p className="font-semibold text-red-600">{fmt(balance(paymentInvoice))}</p></div>
            {paymentInvoice.depositRequired && (
              <div>
                <p className="text-gray-500 text-xs">Deposit</p>
                <p className="font-semibold text-orange-600">
                  {fmt(Number(paymentInvoice.depositPaid))} / {fmt(Number(paymentInvoice.depositRequired))}
                </p>
              </div>
            )}
          </div>
          <form onSubmit={handlePay(d => paymentMut.mutate({ invoiceId: paymentInvoice.id, data: d }))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
                <select {...regPay('type')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="DEPOSIT">Deposit</option>
                  <option value="PAYMENT">Full / Partial Payment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                <select {...regPay('method')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="manual">Manual</option>
                  <option value="eft">EFT</option>
                  <option value="cash">Cash</option>
                  <option value="payfast">PayFast</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input type="number" step="0.01" {...regPay('amount')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Transaction ID</label>
              <input {...regPay('reference')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Bank ref, receipt no." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea {...regPay('notes')} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proof of Payment (PDF / Image)</label>
              <div className="flex items-center gap-2">
                <input ref={proofRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" id="pop-upload" />
                <label htmlFor="pop-upload" className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 hover:border-brand-500 rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-brand-600 transition-colors">
                  <Upload size={16} /> Upload POP
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setPaymentInvoice(null); resetPay(); }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button type="submit" disabled={isPaySubmitting || paymentMut.isPending}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
                {paymentMut.isPending ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Payment History Modal ── */}
      {historyInvoice && (
        <Modal title={`Payment History — ${historyInvoice.number}`} open={!!historyInvoice} onClose={() => setHistoryInvoice(null)}>
          <div className="mb-4 flex gap-4 text-sm">
            <div><span className="text-gray-500">Total: </span><span className="font-semibold">{fmt(Number(historyInvoice.total))}</span></div>
            <div><span className="text-gray-500">Paid: </span><span className="font-semibold text-green-600">{fmt(Number(historyInvoice.amountPaid))}</span></div>
            <div><span className="text-gray-500">Balance: </span><span className="font-semibold text-red-600">{fmt(balance(historyInvoice))}</span></div>
          </div>
          {paymentHistory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No payments recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {paymentHistory.map(p => (
                <div key={p.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.type === 'DEPOSIT' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {p.type}
                      </span>
                      <span className="font-semibold">{fmt(Number(p.amount))}</span>
                      <span className="text-gray-400 capitalize">{p.method}</span>
                    </div>
                    <span className="text-gray-400 text-xs">{safeDate(p.createdAt, 'dd MMM yyyy HH:mm')}</span>
                  </div>
                  {p.reference && <p className="text-gray-500 text-xs">Ref: {p.reference}</p>}
                  {p.notes     && <p className="text-gray-500 text-xs">{p.notes}</p>}
                  {p.proofPath && (
                    <a href={p.proofPath} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-1">
                      <Upload size={12} /> View Proof of Payment
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* ── View Invoice Modal ── */}
      {viewInvoice && (
        <Modal title={`Invoice ${viewInvoice.number}`} open={!!viewInvoice} onClose={() => setViewInvoice(null)}>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b">
            {(['details', 'items', 'history'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${activeTab === tab ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-500">Customer</p><p className="font-medium">{viewInvoice.customer?.name ?? '—'}</p></div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <div className="mt-1">
                    <Badge label={statusMeta[viewInvoice.status]?.label ?? viewInvoice.status} variant={statusMeta[viewInvoice.status]?.variant ?? 'yellow'} />
                    {viewInvoice.customer?.payLaterApproved && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Pay-Later</span>
                    )}
                  </div>
                </div>
                {[
                  ['Amount (excl. VAT)', fmt(Number(viewInvoice.amount || 0))],
                  ['VAT',               fmt(Number(viewInvoice.vatAmount || 0))],
                  ['Total',             fmt(Number(viewInvoice.total || 0))],
                  ['Amount Paid',       fmt(Number(viewInvoice.amountPaid || 0))],
                  ['Outstanding',       fmt(balance(viewInvoice))],
                  ['Due Date',          safeDate(viewInvoice.dueDate, 'dd MMM yyyy')],
                  ['Paid At',           safeDate(viewInvoice.paidAt, 'dd MMM yyyy')],
                  ['Created',           safeDate(viewInvoice.createdAt, 'dd MMM yyyy')],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-gray-500">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>
              {viewInvoice.depositRequired && (
                <div className="p-3 bg-orange-50 rounded-lg text-sm">
                  <p className="font-medium text-orange-800">Deposit Tracking</p>
                  <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-orange-700">
                    <div><span className="text-gray-500">Required: </span>{fmt(Number(viewInvoice.depositRequired))}</div>
                    <div><span className="text-gray-500">Paid: </span>{fmt(Number(viewInvoice.depositPaid))}</div>
                    <div><span className="text-gray-500">Remaining: </span>{fmt(depositRemaining(viewInvoice) ?? 0)}</div>
                  </div>
                </div>
              )}
              {viewInvoice.vehicleDescription && (
                <div><p className="text-gray-500 text-sm">Vehicle</p><p className="font-medium text-sm">{viewInvoice.vehicleDescription}</p></div>
              )}
              {viewInvoice.notes && (
                <div><p className="text-gray-500 text-sm">Notes</p><p className="text-sm">{viewInvoice.notes}</p></div>
              )}
            </div>
          )}

          {activeTab === 'items' && (
            <div>
              {(!viewInvoice.items || viewInvoice.items.length === 0) ? (
                <p className="text-sm text-gray-400 text-center py-6">No line items on this invoice.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-gray-500 text-xs uppercase bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-left">Condition</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewInvoice.items.map(item => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">{item.description}</td>
                        <td className="px-3 py-2">
                          {item.vehicleCondition && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${item.vehicleCondition === 'Non-Runner' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                              {item.vehicleCondition}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{fmt(Number(item.unitPrice))}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmt(Number(item.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <PaymentHistoryPanel invoiceId={viewInvoice.id} />
          )}
        </Modal>
      )}
    </div>
  );
}

/* ── Shared Invoice Form (single & bulk) ─────────────────────────────────────── */

function InvoiceForm({
  customers, register, handleSubmit, errors, isSubmitting, createMut, watch, reset, onClose,
  itemFields, appendItem, removeItem, derivedAmount, vat, total, bulkMode = false,
}: any) {
  // Collect any item-level errors into a flat list so the user can see what's wrong
  const itemErrors: string[] = [];
  if (Array.isArray(errors.items)) {
    errors.items.forEach((e: any, i: number) => {
      if (e?.description) itemErrors.push(`Item ${i + 1}: ${e.description.message}`);
      if (e?.unitPrice)   itemErrors.push(`Item ${i + 1}: ${e.unitPrice.message}`);
    });
  }

  return (
    <form onSubmit={handleSubmit((d: any) => createMut.mutate(d))} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
        <select {...register('customerId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
          <option value="">Select customer</option>
          {customers.map((c: CustomerOption) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.payLaterApproved ? ' (Pay-Later)' : ''}
            </option>
          ))}
        </select>
        {errors.customerId && <p className="text-red-500 text-xs mt-1">{errors.customerId.message}</p>}
      </div>

      {/* Items (bulk mode always shows, single mode optional) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            {bulkMode ? 'Vehicle Line Items *' : 'Line Items (optional)'}
          </label>
          <button type="button" onClick={() => appendItem({ description: '', vehicleCondition: null, quantity: 1, unitPrice: 0 })}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800">
            <PlusCircle size={14} /> Add Vehicle
          </button>
        </div>
        {itemErrors.length > 0 && (
          <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs space-y-0.5">
            {itemErrors.map((msg, i) => <p key={i}>{msg}</p>)}
          </div>
        )}
        {itemFields.length > 0 && (
          <div className="space-y-3">
            {itemFields.map((field: any, idx: number) => {
              const itemErr = Array.isArray(errors.items) ? errors.items[idx] : undefined;
              return (
                <div key={field.id} className="border rounded-lg p-3 bg-gray-50 relative">
                  <button type="button" onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <input
                        {...register(`items.${idx}.description`)}
                        placeholder="Vehicle description (make, colour, reg)"
                        className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 ${itemErr?.description ? 'border-red-400' : ''}`}
                      />
                    </div>
                    <div>
                      <select {...register(`items.${idx}.vehicleCondition`)} className="w-full border rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-brand-500">
                        <option value="">Condition (optional)</option>
                        <option value="Runner">Runner</option>
                        <option value="Non-Runner">Non-Runner</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <input type="number" min={1} {...register(`items.${idx}.quantity`)} placeholder="Qty" className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
                      <input
                        type="number" step="0.01"
                        {...register(`items.${idx}.unitPrice`)}
                        placeholder="Price"
                        className={`border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 ${itemErr?.unitPrice ? 'border-red-400' : ''}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Amount fields (shown when no items, or as read-only total when items present) */}
      <div className="grid grid-cols-2 gap-4">
        {itemFields.length === 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (excl. VAT) *</label>
            <input type="number" step="0.01" {...register('amount')}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="0.00" />
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
          </div>
        )}
        {itemFields.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal (from items)</label>
            <div className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 font-semibold">
              R {derivedAmount.toFixed(2)}
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">VAT %</label>
          <input type="number" {...register('vatRate')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">VAT Amount</label>
          <div className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700">R {vat}</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total (incl. VAT)</label>
          <div className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-900 font-semibold">R {total}</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Required</label>
          <input type="number" step="0.01" {...register('depositRequired')}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="0.00 (optional)" />
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

      {/* Single vehicle fields (only when no items) */}
      {itemFields.length === 0 && (
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
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={() => { onClose(); reset(); }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
        <button type="submit" disabled={isSubmitting || createMut.isPending}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
          {createMut.isPending ? 'Creating...' : 'Create Invoice'}
        </button>
      </div>
    </form>
  );
}

/* ── Inline payment history panel (used inside view modal) ───────────────────── */

function PaymentHistoryPanel({ invoiceId }: { invoiceId: number }) {
  const { data: payments = [], isLoading } = useQuery<InvoicePayment[]>({
    queryKey: ['invoice-payments', invoiceId],
    queryFn: () => api.get(`/invoices/${invoiceId}/payments`).then(r => normalizeList(r.data)),
  });

  if (isLoading) return <div className="flex flex-col items-center justify-center py-6 gap-2"><Loader2 className="animate-spin" size={20} /><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>;
  if (payments.length === 0) return <p className="text-sm text-gray-400 text-center py-6">No payments recorded yet.</p>;

  return (
    <div className="space-y-2">
      {payments.map(p => (
        <div key={p.id} className="border rounded-lg p-3 text-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.type === 'DEPOSIT' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                {p.type}
              </span>
              <span className="font-semibold">
                {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(p.amount))}
              </span>
              <span className="text-gray-400 capitalize">{p.method}</span>
            </div>
            <span className="text-gray-400 text-xs">
              {(() => {
                const d = new Date(p.createdAt);
                return isNaN(d.getTime()) ? '—' : format(d, 'dd MMM yyyy HH:mm');
              })()}
            </span>
          </div>
          {p.reference && <p className="text-gray-500 text-xs">Ref: {p.reference}</p>}
          {p.notes && <p className="text-gray-500 text-xs">{p.notes}</p>}
          {p.proofPath && (
            <a href={p.proofPath} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-1">
              <Upload size={12} /> View Proof of Payment
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
