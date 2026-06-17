import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  DollarSign, Users, TrendingUp, AlertCircle, Plus, Loader2,
  Eye, CheckCircle, Banknote, Trash2, Printer,
  Settings, ChevronDown, ChevronUp, BarChart3, X,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

/* ── types ─────────────────────────────────────────────────── */

interface Driver { id: number; name: string; mobile: string; email: string; }

interface PayrollEntry {
  id: number; driverId: number;
  driver: Driver;
  periodType: string; periodStart: string; periodEnd: string;
  baseSalary: number; tripCount: number; tripEarnings: number;
  commissions: number; bonuses: number; deductions: number;
  grossPay: number; netPay: number;
  status: string;
  approvedAt: string | null; approvedBy: string | null;
  paidAt: string | null; paymentMethod: string | null; paymentRef: string | null;
  notes: string | null;
  tripLinks?: TripLink[];
}

interface TripLink {
  id: number; tripId: number;
  trip: { id: number; trackingCode: string; fromLocation: string; toLocation: string; totalAmount: string; endDate: string };
  tripAmount: number; tripRate: number; commission: number; driverEarnings: number;
}

interface PayrollSettings {
  id: number; baseEnabled: boolean; defaultBaseSalary: number | null;
  tripRateEnabled: boolean; defaultTripRate: number | null;
  commissionEnabled: boolean; commissionRate: number | null; currency: string;
}

interface DriverConfig {
  driver: { id: number; name: string; mobile: string };
  config: { baseSalary: number | null; tripRate: number | null; commissionRate: number | null; notes: string | null } | null;
  effective: { baseSalary: number; tripRate: number; commissionRate: number };
}

interface PerformanceReport {
  period: { from: string; to: string };
  drivers: {
    driver: { id: number; name: string; mobile: string };
    totalTrips: number; totalRevenue: number; totalEarnings: number;
    avgPerTrip: number; payrollEntries: number; payrollTrips: number;
  }[];
}

interface PayrollReport {
  periodType: string; periodStart: string; periodEnd: string;
  entries: PayrollEntry[];
  totals: {
    driverCount: number; totalTrips: number; totalBaseSalary: number;
    totalTripEarnings: number; totalCommissions: number;
    totalBonuses: number; totalDeductions: number; totalGrossPay: number; totalNetPay: number;
  };
}

/* ── helpers ────────────────────────────────────────────────── */

const fmtMoney = (n: number, currency = 'ZAR') =>
  `${currency === 'ZAR' ? 'R ' : currency + ' '}${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (v: string | null | undefined) =>
  v ? format(parseISO(v), 'dd MMM yyyy') : '—';

const statusVariant = (s: string): 'gray' | 'yellow' | 'green' | 'red' | 'blue' =>
  ({ DRAFT: 'gray', APPROVED: 'blue', PAID: 'green', OUTSTANDING: 'red' } as any)[s] ?? 'gray';

const normalizeList = (res: unknown): any[] => {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    for (const key of ['data', 'items', 'results']) if (Array.isArray(obj[key])) return obj[key] as any[];
  }
  return [];
};

/* ── overview stats ─────────────────────────────────────────── */

function StatsRow({ entries }: { entries: PayrollEntry[] }) {
  const now = new Date();
  const monthEntries = entries.filter(e => {
    const d = parseISO(e.periodStart);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const outstanding  = entries.filter(e => e.status === 'OUTSTANDING' || e.status === 'APPROVED');
  const paidTotal    = entries.filter(e => e.status === 'PAID').reduce((s, e) => s + Number(e.netPay), 0);
  const monthTotal   = monthEntries.reduce((s, e) => s + Number(e.netPay), 0);
  const outstandingTotal = outstanding.reduce((s, e) => s + Number(e.netPay), 0);

  const cards = [
    { label: 'Payroll This Month', value: fmtMoney(monthTotal), icon: DollarSign, color: 'text-brand-600 bg-brand-50' },
    { label: 'Outstanding', value: fmtMoney(outstandingTotal), icon: AlertCircle, color: 'text-red-600 bg-red-50' },
    { label: 'Total Paid (all)', value: fmtMoney(paidTotal), icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Entries This Month', value: monthEntries.length.toString(), icon: Users, color: 'text-blue-600 bg-blue-50' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${c.color}`}><c.icon size={20}/></div>
          <div><p className="text-xs text-gray-500">{c.label}</p><p className="text-lg font-bold text-gray-900">{c.value}</p></div>
        </div>
      ))}
    </div>
  );
}

