import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, AlertCircle, Route, FileText, Receipt, UserCircle, Users, ChevronRight, X } from 'lucide-react';
import { format } from 'date-fns';
import Badge from '../../components/ui/Badge';

/* ── types ─────────────────────────────────────────────── */
interface TripResult {
  id: number; trackingCode: string; status: string;
  fromLocation: string; toLocation: string; startDate: string;
  customerVehicleMake: string | null; customerVehicleRegistration: string | null;
  customerVehicleVin: string | null; customerVehicleEngine: string | null;
  customerVehicleStock: string | null; vehicleCondition: string | null;
  customer: { id: number; name: string };
  driver: { id: number; name: string };
}
interface QuotationResult {
  id: number; number: string | null; status: string;
  pickup: string; dropoff: string; createdAt: string;
  customer: { id: number; name: string };
  items: { description: string; registration: string | null; vehicleCondition: string | null }[];
}
interface InvoiceResult {
  id: number; number: string; status: string; total: number;
  vehicleDescription: string | null; vehicleCondition: string | null; createdAt: string;
  customer: { id: number; name: string } | null;
}
interface CustomerResult { id: number; name: string; email: string; phone: string | null; }
interface DriverResult   { id: number; name: string; mobile: string; email: string; }

interface SearchResults {
  query: string; total: number;
  results: {
    trips: TripResult[]; quotations: QuotationResult[];
    invoices: InvoiceResult[]; customers: CustomerResult[]; drivers: DriverResult[];
  };
}

/* ── helpers ────────────────────────────────────────────── */
const tripStatusMeta: Record<string, { label: string; variant: 'yellow'|'blue'|'green'|'red' }> = {
  PENDING:     { label: 'Pending',     variant: 'yellow' },
  IN_PROGRESS: { label: 'In Progress', variant: 'blue' },
  COMPLETED:   { label: 'Completed',   variant: 'green' },
  CANCELLED:   { label: 'Cancelled',   variant: 'red' },
};
const quotationStatusMeta: Record<string, { label: string; variant: 'yellow'|'blue'|'green'|'red' }> = {
  DRAFT:     { label: 'Draft',     variant: 'yellow' },
  SENT:      { label: 'Sent',      variant: 'blue' },
  ACCEPTED:  { label: 'Accepted',  variant: 'green' },
  CONVERTED: { label: 'Converted', variant: 'green' },
  DECLINED:  { label: 'Declined',  variant: 'red' },
};
const invoiceStatusMeta: Record<string, { label: string; variant: 'yellow'|'green'|'red' }> = {
  unpaid:  { label: 'Unpaid',  variant: 'yellow' },
  paid:    { label: 'Paid',    variant: 'green' },
  overdue: { label: 'Overdue', variant: 'red' },
};
const conditionCls = (c: string | null) =>
  c === 'Non-Runner' ? 'bg-red-100 text-red-700' : c === 'Runner' ? 'bg-green-100 text-green-700' : '';

const fmt = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);

/* ── section header ─────────────────────────────────────── */
function Section({ icon: Icon, title, count, children }: {
  icon: React.ElementType; title: string; count: number; children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-brand-600" />
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
        <span className="ml-auto text-xs text-gray-400">{count} result{count !== 1 ? 's' : ''}</span>
      </div>
      <div className="bg-white rounded-xl border divide-y divide-gray-100">{children}</div>
    </div>
  );
}

