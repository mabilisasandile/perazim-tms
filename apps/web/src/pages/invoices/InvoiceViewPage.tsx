import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Mail, Download, Printer, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import logo from '../../assets/uploads/pera.png';

/* ── company letterhead (not yet stored in Settings — mirrors the printed invoice) ── */
const COMPANY = {
  regNumber: '2015/348658/07',
  tel:       '074 453 2701 / 064 524 2959',
  vatNumber: '4590298255',
  email:     'info@perazimauto.co.za',
  address:   '172 Umgeni Road Durban, South Africa',
  bank:      'FNB',
  account:   '62618074976',
  branch:    'Greyville',
  branchCode: '222726',
  paymentEmail: 'Perazimauto@gmail.com',
};

/* ── helpers ─────────────────────────────────────────── */

const safeDate = (v: string | null | undefined, fmtStr: string, fallback = '—') => {
  if (!v) return fallback;
  const d = new Date(v);
  return isNaN(d.getTime()) ? fallback : format(d, fmtStr);
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);

interface InvoiceItem {
  id: number;
  description: string;
  vehicleCondition: 'Runner' | 'Non-Runner' | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: number;
  number: string;
  amount: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  dueDate: string | null;
  notes: string | null;
  vehicleDescription: string | null;
  vehicleCondition: 'Runner' | 'Non-Runner' | null;
  createdAt: string;
  customer?: { id: number; name: string; email?: string; phone?: string | null; address?: string | null } | null;
  items?: InvoiceItem[];
}

