import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState, useRef, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import axios from 'axios';
import {
  ScanLine, LogIn, LogOut, ShieldCheck, Loader2,
  User, Truck, AlertCircle, CheckCircle2,
  BarChart3, List, MapPin, Search, X, Building2,
} from 'lucide-react';
import Badge from '../../components/ui/Badge';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TripLookup {
  id: number; trackingCode: string; status: string;
  fromLocation: string; toLocation: string; startDate: string;
  customerVehicleRegistration: string | null;
  customerVehicleMake: string | null; customerVehicleColour: string | null;
  customerVehicleVin: string | null; customerVehicleEngine: string | null;
  customerVehicleStock: string | null; vehicleCondition: string | null;
  customer: { name: string; phone: string | null };
  vehicle:  { name: string; registrationNo: string };
  driver:   { name: string; mobile: string };
}

interface GateScan {
  id: number; scanType: 'ENTRY' | 'EXIT';
  trackingCode: string; scannedAt: string;
  driverName: string | null; driverLicense: string | null; driverPhone: string | null;
  towTruckReg: string | null; towTruckDriver: string | null;
  officerName: string | null; isApproved: boolean;
  gateName: string | null; notes: string | null;
  trip: TripLookup | null;
}

interface Stats {
  total: number; todayEntries: number; todayExits: number; onPremises: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCode(raw: string): string {
  // Accept full tracking URL or bare code
  const match = raw.match(/\/track\/([a-z0-9]+)/i);
  return match ? match[1] : raw.trim();
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color = 'blue' }: {
  icon: React.ElementType; label: string; value: number; color?: string;
}) {
  const bg: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    red:    'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };
  return (
    <div className="bg-white rounded-xl border p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${bg[color]}`}><Icon size={18} /></div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'scanner' | 'log' | 'premises';
type ScanType = 'ENTRY' | 'EXIT';

export default function GateScansPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('scanner');

  // Scanner state
  const [rawInput, setRawInput]       = useState('');
  const [lookupCode, setLookupCode]   = useState('');
  const [scanType, setScanType]       = useState<ScanType>('ENTRY');
  const [trip, setTrip]               = useState<TripLookup | null>(null);
  const [priorScans, setPriorScans]   = useState<GateScan[]>([]);
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Entry form fields
  const [driverName,    setDriverName]    = useState('');
  const [driverLicense, setDriverLicense] = useState('');
  const [driverPhone,   setDriverPhone]   = useState('');
  const [towTruckReg,   setTowTruckReg]   = useState('');
  const [towTruckDriver, setTowTruckDriver] = useState('');
  // Exit form fields
  const [officerName,   setOfficerName]   = useState('');
  const [isApproved,    setIsApproved]    = useState(false);
  // Common
  const [gateName,      setGateName]      = useState('');
  const [notes,         setNotes]         = useState('');

  // Log filters
  const [logScanType, setLogScanType] = useState('');
  const [logFrom,     setLogFrom]     = useState('');
  const [logTo,       setLogTo]       = useState('');

  // Auto-focus input on scanner tab
  useEffect(() => {
    if (tab === 'scanner') inputRef.current?.focus();
  }, [tab]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: stats } = useQuery<Stats>({
    queryKey: ['gate-stats'],
    queryFn: () => api.get('/gate-scans/stats').then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: scans = [], isLoading: scansLoading } = useQuery<GateScan[]>({
    queryKey: ['gate-scans', logScanType, logFrom, logTo],
    queryFn: () => api.get('/gate-scans', {
      params: {
        scanType: logScanType || undefined,
        from:     logFrom     || undefined,
        to:       logTo       || undefined,
      },
    }).then(r => r.data),
    enabled: tab === 'log',
  });

  const { data: onPremises = [], isLoading: premisesLoading } = useQuery<GateScan[]>({
    queryKey: ['gate-on-premises'],
    queryFn: () => api.get('/gate-scans/on-premises').then(r => r.data),
    enabled: tab === 'premises',
    refetchInterval: 60000,
  });

  // ── Lookup ─────────────────────────────────────────────────────────────────

  const doLookup = async () => {
    const code = extractCode(rawInput);
    if (!code) return;
    setLookupLoading(true);
    setLookupError('');
    setTrip(null);
    setPriorScans([]);
    try {
      const [tripRes, scanRes] = await Promise.all([
        axios.get(`/api/v1/trips/track/${code}`),
        api.get(`/gate-scans/by-code/${code}`),
      ]);
      setTrip(tripRes.data);
      setPriorScans(scanRes.data);
      setLookupCode(code);

      // Auto-detect suggested scan type from prior scans
      const latest = (scanRes.data as GateScan[])[0];
      setScanType(latest?.scanType === 'ENTRY' ? 'EXIT' : 'ENTRY');

      // Pre-fill tow truck from prior entry if switching to EXIT
      if (latest?.scanType === 'ENTRY') {
        setTowTruckReg(latest.towTruckReg ?? '');
        setTowTruckDriver(latest.towTruckDriver ?? '');
      }
    } catch {
      setLookupError('Booking not found. Check the tracking code or QR code.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doLookup();
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const submitMut = useMutation({
    mutationFn: (payload: object) => api.post('/gate-scans', payload),
    onSuccess: (res) => {
      const label = res.data.scanType === 'ENTRY' ? 'Entry' : 'Exit';
      setSubmitSuccess(`${label} recorded successfully at ${format(new Date(), 'HH:mm:ss')}`);
      // Reset scanner for next scan
      setRawInput(''); setLookupCode(''); setTrip(null); setPriorScans([]);
      setDriverName(''); setDriverLicense(''); setDriverPhone('');
      setTowTruckReg(''); setTowTruckDriver('');
      setOfficerName(''); setIsApproved(false); setNotes('');
      inputRef.current?.focus();
      qc.invalidateQueries({ queryKey: ['gate-stats'] });
      qc.invalidateQueries({ queryKey: ['gate-scans'] });
      qc.invalidateQueries({ queryKey: ['gate-on-premises'] });
      setTimeout(() => setSubmitSuccess(''), 4000);
    },
  });

  const handleSubmit = () => {
    if (!trip) return;
    submitMut.mutate({
      scanType, trackingCode: lookupCode, tripId: trip.id,
      driverName:    driverName    || undefined,
      driverLicense: driverLicense || undefined,
      driverPhone:   driverPhone   || undefined,
      towTruckReg:   towTruckReg   || undefined,
      towTruckDriver: towTruckDriver || undefined,
      officerName:   officerName   || undefined,
      isApproved,
      gateName:      gateName      || undefined,
      notes:         notes         || undefined,
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'scanner'  as Tab, label: 'Gate Scanner',   icon: ScanLine },
    { id: 'log'      as Tab, label: 'Scan Log',        icon: List },
    { id: 'premises' as Tab, label: 'On Premises',     icon: Building2 },
  ];

  const latestEntry = priorScans.find(s => s.scanType === 'ENTRY');

  return (
    <div className="space-y-6">
      {/* Header + stats */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Security Gate Scanning</h1>
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={BarChart3}   label="Total Scans"    value={stats.total}        color="blue" />
            <StatCard icon={LogIn}       label="Today Entries"  value={stats.todayEntries} color="green" />
            <StatCard icon={LogOut}      label="Today Exits"    value={stats.todayExits}   color="yellow" />
            <StatCard icon={Building2}   label="On Premises"    value={stats.onPremises}   color="red" />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === id ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ── SCANNER TAB ──────────────────────────────────────────── */}
      {tab === 'scanner' && (
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Success banner */}
          {submitSuccess && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3">
              <CheckCircle2 size={18} className="shrink-0" />
              <span className="text-sm font-medium">{submitSuccess}</span>
            </div>
          )}

          {/* QR / Code input */}
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 text-gray-700">
              <ScanLine size={18} className="text-brand-600" />
              <h2 className="font-semibold">Scan QR Code or Enter Tracking Code</h2>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  value={rawInput}
                  onChange={e => setRawInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Scan QR or paste tracking URL / code…"
                  className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                />
                {rawInput && (
                  <button onClick={() => { setRawInput(''); setTrip(null); setPriorScans([]); setLookupError(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={doLookup}
                disabled={!rawInput.trim() || lookupLoading}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors"
              >
                {lookupLoading ? <Loader2 className="animate-spin" size={15} /> : <Search size={15} />}
                Lookup
              </button>
            </div>
            <p className="text-xs text-gray-400">USB QR scanners type the URL automatically. On mobile, use your camera app to scan, then paste the link.</p>

            {lookupError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3 text-sm">
                <AlertCircle size={15} className="shrink-0" />{lookupError}
              </div>
            )}
          </div>

          {/* Vehicle Details Card */}
          {trip && (
            <>
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                {/* Vehicle identity */}
                <div className="bg-brand-700 text-white px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-brand-200 text-xs font-medium uppercase tracking-wide mb-0.5">Customer Vehicle</p>
                      <p className="text-xl font-bold">{trip.customerVehicleRegistration ?? 'No Registration'}</p>
                      <p className="text-brand-200 text-sm">{[trip.customerVehicleMake, trip.customerVehicleColour].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-brand-200 text-xs">Booking</p>
                      <p className="font-mono text-sm">{trip.trackingCode.slice(0, 12).toUpperCase()}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-2 gap-4">
                  <div className="space-y-0">
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Vehicle</p>
                    <InfoRow label="VIN"         value={trip.customerVehicleVin} />
                    <InfoRow label="Engine No"   value={trip.customerVehicleEngine} />
                    <InfoRow label="Stock No"    value={trip.customerVehicleStock} />
                    <InfoRow label="Condition"   value={trip.vehicleCondition} />
                  </div>
                  <div className="space-y-0">
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Customer</p>
                    <InfoRow label="Name"    value={trip.customer.name} />
                    <InfoRow label="Phone"   value={trip.customer.phone} />
                    <InfoRow label="Route"   value={`${trip.fromLocation} → ${trip.toLocation}`} />
                    <InfoRow label="Status"  value={trip.status.replace('_', ' ')} />
                  </div>
                </div>

                {/* Transport vehicle row */}
                <div className="border-t px-4 py-3 bg-gray-50 flex items-center gap-4 text-sm">
                  <Truck size={14} className="text-gray-400 shrink-0" />
                  <span className="text-gray-500">Transport:</span>
                  <span className="font-medium text-gray-800">{trip.vehicle.name}</span>
                  <span className="text-gray-400">{trip.vehicle.registrationNo}</span>
                  <span className="text-gray-400 ml-auto">Driver: {trip.driver.name}</span>
                </div>

                {/* Prior scans for this vehicle */}
                {priorScans.length > 0 && (
                  <div className="border-t px-4 py-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Scan History for This Vehicle</p>
                    <div className="space-y-1.5">
                      {priorScans.slice(0, 5).map(s => (
                        <div key={s.id} className={`flex items-center gap-3 text-xs rounded-lg px-3 py-2 ${s.scanType === 'ENTRY' ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                          {s.scanType === 'ENTRY' ? <LogIn size={13} /> : <LogOut size={13} />}
                          <span className="font-semibold">{s.scanType}</span>
                          <span>{format(new Date(s.scannedAt), 'dd MMM yyyy HH:mm')}</span>
                          {s.gateName && <span className="text-gray-400">· {s.gateName}</span>}
                          {s.driverName && <span className="text-gray-400">· {s.driverName}</span>}
                          {s.isApproved && <ShieldCheck size={12} className="ml-auto text-green-600" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Scan Type Selector */}
              <div className="grid grid-cols-2 gap-3">
                {(['ENTRY', 'EXIT'] as ScanType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setScanType(t)}
                    className={`flex items-center justify-center gap-2.5 py-3.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      scanType === t
                        ? t === 'ENTRY'
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {t === 'ENTRY' ? <LogIn size={17} /> : <LogOut size={17} />}
                    {t === 'ENTRY' ? 'Vehicle Entry' : 'Vehicle Exit'}
                  </button>
                ))}
              </div>

              {/* Form fields */}
              <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
                {/* Gate name — always visible */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gate / Location</label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input value={gateName} onChange={e => setGateName(e.target.value)} placeholder="e.g. Main Gate, North Entry" className="w-full pl-9 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                </div>

                {scanType === 'ENTRY' ? (
                  <>
                    {/* Driver details section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 border-b pb-2">
                        <User size={14} className="text-brand-600" /> Driver Details
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Full Name</label>
                          <input value={driverName} onChange={e => setDriverName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Driver's name" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">License / ID Number</label>
                          <input value={driverLicense} onChange={e => setDriverLicense(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="License no." />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Phone Number</label>
                          <input value={driverPhone} onChange={e => setDriverPhone(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. 082 000 0000" />
                        </div>
                      </div>
                    </div>

                    {/* Tow truck section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 border-b pb-2">
                        <Truck size={14} className="text-brand-600" /> Tow Truck / Transport Details
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Truck Registration</label>
                          <input value={towTruckReg} onChange={e => setTowTruckReg(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase" placeholder="e.g. CA 123-456" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Truck Driver Name</label>
                          <input value={towTruckDriver} onChange={e => setTowTruckDriver(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Driver's name" />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Exit verification — show entry record */}
                    {latestEntry ? (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                        <p className="text-xs font-semibold text-green-700 uppercase">Entry Record Found</p>
                        <InfoRow label="Entered"       value={format(new Date(latestEntry.scannedAt), 'dd MMM yyyy HH:mm')} />
                        <InfoRow label="Duration"      value={formatDistanceToNow(new Date(latestEntry.scannedAt), { addSuffix: false })} />
                        <InfoRow label="Entry Driver"  value={latestEntry.driverName} />
                        <InfoRow label="Tow Truck"     value={latestEntry.towTruckReg} />
                        <InfoRow label="Entry Gate"    value={latestEntry.gateName} />
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800 flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" />
                        No entry record found for this vehicle. Proceed with caution.
                      </div>
                    )}

                    {/* Security officer */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 border-b pb-2">
                        <ShieldCheck size={14} className="text-brand-600" /> Security Approval
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Security Officer Name *</label>
                        <input value={officerName} onChange={e => setOfficerName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Officer's full name" />
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div
                          onClick={() => setIsApproved(!isApproved)}
                          className={`w-10 h-6 rounded-full transition-colors relative ${isApproved ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isApproved ? 'translate-x-5' : 'translate-x-1'}`} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {isApproved ? 'Exit approved — vehicle cleared to leave' : 'Exit not yet approved'}
                        </span>
                      </label>
                    </div>
                  </>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" placeholder="Any observations or remarks…" />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={submitMut.isPending || (scanType === 'EXIT' && !officerName)}
                  className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                    scanType === 'ENTRY'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-orange-500 hover:bg-orange-600 text-white'
                  }`}
                >
                  {submitMut.isPending ? <Loader2 className="animate-spin" size={16} /> : scanType === 'ENTRY' ? <LogIn size={16} /> : <LogOut size={16} />}
                  {scanType === 'ENTRY' ? 'Record Entry' : 'Record Exit & Approve'}
                </button>

                {submitMut.isError && (
                  <p className="text-red-500 text-sm text-center">Failed to save. Please try again.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── SCAN LOG TAB ─────────────────────────────────────────── */}
      {tab === 'log' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {(['', 'ENTRY', 'EXIT'] as const).map(t => (
              <button
                key={t}
                onClick={() => setLogScanType(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${logScanType === t ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600 hover:border-brand-500'}`}
              >
                {t === '' ? 'All' : t === 'ENTRY' ? 'Entries' : 'Exits'}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <input type="date" value={logFrom} onChange={e => setLogFrom(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <span className="text-gray-400 text-sm">to</span>
              <input type="date" value={logTo} onChange={e => setLogTo(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {(logFrom || logTo) && (
                <button onClick={() => { setLogFrom(''); setLogTo(''); }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              )}
            </div>
          </div>

          {scansLoading ? (
            <div className="flex justify-center h-40 items-center"><Loader2 className="animate-spin text-brand-600" size={28} /></div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Vehicle</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Driver at Gate</th>
                      <th className="px-4 py-3 text-left">Tow Truck</th>
                      <th className="px-4 py-3 text-left">Officer</th>
                      <th className="px-4 py-3 text-left">Gate</th>
                      <th className="px-4 py-3 text-left">Date & Time</th>
                      <th className="px-4 py-3 text-left">Approved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {scans.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No scans found.</td></tr>
                    ) : scans.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.scanType === 'ENTRY' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {s.scanType === 'ENTRY' ? <LogIn size={11} /> : <LogOut size={11} />}
                            {s.scanType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{s.trip?.customerVehicleRegistration ?? s.trackingCode.slice(0, 10)}</p>
                          <p className="text-xs text-gray-400">{s.trip?.customerVehicleMake ?? ''}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{s.trip?.customer.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700">{s.driverName ?? '—'}</p>
                          {s.driverLicense && <p className="text-xs text-gray-400">{s.driverLicense}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{s.towTruckReg ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{s.officerName ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{s.gateName ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          <p>{format(new Date(s.scannedAt), 'dd MMM yyyy')}</p>
                          <p className="text-xs text-gray-400">{format(new Date(s.scannedAt), 'HH:mm:ss')}</p>
                        </td>
                        <td className="px-4 py-3">
                          {s.scanType === 'EXIT'
                            ? s.isApproved
                              ? <Badge label="Approved" variant="green" />
                              : <Badge label="Pending"  variant="yellow" />
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ON PREMISES TAB ──────────────────────────────────────── */}
      {tab === 'premises' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              {onPremises.length} vehicle{onPremises.length !== 1 ? 's' : ''} on site
            </div>
            <p className="text-sm text-gray-500">Vehicles with an entry scan and no corresponding exit scan</p>
          </div>

          {premisesLoading ? (
            <div className="flex justify-center h-40 items-center"><Loader2 className="animate-spin text-brand-600" size={28} /></div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Vehicle</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Entered At</th>
                      <th className="px-4 py-3 text-left">Duration on Site</th>
                      <th className="px-4 py-3 text-left">Entry Driver</th>
                      <th className="px-4 py-3 text-left">Tow Truck</th>
                      <th className="px-4 py-3 text-left">Entry Gate</th>
                      <th className="px-4 py-3 text-left">Booking Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {onPremises.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No vehicles currently on premises.</td></tr>
                    ) : onPremises.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{s.trip?.customerVehicleRegistration ?? '—'}</p>
                          <p className="text-xs text-gray-400">{[s.trip?.customerVehicleMake, s.trip?.customerVehicleColour].filter(Boolean).join(' · ')}</p>
                          {s.trip?.customerVehicleVin && <p className="text-xs text-gray-400 font-mono">VIN: {s.trip.customerVehicleVin}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{s.trip?.customer.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          <p>{format(new Date(s.scannedAt), 'dd MMM yyyy')}</p>
                          <p className="text-xs text-gray-400">{format(new Date(s.scannedAt), 'HH:mm')}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${new Date().getTime() - new Date(s.scannedAt).getTime() > 86400000 * 2 ? 'text-red-600' : 'text-gray-700'}`}>
                            {formatDistanceToNow(new Date(s.scannedAt), { addSuffix: false })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{s.driverName ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{s.towTruckReg ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{s.gateName ?? '—'}</td>
                        <td className="px-4 py-3">
                          {s.trip ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                              s.trip.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                              s.trip.status === 'COMPLETED'   ? 'bg-green-100 text-green-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {s.trip.status.replace('_', ' ')}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