/* ── main component ─────────────────────────────────────── */
export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const q              = searchParams.get('q') ?? '';
  const [input, setInput] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const { data, isLoading, isError } = useQuery<SearchResults>({
    queryKey: ['search', q],
    queryFn: () => api.get('/search', { params: { q } }).then(r => r.data),
    enabled: q.length >= 2,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) navigate(`/app/search?q=${encodeURIComponent(input.trim())}`);
  };

  const { trips = [], quotations = [], invoices = [], customers = [], drivers = [] } =
    data?.results ?? {};

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Search by booking number, VIN, registration, engine, stock, invoice, customer or driver…"
          className="w-full pl-11 pr-10 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white shadow-sm"
        />
        {input && (
          <button type="button" onClick={() => { setInput(''); navigate('/app/search'); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        )}
      </form>

      {/* States */}
      {!q && (
        <div className="text-center py-16 text-gray-400">
          <Search size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Start typing to search</p>
          <p className="text-sm mt-1">Search across bookings, VINs, registrations, invoices, customers and drivers</p>
        </div>
      )}

      {q.length === 1 && (
        <p className="text-sm text-gray-500 text-center py-8">Enter at least 2 characters to search.</p>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-brand-600" size={32} />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
          <AlertCircle size={20} /><span>Search failed. Please try again.</span>
        </div>
      )}

      {/* Summary */}
      {data && q.length >= 2 && !isLoading && (
        <p className="text-sm text-gray-500">
          {data.total === 0
            ? `No results for "${q}"`
            : `${data.total} result${data.total !== 1 ? 's' : ''} for "${q}"`}
        </p>
      )}

      {/* Results */}
      {data && data.total > 0 && (
        <div className="space-y-6">

          {/* Trips */}
          <Section icon={Route} title="Trips" count={trips.length}>
            {trips.map(t => {
              const sm = tripStatusMeta[t.status] ?? { label: t.status, variant: 'yellow' as const };
              return (
                <Link key={t.id} to="/app/trips" className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-gray-500">{t.trackingCode.slice(0, 12)}…</span>
                      <Badge label={sm.label} variant={sm.variant} />
                      {t.vehicleCondition && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conditionCls(t.vehicleCondition)}`}>
                          {t.vehicleCondition}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">
                      {t.customer.name} · {t.fromLocation} → {t.toLocation}
                    </p>
                    <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                      {t.customerVehicleMake        && <span>Make: {t.customerVehicleMake}</span>}
                      {t.customerVehicleRegistration && <span>Reg: {t.customerVehicleRegistration}</span>}
                      {t.customerVehicleVin          && <span>VIN: {t.customerVehicleVin}</span>}
                      {t.customerVehicleEngine       && <span>Engine: {t.customerVehicleEngine}</span>}
                      {t.customerVehicleStock        && <span>Stock: {t.customerVehicleStock}</span>}
                      <span>Driver: {t.driver.name}</span>
                      <span>{format(new Date(t.startDate), 'dd MMM yyyy')}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 shrink-0 mt-1" />
                </Link>
              );
            })}
          </Section>

          {/* Quotations (Bookings) */}
          <Section icon={FileText} title="Bookings" count={quotations.length}>
            {quotations.map(b => {
              const sm = quotationStatusMeta[b.status] ?? { label: b.status, variant: 'yellow' as const };
              const item = b.items[0];
              return (
                <Link key={b.id} to="/app/quotations" className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-gray-700">{b.number ?? `#${b.id}`}</span>
                      <Badge label={sm.label} variant={sm.variant} />
                      {item?.vehicleCondition && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conditionCls(item.vehicleCondition)}`}>
                          {item.vehicleCondition}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">
                      {b.customer.name} · {b.pickup} → {b.dropoff}
                    </p>
                    {item && (
                      <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                        <span>{item.description}</span>
                        {item.registration && <span>Reg: {item.registration}</span>}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 shrink-0 mt-1" />
                </Link>
              );
            })}
          </Section>

          {/* Invoices */}
          <Section icon={Receipt} title="Invoices" count={invoices.length}>
            {invoices.map(inv => {
              const sm = invoiceStatusMeta[inv.status] ?? { label: inv.status, variant: 'yellow' as const };
              return (
                <Link key={inv.id} to="/app/invoices" className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-gray-700">{inv.number}</span>
                      <Badge label={sm.label} variant={sm.variant} />
                      {inv.vehicleCondition && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conditionCls(inv.vehicleCondition)}`}>
                          {inv.vehicleCondition}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">
                      {inv.customer?.name ?? '—'} · {fmt(Number(inv.total))}
                    </p>
                    {inv.vehicleDescription && (
                      <p className="text-xs text-gray-400 mt-0.5">{inv.vehicleDescription}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 shrink-0 mt-1" />
                </Link>
              );
            })}
          </Section>

          {/* Customers */}
          <Section icon={UserCircle} title="Customers" count={customers.length}>
            {customers.map(c => (
              <Link key={c.id} to="/app/customers" className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 shrink-0" />
              </Link>
            ))}
          </Section>

          {/* Drivers */}
          <Section icon={Users} title="Drivers" count={drivers.length}>
            {drivers.map(d => (
              <Link key={d.id} to="/app/drivers" className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{d.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{d.email} · {d.mobile}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-500 shrink-0" />
              </Link>
            ))}
          </Section>

        </div>
      )}
    </div>
  );
}