/* ── generate modal ─────────────────────────────────────────── */

function GenerateModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [driverId, setDriverId] = useState('');
  const [periodType, setPeriodType] = useState('WEEKLY');
  const [periodStart, setPeriodStart] = useState('');
  const [err, setErr] = useState('');

  const { data: driversRaw = [] } = useQuery({
    queryKey: ['drivers-select'],
    queryFn: () => api.get('/drivers').then(r => normalizeList(r.data)),
  });

  const genMut = useMutation({
    mutationFn: () => api.post('/payroll/generate', { driverId: Number(driverId), periodType, periodStart }),
    onSuccess: () => { onSuccess(); onClose(); setDriverId(''); setPeriodStart(''); setErr(''); },
    onError: (e: any) => setErr(e.response?.data?.message ?? 'Generation failed'),
  });

  const label = periodType === 'WEEKLY'
    ? periodStart ? `Week of ${fmtDate(periodStart)}` : 'Select week start (Monday)'
    : periodStart ? `Month of ${format(parseISO(periodStart), 'MMMM yyyy')}` : 'Select month start (1st)';

  return (
    <Modal title="Generate Payroll Entry" open={open} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Driver *</label>
          <select value={driverId} onChange={e => setDriverId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">Select driver…</option>
            {driversRaw.filter((d: any) => d.isActive).map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
            <select value={periodType} onChange={e => { setPeriodType(e.target.value); setPeriodStart(''); }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {periodType === 'WEEKLY' ? 'Week Start (Mon)' : 'Month Start (1st)'}
            </label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"/>
          </div>
        </div>
        {periodStart && <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">{label}</p>}
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={() => genMut.mutate()} disabled={!driverId || !periodStart || genMut.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
            {genMut.isPending ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
            Generate
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── entry detail modal ─────────────────────────────────────── */

function EntryDetailModal({ entryId, open, onClose, currency }: {
  entryId: number | null; open: boolean; onClose: () => void; currency: string;
}) {
  const qc = useQueryClient();
  const [bonuses, setBonuses]     = useState('');
  const [deductions, setDeductions] = useState('');
  const [payMethod, setPayMethod]  = useState('BANK_TRANSFER');
  const [payRef, setPayRef]        = useState('');
  const [showPay, setShowPay]      = useState(false);
  const [err, setErr]              = useState('');

  const { data: entry, isLoading } = useQuery<PayrollEntry>({
    queryKey: ['payroll-entry', entryId],
    queryFn: () => api.get(`/payroll/${entryId}`).then(r => r.data),
    enabled: open && entryId !== null,
  });

  const manualsMut = useMutation({
    mutationFn: () => api.patch(`/payroll/${entryId}/manuals`, {
      bonuses:    bonuses    ? Number(bonuses)    : undefined,
      deductions: deductions ? Number(deductions) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-entry', entryId] }); qc.invalidateQueries({ queryKey: ['payroll-entries'] }); setErr(''); },
    onError: (e: any) => setErr(e.response?.data?.message ?? 'Update failed'),
  });

  const statusMut = useMutation({
    mutationFn: (data: { status: string; paymentMethod?: string; paymentRef?: string }) =>
      api.patch(`/payroll/${entryId}/status`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-entry', entryId] }); qc.invalidateQueries({ queryKey: ['payroll-entries'] }); setShowPay(false); setErr(''); },
    onError: (e: any) => setErr(e.response?.data?.message ?? 'Status update failed'),
  });

  if (!entry) return (
    <Modal title="Payroll Entry" open={open} onClose={onClose} width="max-w-3xl">
      {isLoading && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand-600"/></div>}
    </Modal>
  );

  const fm = (n: number) => fmtMoney(n, currency);
  const canEdit = entry.status !== 'PAID';

  return (
    <Modal title={`Payroll — ${entry.driver.name}`} open={open} onClose={onClose} width="max-w-3xl">
      <div className="space-y-5">
        {/* header bar */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{entry.periodType} · {fmtDate(entry.periodStart)} – {fmtDate(entry.periodEnd)}</p>
            <p className="text-xs text-gray-500">{entry.tripCount} trips · {entry.driver.mobile}</p>
          </div>
          <Badge label={entry.status} variant={statusVariant(entry.status)}/>
        </div>

        {/* earnings breakdown */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Earnings Breakdown</p>
          <div className="divide-y divide-gray-100 rounded-lg border overflow-hidden">
            {[
              { label: 'Base Salary',     value: Number(entry.baseSalary),    show: true },
              { label: 'Trip Earnings',   value: Number(entry.tripEarnings),  show: true },
              { label: 'Commissions',     value: Number(entry.commissions),   show: true },
              { label: 'Bonuses',         value: Number(entry.bonuses),       show: true },
              { label: 'Deductions',      value: -Number(entry.deductions),   show: true },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between px-4 py-2.5 bg-white">
                <span className="text-sm text-gray-600">{r.label}</span>
                <span className={`text-sm font-medium ${r.value < 0 ? 'text-red-600' : 'text-gray-900'}`}>{fm(Math.abs(r.value))}{r.value < 0 ? ' (-)' : ''}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-brand-50">
              <span className="text-sm font-bold text-gray-900">Net Pay</span>
              <span className="text-base font-bold text-brand-700">{fm(Number(entry.netPay))}</span>
            </div>
          </div>
        </div>

        {/* manual adjustments */}
        {canEdit && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Adjustments</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bonuses (R)</label>
                <input type="number" step="0.01" min="0"
                  defaultValue={Number(entry.bonuses) || ''}
                  onChange={e => setBonuses(e.target.value)}
                  placeholder="0.00"
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Deductions (R)</label>
                <input type="number" step="0.01" min="0"
                  defaultValue={Number(entry.deductions) || ''}
                  onChange={e => setDeductions(e.target.value)}
                  placeholder="0.00"
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
              </div>
            </div>
            <button onClick={() => manualsMut.mutate()} disabled={manualsMut.isPending}
              className="mt-2 flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium disabled:opacity-60">
              {manualsMut.isPending && <Loader2 size={12} className="animate-spin"/>} Save Adjustments
            </button>
          </div>
        )}

        {/* trip breakdown */}
        {(entry.tripLinks ?? []).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Trip Breakdown ({entry.tripLinks!.length})</p>
            <div className="rounded-lg border overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Trip</th>
                    <th className="px-3 py-2 text-left">Route</th>
                    <th className="px-3 py-2 text-right">Trip Amt</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Comm</th>
                    <th className="px-3 py-2 text-right">Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entry.tripLinks!.map(l => (
                    <tr key={l.id} className="bg-white">
                      <td className="px-3 py-2 font-mono">{l.trip.trackingCode.slice(-8)}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{l.trip.fromLocation} → {l.trip.toLocation}</td>
                      <td className="px-3 py-2 text-right">{fm(Number(l.tripAmount))}</td>
                      <td className="px-3 py-2 text-right">{fm(Number(l.tripRate))}</td>
                      <td className="px-3 py-2 text-right">{fm(Number(l.commission))}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fm(Number(l.driverEarnings))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {err && <p className="text-xs text-red-600">{err}</p>}

        {/* actions */}
        <div className="flex gap-2 pt-2 border-t flex-wrap">
          {entry.status === 'DRAFT' && (
            <button onClick={() => statusMut.mutate({ status: 'APPROVED' })} disabled={statusMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg disabled:opacity-60">
              <CheckCircle size={13}/> Approve
            </button>
          )}
          {entry.status === 'DRAFT' && (
            <button onClick={() => statusMut.mutate({ status: 'OUTSTANDING' })} disabled={statusMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg disabled:opacity-60">
              <AlertCircle size={13}/> Mark Outstanding
            </button>
          )}
          {(entry.status === 'APPROVED' || entry.status === 'OUTSTANDING') && !showPay && (
            <button onClick={() => setShowPay(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg">
              <Banknote size={13}/> Mark as Paid
            </button>
          )}
          {showPay && (
            <div className="flex items-center gap-2 flex-wrap">
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                className="border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500">
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
              </select>
              <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Payment ref (optional)"
                className="border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 w-40"/>
              <button onClick={() => statusMut.mutate({ status: 'PAID', paymentMethod: payMethod, paymentRef: payRef })}
                disabled={statusMut.isPending}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-60">
                {statusMut.isPending ? <Loader2 size={12} className="animate-spin"/> : null} Confirm
              </button>
              <button onClick={() => setShowPay(false)} className="p-1.5 text-gray-400 hover:text-gray-600"><X size={14}/></button>
            </div>
          )}
          {entry.paidAt && (
            <p className="text-xs text-gray-500 self-center">Paid {fmtDate(entry.paidAt)} via {entry.paymentMethod?.replace('_', ' ')}{entry.paymentRef ? ` · Ref: ${entry.paymentRef}` : ''}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ── settings tab ───────────────────────────────────────────── */

function SettingsTab() {
  const qc = useQueryClient();
  const [expandedDriver, setExpandedDriver] = useState<number | null>(null);
  const [driverForm, setDriverForm] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');

  const { data: settings, isLoading: sLoad } = useQuery<PayrollSettings>({
    queryKey: ['payroll-settings'],
    queryFn: () => api.get('/payroll/settings').then(r => r.data),
  });

  const { data: driverConfigs = [] } = useQuery<DriverConfig[]>({
    queryKey: ['payroll-driver-configs'],
    queryFn: () => api.get('/payroll/driver-configs').then(r => r.data),
  });

  const [sf, setSf] = useState<Partial<PayrollSettings>>({});
  const settingsMut = useMutation({
    mutationFn: () => api.put('/payroll/settings', { ...settings, ...sf }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-settings'] }); setErr(''); },
    onError: (e: any) => setErr(e.response?.data?.message ?? 'Save failed'),
  });

  const driverCfgMut = useMutation({
    mutationFn: (driverId: number) => api.put(`/payroll/driver-configs/${driverId}`, {
      baseSalary:     driverForm.baseSalary     ? Number(driverForm.baseSalary)     : null,
      tripRate:       driverForm.tripRate        ? Number(driverForm.tripRate)       : null,
      commissionRate: driverForm.commissionRate  ? Number(driverForm.commissionRate) : null,
      notes:          driverForm.notes           || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-driver-configs'] }); setExpandedDriver(null); setDriverForm({}); },
    onError: (e: any) => setErr(e.response?.data?.message ?? 'Save failed'),
  });

  const merged = { ...settings, ...sf };

  if (sLoad) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand-600"/></div>;

  return (
    <div className="space-y-6">
      {/* global settings */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Global Payroll Settings</h3>
        <div className="space-y-4">
          {/* base salary */}
          <div className="flex items-start gap-4 pb-4 border-b">
            <div className="flex items-center gap-2 pt-0.5">
              <input type="checkbox" id="baseEnabled" checked={merged.baseEnabled ?? false}
                onChange={e => setSf(f => ({ ...f, baseEnabled: e.target.checked }))} className="rounded"/>
              <label htmlFor="baseEnabled" className="text-sm font-medium text-gray-700">Base Salary</label>
            </div>
            {merged.baseEnabled && (
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Default Base Salary (R)</label>
                <input type="number" step="0.01" min="0"
                  defaultValue={settings?.defaultBaseSalary ?? ''}
                  onChange={e => setSf(f => ({ ...f, defaultBaseSalary: e.target.value ? Number(e.target.value) : null }))}
                  className="w-40 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
              </div>
            )}
          </div>
          {/* trip rate */}
          <div className="flex items-start gap-4 pb-4 border-b">
            <div className="flex items-center gap-2 pt-0.5">
              <input type="checkbox" id="tripRateEnabled" checked={merged.tripRateEnabled ?? false}
                onChange={e => setSf(f => ({ ...f, tripRateEnabled: e.target.checked }))} className="rounded"/>
              <label htmlFor="tripRateEnabled" className="text-sm font-medium text-gray-700">Per-Trip Rate</label>
            </div>
            {merged.tripRateEnabled && (
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Default Rate per Trip (R)</label>
                <input type="number" step="0.01" min="0"
                  defaultValue={settings?.defaultTripRate ?? ''}
                  onChange={e => setSf(f => ({ ...f, defaultTripRate: e.target.value ? Number(e.target.value) : null }))}
                  className="w-40 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
              </div>
            )}
          </div>
          {/* commission */}
          <div className="flex items-start gap-4">
            <div className="flex items-center gap-2 pt-0.5">
              <input type="checkbox" id="commissionEnabled" checked={merged.commissionEnabled ?? false}
                onChange={e => setSf(f => ({ ...f, commissionEnabled: e.target.checked }))} className="rounded"/>
              <label htmlFor="commissionEnabled" className="text-sm font-medium text-gray-700">Commission on Trip Revenue</label>
            </div>
            {merged.commissionEnabled && (
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Commission Rate (%)</label>
                <input type="number" step="0.1" min="0" max="100"
                  defaultValue={settings?.commissionRate ?? ''}
                  onChange={e => setSf(f => ({ ...f, commissionRate: e.target.value ? Number(e.target.value) : null }))}
                  className="w-32 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
              </div>
            )}
          </div>
        </div>
        {err && <p className="text-xs text-red-600 mt-3">{err}</p>}
        <button onClick={() => settingsMut.mutate()} disabled={settingsMut.isPending}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
          {settingsMut.isPending && <Loader2 size={13} className="animate-spin"/>} Save Settings
        </button>
      </div>

      {/* per-driver overrides */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-gray-900">Per-Driver Rate Overrides</h3>
          <p className="text-xs text-gray-500 mt-0.5">Leave blank to use global defaults shown in brackets.</p>
        </div>
        <div className="divide-y divide-gray-100">
          {driverConfigs.map(({ driver, config, effective }) => (
            <div key={driver.id}>
              <div className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{driver.name}</p>
                  <p className="text-xs text-gray-400">
                    Base: R{effective.baseSalary} · Trip: R{effective.tripRate} · Comm: {effective.commissionRate}%
                    {config && <span className="text-brand-600 ml-1">(custom)</span>}
                  </p>
                </div>
                <button onClick={() => {
                  if (expandedDriver === driver.id) { setExpandedDriver(null); return; }
                  setExpandedDriver(driver.id);
                  setDriverForm({
                    baseSalary:     config?.baseSalary?.toString()     ?? '',
                    tripRate:       config?.tripRate?.toString()        ?? '',
                    commissionRate: config?.commissionRate?.toString()  ?? '',
                    notes:          config?.notes                       ?? '',
                  });
                }} className="p-1.5 text-gray-400 hover:text-gray-700">
                  {expandedDriver === driver.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </button>
              </div>
              {expandedDriver === driver.id && (
                <div className="px-5 pb-4 bg-gray-50 border-t">
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {[
                      { label: 'Base Salary (R)', key: 'baseSalary', placeholder: `Default: ${effective.baseSalary}` },
                      { label: 'Trip Rate (R)', key: 'tripRate', placeholder: `Default: ${effective.tripRate}` },
                      { label: 'Commission (%)', key: 'commissionRate', placeholder: `Default: ${effective.commissionRate}` },
                    ].map(({ label, key, placeholder }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                        <input type="number" step="0.01" min="0"
                          value={driverForm[key] ?? ''}
                          onChange={e => setDriverForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => driverCfgMut.mutate(driver.id)} disabled={driverCfgMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg disabled:opacity-60">
                      {driverCfgMut.isPending && <Loader2 size={12} className="animate-spin"/>} Save
                    </button>
                    <button onClick={() => setExpandedDriver(null)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {driverConfigs.length === 0 && (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No active drivers found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── reports tab ────────────────────────────────────────────── */

function ReportsTab({ currency }: { currency: string }) {
  const [reportType, setReportType]   = useState<'performance' | 'payroll'>('payroll');
  const [periodType, setPeriodType]   = useState('MONTHLY');
  const [periodStart, setPeriodStart] = useState('');
  const [fromDate, setFromDate]       = useState('');
  const [toDate, setToDate]           = useState('');
  const [perfData, setPerfData]       = useState<PerformanceReport | null>(null);
  const [payData, setPayData]         = useState<PayrollReport | null>(null);
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState('');

  const fm = (n: number) => fmtMoney(n, currency);

  const generate = async () => {
    setErr(''); setLoading(true); setPerfData(null); setPayData(null);
    try {
      if (reportType === 'performance') {
        const r = await api.get(`/payroll/reports/performance?from=${fromDate}&to=${toDate}`);
        setPerfData(r.data);
      } else {
        const r = await api.get(`/payroll/reports/payroll?periodType=${periodType}&periodStart=${periodStart}`);
        setPayData(r.data);
      }
    } catch (e: any) {
      setErr(e.response?.data?.message ?? 'Report generation failed');
    } finally {
      setLoading(false);
    }
  };

  const printReport = (html: string) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Payroll Report</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111;font-size:12px}
      h1{font-size:18px;margin-bottom:4px}h2{font-size:14px;margin:16px 0 8px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th{background:#f3f4f6;padding:6px 10px;text-align:left;font-size:11px;border:1px solid #e5e7eb}
      td{padding:6px 10px;border:1px solid #e5e7eb;font-size:11px}
      .total{font-weight:bold;background:#eff6ff}
      .money{text-align:right;font-family:monospace}
      @media print{button{display:none}}
    </style></head><body>${html}<br><button onclick="window.print()">Print</button></body></html>`);
    w.document.close();
  };

  const printPerformance = () => {
    if (!perfData) return;
    const rows = perfData.drivers.map(d => `
      <tr>
        <td>${d.driver.name}</td>
        <td class="money">${d.totalTrips}</td>
        <td class="money">${fm(d.totalRevenue)}</td>
        <td class="money">${fm(d.totalEarnings)}</td>
        <td class="money">${fm(d.avgPerTrip)}</td>
        <td class="money">${d.payrollEntries}</td>
      </tr>`).join('');
    printReport(`
      <h1>Driver Performance Report</h1>
      <p>Period: ${perfData.period.from} to ${perfData.period.to}</p>
      <table>
        <tr><th>Driver</th><th>Trips</th><th>Revenue</th><th>Earnings</th><th>Avg/Trip</th><th>Payroll Entries</th></tr>
        ${rows}
      </table>`);
  };

  const printPayroll = () => {
    if (!payData) return;
    const t = payData.totals;
    const rows = payData.entries.map(e => `
      <tr>
        <td>${e.driver.name}</td>
        <td class="money">${e.tripCount}</td>
        <td class="money">${fm(Number(e.baseSalary))}</td>
        <td class="money">${fm(Number(e.tripEarnings))}</td>
        <td class="money">${fm(Number(e.commissions))}</td>
        <td class="money">${fm(Number(e.bonuses))}</td>
        <td class="money">${fm(Number(e.deductions))}</td>
        <td class="money"><strong>${fm(Number(e.netPay))}</strong></td>
        <td>${e.status}</td>
      </tr>`).join('');
    printReport(`
      <h1>${payData.periodType} Payroll Report</h1>
      <p>Period: ${fmtDate(payData.periodStart)} – ${fmtDate(payData.periodEnd)}</p>
      <table>
        <tr><th>Driver</th><th>Trips</th><th>Base</th><th>Trip Pay</th><th>Comm</th><th>Bonus</th><th>Deductions</th><th>Net Pay</th><th>Status</th></tr>
        ${rows}
        <tr class="total">
          <td><strong>Totals (${t.driverCount} drivers)</strong></td>
          <td class="money">${t.totalTrips}</td>
          <td class="money">${fm(t.totalBaseSalary)}</td>
          <td class="money">${fm(t.totalTripEarnings)}</td>
          <td class="money">${fm(t.totalCommissions)}</td>
          <td class="money">${fm(t.totalBonuses)}</td>
          <td class="money">${fm(t.totalDeductions)}</td>
          <td class="money"><strong>${fm(t.totalNetPay)}</strong></td>
          <td></td>
        </tr>
      </table>`);
  };

  return (
    <div className="space-y-5">
      {/* controls */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Generate Report</h3>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Report Type</label>
            <select value={reportType} onChange={e => { setReportType(e.target.value as any); setPerfData(null); setPayData(null); }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="payroll">Weekly / Monthly Payroll</option>
              <option value="performance">Driver Performance</option>
            </select>
          </div>

          {reportType === 'payroll' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Period</label>
                <select value={periodType} onChange={e => { setPeriodType(e.target.value); setPeriodStart(''); }}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {periodType === 'WEEKLY' ? 'Week Start (Mon)' : 'Month Start (1st)'}
                </label>
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"/>
              </div>
            </>
          )}

          {reportType === 'performance' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"/>
              </div>
            </>
          )}

          <button onClick={generate}
            disabled={loading || (reportType === 'payroll' ? !periodStart : !fromDate || !toDate)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
            {loading ? <Loader2 size={14} className="animate-spin"/> : <BarChart3 size={14}/>}
            Generate
          </button>
        </div>
        {err && <p className="text-xs text-red-600 mt-3">{err}</p>}
      </div>

      {/* performance result */}
      {perfData && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Driver Performance Report</h3>
              <p className="text-xs text-gray-500">{fmtDate(perfData.period.from)} – {fmtDate(perfData.period.to)}</p>
            </div>
            <button onClick={printPerformance} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 border rounded-lg px-3 py-1.5">
              <Printer size={13}/> Print
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Driver</th>
                  <th className="px-4 py-3 text-right">Trips</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Total Earnings</th>
                  <th className="px-4 py-3 text-right">Avg / Trip</th>
                  <th className="px-4 py-3 text-right">Payroll Entries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {perfData.drivers.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No data for this period.</td></tr>
                ) : perfData.drivers.map(d => (
                  <tr key={d.driver.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{d.driver.name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{d.totalTrips}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fm(d.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-700">{fm(d.totalEarnings)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fm(d.avgPerTrip)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{d.payrollEntries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* payroll result */}
      {payData && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{payData.periodType} Payroll Report</h3>
              <p className="text-xs text-gray-500">{fmtDate(payData.periodStart)} – {fmtDate(payData.periodEnd)} · {payData.totals.driverCount} drivers</p>
            </div>
            <button onClick={printPayroll} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 border rounded-lg px-3 py-1.5">
              <Printer size={13}/> Print
            </button>
          </div>
          {/* totals bar */}
          <div className="grid grid-cols-4 gap-0 border-b">
            {[
              { label: 'Total Trips',   value: payData.totals.totalTrips.toString() },
              { label: 'Total Gross',   value: fm(payData.totals.totalGrossPay) },
              { label: 'Total Deductions', value: fm(payData.totals.totalDeductions) },
              { label: 'Total Net Pay', value: fm(payData.totals.totalNetPay) },
            ].map((s, i) => (
              <div key={i} className="px-4 py-3 border-r last:border-r-0">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-sm font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Driver</th>
                  <th className="px-4 py-3 text-right">Trips</th>
                  <th className="px-4 py-3 text-right">Base</th>
                  <th className="px-4 py-3 text-right">Trip Pay</th>
                  <th className="px-4 py-3 text-right">Comm</th>
                  <th className="px-4 py-3 text-right">Bonus</th>
                  <th className="px-4 py-3 text-right">Deductions</th>
                  <th className="px-4 py-3 text-right">Net Pay</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payData.entries.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No payroll entries for this period.</td></tr>
                ) : payData.entries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{e.driver.name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{e.tripCount}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fm(Number(e.baseSalary))}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fm(Number(e.tripEarnings))}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fm(Number(e.commissions))}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fm(Number(e.bonuses))}</td>
                    <td className="px-4 py-3 text-right text-red-600">{fm(Number(e.deductions))}</td>
                    <td className="px-4 py-3 text-right font-bold text-brand-700">{fm(Number(e.netPay))}</td>
                    <td className="px-4 py-3"><Badge label={e.status} variant={statusVariant(e.status)}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── main page ──────────────────────────────────────────────── */

type Tab = 'overview' | 'entries' | 'reports' | 'settings';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',  icon: TrendingUp  },
  { id: 'entries',   label: 'Entries',   icon: DollarSign  },
  { id: 'reports',   label: 'Reports',   icon: BarChart3   },
  { id: 'settings',  label: 'Settings',  icon: Settings    },
];

export default function PayrollPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab]     = useState<Tab>('overview');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [viewId, setViewId]           = useState<number | null>(null);

  // Filters
  const [fDriver, setFDriver]         = useState('');
  const [fPeriod, setFPeriod]         = useState('');
  const [fStatus, setFStatus]         = useState('');
  const [fFrom, setFFrom]             = useState('');
  const [fTo, setFTo]                 = useState('');

  const { data: settings } = useQuery<PayrollSettings>({
    queryKey: ['payroll-settings'],
    queryFn: () => api.get('/payroll/settings').then(r => r.data),
  });
  const currency = settings?.currency ?? 'ZAR';

  const { data: entries = [], isLoading, isError } = useQuery<PayrollEntry[]>({
    queryKey: ['payroll-entries', fDriver, fPeriod, fStatus, fFrom, fTo],
    queryFn: () => {
      const params = new URLSearchParams();
      if (fDriver) params.set('driverId',   fDriver);
      if (fPeriod) params.set('periodType', fPeriod);
      if (fStatus) params.set('status',     fStatus);
      if (fFrom)   params.set('from',       fFrom);
      if (fTo)     params.set('to',         fTo);
      return api.get(`/payroll?${params}`).then(r => r.data);
    },
  });

  const { data: driversRaw = [] } = useQuery({
    queryKey: ['drivers-select'],
    queryFn: () => api.get('/drivers').then(r => normalizeList(r.data)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/payroll/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-entries'] }),
  });

  const fm = (n: number) => fmtMoney(n, currency);

  return (
    <div className="space-y-5">
      {/* page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
        <button onClick={() => setGenerateOpen(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus size={16}/> Generate Payroll
        </button>
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 border-b-2 transition-colors ${
              activeTab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={15}/>{t.label}
          </button>
        ))}
      </div>

      {/* loading / error */}
      {isLoading && <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-brand-600"/></div>}
      {isError   && <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={18}/> Failed to load payroll data.</div>}

      {!isLoading && !isError && (
        <>
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <StatsRow entries={entries}/>
              {/* outstanding alert */}
              {entries.filter(e => e.status === 'OUTSTANDING').length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-sm font-semibold text-red-700">Outstanding Salaries</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      {entries.filter(e => e.status === 'OUTSTANDING').length} entries are outstanding and awaiting payment.
                      Total: {fm(entries.filter(e => e.status === 'OUTSTANDING').reduce((s, e) => s + Number(e.netPay), 0))}
                    </p>
                    <button onClick={() => { setFStatus('OUTSTANDING'); setActiveTab('entries'); }}
                      className="mt-2 text-xs text-red-700 font-medium hover:underline">
                      View outstanding entries →
                    </button>
                  </div>
                </div>
              )}
              {/* recent entries */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">Recent Payroll Entries</h2>
                  <button onClick={() => setActiveTab('entries')} className="text-xs text-brand-600 hover:underline">View all →</button>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Driver</th>
                      <th className="px-4 py-3 text-left">Period</th>
                      <th className="px-4 py-3 text-right">Trips</th>
                      <th className="px-4 py-3 text-right">Net Pay</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entries.slice(0, 8).map(e => (
                      <tr key={e.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewId(e.id)}>
                        <td className="px-4 py-3 font-medium">{e.driver.name}</td>
                        <td className="px-4 py-3 text-gray-500">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium mr-1 ${e.periodType === 'WEEKLY' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                            {e.periodType === 'WEEKLY' ? 'W' : 'M'}
                          </span>
                          {fmtDate(e.periodStart)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{e.tripCount}</td>
                        <td className="px-4 py-3 text-right font-semibold text-brand-700">{fm(Number(e.netPay))}</td>
                        <td className="px-4 py-3"><Badge label={e.status} variant={statusVariant(e.status)}/></td>
                      </tr>
                    ))}
                    {entries.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No payroll entries yet. Generate one above.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ENTRIES */}
          {activeTab === 'entries' && (
            <div className="space-y-4">
              {/* filters */}
              <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Driver</label>
                  <select value={fDriver} onChange={e => setFDriver(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">All Drivers</option>
                    {driversRaw.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Period</label>
                  <select value={fPeriod} onChange={e => setFPeriod(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">All</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={fStatus} onChange={e => setFStatus(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                    <option value="">All</option>
                    <option value="DRAFT">Draft</option>
                    <option value="APPROVED">Approved</option>
                    <option value="PAID">Paid</option>
                    <option value="OUTSTANDING">Outstanding</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                  <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                  <input type="date" value={fTo} onChange={e => setFTo(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
                </div>
                <button onClick={() => { setFDriver(''); setFPeriod(''); setFStatus(''); setFFrom(''); setFTo(''); }}
                  className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
              </div>

              {/* table */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Driver</th>
                        <th className="px-4 py-3 text-left">Period</th>
                        <th className="px-4 py-3 text-right">Trips</th>
                        <th className="px-4 py-3 text-right">Base</th>
                        <th className="px-4 py-3 text-right">Trip Pay</th>
                        <th className="px-4 py-3 text-right">Comm</th>
                        <th className="px-4 py-3 text-right">Net Pay</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {entries.length === 0 ? (
                        <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No entries match your filters.</td></tr>
                      ) : entries.map(e => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{e.driver.name}</td>
                          <td className="px-4 py-3 text-gray-500">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium mr-1 ${e.periodType === 'WEEKLY' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                              {e.periodType[0]}
                            </span>
                            {fmtDate(e.periodStart)} – {fmtDate(e.periodEnd)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">{e.tripCount}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{fm(Number(e.baseSalary))}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{fm(Number(e.tripEarnings))}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{fm(Number(e.commissions))}</td>
                          <td className="px-4 py-3 text-right font-bold text-brand-700">{fm(Number(e.netPay))}</td>
                          <td className="px-4 py-3"><Badge label={e.status} variant={statusVariant(e.status)}/></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setViewId(e.id)} className="p-1.5 text-gray-400 hover:text-brand-600" title="View"><Eye size={15}/></button>
                              {e.status === 'DRAFT' && (
                                <button onClick={() => { if (confirm('Delete this draft entry?')) deleteMut.mutate(e.id); }}
                                  className="p-1.5 text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={15}/></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* REPORTS */}
          {activeTab === 'reports' && <ReportsTab currency={currency}/>}

          {/* SETTINGS */}
          {activeTab === 'settings' && <SettingsTab/>}
        </>
      )}

      {/* modals */}
      <GenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['payroll-entries'] })}
      />
      <EntryDetailModal
        entryId={viewId}
        open={viewId !== null}
        onClose={() => setViewId(null)}
        currency={currency}
      />
    </div>
  );
}