export default function InvoiceViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [downloading, setDownloading] = useState(false);

  const { data: invoice, isLoading, isError } = useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn: () => api.get(`/invoices/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const emailMut = useMutation({
    mutationFn: () => api.post(`/invoices/${id}/email`),
    onSuccess: () => setEmailStatus('sent'),
    onError:   () => setEmailStatus('error'),
  });

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    if (!printRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth  = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight  = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position   = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`${invoice?.number ?? 'invoice'}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="animate-spin text-brand-600" size={32} />
      <p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p>
    </div>
  );
  if (isError || !invoice) return (
    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
      <AlertCircle size={20} /><span>Failed to load invoice.</span>
    </div>
  );

  const balance = Math.max(0, Number(invoice.total) - Number(invoice.amountPaid));
  const items = invoice.items && invoice.items.length > 0
    ? invoice.items
    : [{
        id: 0,
        description: invoice.vehicleDescription ?? 'Service',
        vehicleCondition: invoice.vehicleCondition,
        quantity: 1,
        unitPrice: Number(invoice.amount),
        total: Number(invoice.amount),
      } as InvoiceItem];

  return (
    <div className="space-y-4">
      {/* ── Action bar (hidden on print) ── */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={() => { setEmailStatus('idle'); emailMut.mutate(); }}
          disabled={emailMut.isPending}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {emailMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
          Email Invoice
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Download Invoice
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          <Printer size={16} /> Print Invoice
        </button>

        {emailStatus === 'sent' && (
          <span className="flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 size={16} /> Invoice emailed to customer.</span>
        )}
        {emailStatus === 'error' && (
          <span className="flex items-center gap-1 text-sm text-red-600"><AlertCircle size={16} /> Failed to send invoice email.</span>
        )}
      </div>

      {/* ── Printable invoice ── */}
      <div ref={printRef} className="bg-white rounded-xl border shadow-sm max-w-4xl mx-auto p-10 print:border-0 print:shadow-none print:rounded-none print:max-w-none">
        {/* Letterhead */}
        <div className="flex justify-between items-start gap-6 pb-6 border-b">
          <div className="space-y-1">
            <img src={logo} alt="Perazim Auto Transporters" className="h-12 w-auto object-contain mb-2" />
            <p className="text-xs text-gray-700"><span className="font-semibold">REG NUMBER:</span> {COMPANY.regNumber}</p>
            <p className="text-xs text-gray-700"><span className="font-semibold">TEL:</span> {COMPANY.tel}</p>
            <p className="text-xs text-gray-700"><span className="font-semibold">VAT:</span> {COMPANY.vatNumber}</p>
            <p className="text-xs text-gray-700"><span className="font-semibold">EMAIL:</span> {COMPANY.email}</p>
            <p className="text-xs text-gray-700"><span className="font-semibold">ADDRESS:</span><br />{COMPANY.address}</p>
          </div>
          <div className="text-right space-y-1">
            <h1 className="text-4xl font-bold text-blue-900 tracking-wide">INVOICE</h1>
            <p className="text-sm text-gray-700"><span className="font-semibold">Invoice No:</span> {invoice.number}</p>
            <p className="text-sm text-gray-700"><span className="font-semibold">Invoice Date:</span> {safeDate(invoice.createdAt, 'yyyy-MM-dd')}</p>
            <p className="text-sm text-gray-700"><span className="font-semibold">Due Date:</span> {safeDate(invoice.dueDate, 'yyyy-MM-dd')}</p>
          </div>
        </div>

        {/* Invoice to */}
        <div className="pt-6 pb-4">
          <h2 className="text-blue-900 font-bold text-lg mb-1">Invoice To:</h2>
          <p className="font-bold uppercase text-gray-900">{invoice.customer?.name ?? '—'}</p>
          {invoice.customer?.phone && <p className="text-sm text-gray-700 mt-1">Phone: {invoice.customer.phone}</p>}
          <p className="text-sm text-gray-700">VAT: n/a | REG: n/a</p>
        </div>

        {/* Items table */}
        <table className="w-full text-sm border-t border-b">
          <thead>
            <tr className="bg-blue-900 text-white text-xs uppercase">
              <th className="px-3 py-2 text-left">Details</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Unit</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-3 py-3 align-top">
                  <p className="font-semibold text-gray-900">{item.description}</p>
                  {item.vehicleCondition && (
                    <p className="text-xs text-gray-500 mt-1">COLOUR: {item.vehicleCondition}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-right align-top">{item.quantity}</td>
                <td className="px-3 py-3 text-right align-top">{fmt(Number(item.unitPrice))}</td>
                <td className="px-3 py-3 text-right align-top font-medium">{fmt(Number(item.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end pt-4">
          <div className="w-64 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Sub Total:</span>
              <span className="font-medium">{fmt(Number(invoice.amount))}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Paid:</span>
              <span className="font-medium">{fmt(Number(invoice.amountPaid))}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">VAT:</span>
              <span className="font-medium">{fmt(Number(invoice.vatAmount))}</span>
            </div>
            <div className="flex justify-between items-center bg-blue-900 text-white font-bold px-3 py-2 mt-2">
              <span>Total Due</span>
              <span>{fmt(balance)}</span>
            </div>
          </div>
        </div>

        {/* Banking details + signature */}
        <div className="flex justify-between items-end pt-12 gap-6">
          <div className="text-xs text-gray-700 space-y-0.5">
            <h3 className="text-blue-900 font-bold text-sm mb-1">Banking Details</h3>
            <p>PERAZIM AUTO TRANSPORTERS (PTY)LTD</p>
            <p><span className="font-semibold">Bank:</span> {COMPANY.bank}</p>
            <p><span className="font-semibold">Account:</span> {COMPANY.account}</p>
            <p><span className="font-semibold">Branch:</span> {COMPANY.branch}</p>
            <p><span className="font-semibold">Branch Code:</span> {COMPANY.branchCode}</p>
            <p>Use invoice number as payment reference.</p>
            <p>
              Please send a proof of payment to{' '}
              <a href={`mailto:${COMPANY.paymentEmail}`} className="text-blue-700 underline">{COMPANY.paymentEmail}</a>
            </p>
          </div>
          <div className="text-sm text-gray-700 whitespace-nowrap">
            Authorising Signature: ________________________
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-10">
          <p className="text-xl font-semibold text-blue-900">Thank you for your business.</p>
          <p className="text-xs text-gray-500 mt-1">WE COLLECT, MOVE AND DELIVER YOUR VEHICLES ON TIME, EVERY TIME</p>
        </div>
      </div>

      <div className="text-center print:hidden">
        <Link to="/app/invoices" className="text-sm text-brand-600 hover:underline">Back to invoices list</Link>
      </div>
    </div>
  );
}
