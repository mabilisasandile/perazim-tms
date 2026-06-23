import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2, AlertCircle, Eye, Trash2, CheckCircle2, Clock, XCircle, TruckIcon, QrCode, ShieldCheck, ShieldAlert, Send, KeyRound, AlertTriangle, Navigation } from 'lucide-react';
import PlacesAutocompleteInput from '../../components/maps/PlacesAutocompleteInput';

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(h)));
}
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import QRCodeModal from '../../components/ui/QRCodeModal';
import { format } from 'date-fns';
import { useAuthStore } from '../../stores/authStore';

interface Trip {
  id: number;
  trackingCode: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  fromLocation: string;
  toLocation: string;
  startDate: string;
  endDate: string | null;
  totalAmount: number | null;
  vehicleCondition: 'Runner' | 'Non-Runner' | null;
  customerVehicleMake: string | null;
  customerVehicleColour: string | null;
  customerVehicleRegistration: string | null;
  customerVehicleVin: string | null;
  customerVehicleEngine: string | null;
  customerVehicleStock: string | null;
  customer: { id: number; name: string };
  vehicle: { id: number; name: string; registrationNo: string };
  driver: { id: number; name: string };
  trailer: { id: number; registrationNo: string } | null;
}

interface SelectOption { id: number; name: string; email?: string; phone?: string; address?: string; companyName?: string; contactPerson?: string; }
interface VehicleOption { id: number; name: string; registrationNo: string; }
interface DriverOption { id: number; name: string; assignedVehicle?: { name: string } | null; }
interface QuotationOption {
  id: number;
  number: string | null;
  status: string;
  pickup: string;
  dropoff: string;
  pickupDate: string | null;
  dropoffDate: string | null;
  items: { description: string; colour: string | null; registration: string | null; total: number }[];
}

const schema = z.object({
  customerId:   z.coerce.number().int().positive('Customer is required'),
  vehicleId:    z.coerce.number().int().positive('Vehicle is required'),
  driverId:     z.coerce.number().int().positive('Driver is required'),
  trailerId:    z.preprocess(v => (!v || v === '' || Number(v) === 0) ? null : Number(v), z.number().int().positive().optional().nullable()),
  fromLocation: z.string().min(1, 'From location is required'),
  toLocation:   z.string().min(1, 'To location is required'),
  startDate:    z.string().min(1, 'Start date is required'),
  endDate:      z.string().optional(),
  amount:       z.coerce.number().min(0).optional(),
  customerVehicleMake:         z.string().optional(),
  customerVehicleColour:       z.string().optional(),
  customerVehicleRegistration: z.string().optional(),
  customerVehicleVin:          z.string().optional(),
  vehicleCondition:            z.enum(['Runner', 'Non-Runner']).optional().nullable(),
});
type FormData = z.infer<typeof schema>;

const statusMeta: Record<string, { label: string; variant: 'yellow'|'blue'|'green'|'red'; icon: React.ElementType }> = {
  PENDING:     { label: 'Pending',     variant: 'yellow', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', variant: 'blue',   icon: TruckIcon },
  COMPLETED:   { label: 'Completed',   variant: 'green',  icon: CheckCircle2 },
  CANCELLED:   { label: 'Cancelled',   variant: 'red',    icon: XCircle },
};

export default function TripsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewTrip, setViewTrip] = useState<Trip | null>(null);
  const [qrTrip, setQrTrip] = useState<Trip | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [statusErr,    setStatusErr]    = useState('');

  // OTP state for view modal
  type OtpInfo = { status: string; sentTo?: string; expiresAt?: string; attempts?: number; verifiedAt?: string; bypassReason?: string };
  const [otpInfo,      setOtpInfo]      = useState<OtpInfo | null>(null);
  const [otpCode,      setOtpCode]      = useState('');
  const [otpSendErr,   setOtpSendErr]   = useState('');
  const [otpVerifyErr, setOtpVerifyErr] = useState('');
  const [otpBypassErr, setOtpBypassErr] = useState('');
  const [bypassReason, setBypassReason] = useState('');
  const [showBypass,   setShowBypass]   = useState(false);

  const { hasRole } = useAuthStore();
  const isAdmin = hasRole('ADMIN', 'SUPER_ADMIN');

  const { data: trips = [], isLoading, isError } = useQuery<Trip[]>({
    queryKey: ['trips', statusFilter],
    queryFn: () => api.get('/trips', { params: statusFilter ? { status: statusFilter } : {} }).then(r => r.data),
  });

  const { data: customers = [] } = useQuery<SelectOption[]>({
    queryKey: ['customers-select'],
    queryFn: () => api.get('/customers').then(r => r.data.map((c: any) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      companyName: c.companyName,
      contactPerson: c.contactPerson,
    }))),
  });
  const { data: vehicles = [] } = useQuery<VehicleOption[]>({
    queryKey: ['vehicles-select'],
    queryFn: () => api.get('/vehicles').then(r => r.data.filter((v: any) => v.isActive)),
  });
  const { data: drivers = [] } = useQuery<DriverOption[]>({
    queryKey: ['drivers-select'],
    queryFn: () => api.get('/drivers').then(r => r.data.filter((d: any) => d.isActive)),
  });
  const { data: trailers = [] } = useQuery<SelectOption[]>({
    queryKey: ['trailers-select'],
    queryFn: () => api.get('/trailers').then(r => r.data.filter((t: any) => t.isActive).map((t: any) => ({ id: t.id, name: t.registrationNo }))),
  });

  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(null);
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [toCoords,   setToCoords]   = useState<{ lat: number; lng: number } | null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const watchedCustomerId  = watch('customerId');
  const fromLocationValue  = watch('fromLocation') ?? '';
  const toLocationValue    = watch('toLocation')   ?? '';

  const estimatedDistance = fromCoords && toCoords ? haversineKm(fromCoords, toCoords) : null;
  const selectedCustomer = customers.find(c => c.id === Number(watchedCustomerId));

  const { data: customerQuotations = [], isFetching: quotationsFetching } = useQuery<QuotationOption[]>({
    queryKey: ['customer-quotations', watchedCustomerId],
    queryFn: () => api.get('/quotations', { params: { customerId: watchedCustomerId } })
      .then(r => r.data.filter((q: any) => !q.isConverted && q.status !== 'DECLINED' && q.status !== 'CONVERTED')),
    enabled: !!watchedCustomerId && Number(watchedCustomerId) > 0,
  });

  const selectedQuotation = customerQuotations.find(q => q.id === selectedQuotationId) ?? null;

  // Reset coords when quotation pre-fills the location fields
  useEffect(() => {
    setFromCoords(null);
    setToCoords(null);
  }, [selectedQuotationId]);

  // When customer changes: clear auto-filled fields and reset quotation selection
  useEffect(() => {
    setSelectedQuotationId(null);
    setValue('fromLocation', selectedCustomer?.address ?? '');
    setValue('toLocation', '');
    setValue('startDate', '');
    setValue('endDate', '');
    setValue('amount', undefined);
    setValue('customerVehicleMake', '');
    setValue('customerVehicleColour', '');
    setValue('customerVehicleRegistration', '');
    setValue('vehicleCondition', null);
  }, [watchedCustomerId]);

  // Auto-select the best quotation once the list loads
  useEffect(() => {
    if (!customerQuotations.length) { setSelectedQuotationId(null); return; }
    const best =
      customerQuotations.find(q => q.status === 'ACCEPTED') ??
      customerQuotations.find(q => q.status === 'SENT') ??
      customerQuotations[0];
    setSelectedQuotationId(best?.id ?? null);
  }, [customerQuotations]);

  // Populate trip form from the selected quotation
  useEffect(() => {
    if (!selectedQuotation) {
      // Fall back to customer address when quotation is deselected
      setValue('fromLocation', selectedCustomer?.address ?? '');
      setValue('toLocation', '');
      setValue('startDate', '');
      setValue('endDate', '');
      setValue('amount', undefined);
      setValue('customerVehicleMake', '');
      setValue('customerVehicleColour', '');
      setValue('customerVehicleRegistration', '');
      setValue('vehicleCondition', null);
      return;
    }
    setValue('fromLocation', selectedQuotation.pickup);
    setValue('toLocation', selectedQuotation.dropoff);
    if (selectedQuotation.pickupDate)  setValue('startDate', selectedQuotation.pickupDate.split('T')[0]);
    if (selectedQuotation.dropoffDate) setValue('endDate',   selectedQuotation.dropoffDate.split('T')[0]);
    const subtotal = selectedQuotation.items.reduce((s, i) => s + Number(i.total), 0);
    if (subtotal > 0) setValue('amount', subtotal);
    const first = selectedQuotation.items[0];
    if (first) {
      setValue('customerVehicleMake',         first.description ?? '');
      setValue('customerVehicleColour',       first.colour ?? '');
      setValue('customerVehicleRegistration', first.registration ?? '');
    }
  }, [selectedQuotationId]);

  const createMut = useMutation({
    mutationFn: (d: FormData) => api.post('/trips', {
      ...d,
      trailerId: d.trailerId || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); setModalOpen(false); reset(); setSelectedQuotationId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/trips/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.patch(`/trips/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); setStatusErr(''); },
    onError: (e: any) => setStatusErr(e.response?.data?.error || 'Failed to update status'),
  });

  const otpSendMut = useMutation({
    mutationFn: (tripId: number) => api.post('/otp/send', { tripId }),
    onSuccess: (res) => {
      setOtpSendErr('');
      setOtpInfo({ status: 'pending', sentTo: res.data.sentTo, expiresAt: res.data.expiresAt, attempts: 0 });
    },
    onError: (e: any) => setOtpSendErr(e.response?.data?.error || 'Failed to send OTP'),
  });

  const otpVerifyMut = useMutation({
    mutationFn: ({ tripId, code }: { tripId: number; code: string }) => api.post('/otp/verify', { tripId, code }),
    onSuccess: () => {
      setOtpVerifyErr('');
      setOtpInfo({ status: 'verified', verifiedAt: new Date().toISOString() });
    },
    onError: (e: any) => setOtpVerifyErr(e.response?.data?.error || 'Verification failed'),
  });

  const otpBypassMut = useMutation({
    mutationFn: ({ tripId, reason }: { tripId: number; reason: string }) => api.post('/otp/bypass', { tripId, reason }),
    onSuccess: () => {
      setOtpBypassErr('');
      setOtpInfo({ status: 'bypassed', bypassReason });
      setShowBypass(false);
    },
    onError: (e: any) => setOtpBypassErr(e.response?.data?.error || 'Bypass failed'),
  });

  const openViewTrip = async (t: Trip) => {
    setViewTrip(t);
    setOtpInfo(null); setOtpCode(''); setOtpSendErr(''); setOtpVerifyErr(''); setOtpBypassErr(''); setBypassReason(''); setShowBypass(false); setStatusErr('');
    try {
      const res = await api.get(`/otp/status/${t.id}`);
      setOtpInfo(res.data);
    } catch { setOtpInfo({ status: 'none' }); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);

  if (isLoading) return <div className="flex flex-col items-center justify-center h-64 gap-3"><Loader2 className="animate-spin text-brand-600" size={32} /><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>;
  if (isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20} /><span>Failed to load trips.</span></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Trips</h1>
        <button onClick={() => { reset(); setSelectedQuotationId(null); setFromCoords(null); setToCoords(null); setModalOpen(true); }} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> New Trip
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600 hover:border-brand-500'}`}
          >
            {s === '' ? 'All' : statusMeta[s]?.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Tracking</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Route</th>
                <th className="px-4 py-3 text-left">Vehicle</th>
                <th className="px-4 py-3 text-left">Driver</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trips.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No trips found.</td></tr>
              ) : trips.map(t => {
                const sm = statusMeta[t.status];
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.trackingCode.slice(0, 8)}…</td>
                    <td className="px-4 py-3 font-medium">{t.customer.name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px]">
                      <span className="truncate block">{t.fromLocation} → {t.toLocation}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t.vehicle.registrationNo}</td>
                    <td className="px-4 py-3 text-gray-500">{t.driver.name}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(t.startDate), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3 text-gray-700">{t.totalAmount ? fmt(Number(t.totalAmount)) : '—'}</td>
                    <td className="px-4 py-3"><Badge label={sm.label} variant={sm.variant} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setQrTrip(t)} className="p-1.5 text-gray-400 hover:text-brand-600" title="View QR Code"><QrCode size={15} /></button>
                        <button onClick={() => openViewTrip(t)} className="p-1.5 text-gray-400 hover:text-brand-600"><Eye size={15} /></button>
                        {t.status === 'PENDING' && (
                          <button onClick={() => statusMut.mutate({ id: t.id, status: 'IN_PROGRESS' })} className="p-1.5 text-gray-400 hover:text-blue-600" title="Start trip"><TruckIcon size={15} /></button>
                        )}
                        {t.status === 'IN_PROGRESS' && (
                          <button onClick={() => openViewTrip(t)} className="p-1.5 text-gray-400 hover:text-green-600" title="Complete trip (OTP required)"><CheckCircle2 size={15} /></button>
                        )}
                        <button onClick={() => { if (confirm('Delete this trip?')) deleteMut.mutate(t.id); }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Trip Modal */}
      <Modal title="New Trip" open={modalOpen} onClose={() => setModalOpen(false)} width="max-w-2xl">
        <form onSubmit={handleSubmit(d => createMut.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <select {...register('customerId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.companyName ? ` — ${c.companyName}` : ''}</option>)}
              </select>
              {errors.customerId && <p className="text-red-500 text-xs mt-1">{errors.customerId.message}</p>}
              {selectedCustomer && (
                <div className="mt-2 grid grid-cols-3 gap-2 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 text-xs text-gray-600">
                  {selectedCustomer.companyName && <span><span className="font-medium text-gray-500">Company:</span> {selectedCustomer.companyName}</span>}
                  {selectedCustomer.contactPerson && <span><span className="font-medium text-gray-500">Contact:</span> {selectedCustomer.contactPerson}</span>}
                  {selectedCustomer.email && <span><span className="font-medium text-gray-500">Email:</span> {selectedCustomer.email}</span>}
                  {selectedCustomer.phone && <span><span className="font-medium text-gray-500">Phone:</span> {selectedCustomer.phone}</span>}
                  {selectedCustomer.address && <span className="col-span-2"><span className="font-medium text-gray-500">Address:</span> {selectedCustomer.address}</span>}
                </div>
              )}
            </div>
            {/* Quotation selector */}
            {Number(watchedCustomerId) > 0 && (quotationsFetching || customerQuotations.length > 0) && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Pre-fill from Quotation</label>
                {quotationsFetching ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                    <Loader2 size={13} className="animate-spin" /> Loading quotations…
                  </div>
                ) : (
                  <select
                    value={selectedQuotationId ?? ''}
                    onChange={e => setSelectedQuotationId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="">— Fresh trip (no quotation) —</option>
                    {customerQuotations.map(q => (
                      <option key={q.id} value={q.id}>
                        {q.number ?? `Q-${q.id}`} · {q.pickup} → {q.dropoff} [{q.status}]
                      </option>
                    ))}
                  </select>
                )}
                {selectedQuotation && (
                  <p className="text-xs text-brand-600 mt-1">
                    Fields pre-filled from <strong>{selectedQuotation.number}</strong>. You can override any value below.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle *</label>
              <select {...register('vehicleId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select vehicle</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registrationNo})</option>)}
              </select>
              {errors.vehicleId && <p className="text-red-500 text-xs mt-1">{errors.vehicleId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver *</label>
              <select {...register('driverId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select driver</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {errors.driverId && <p className="text-red-500 text-xs mt-1">{errors.driverId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trailer</label>
              <select {...register('trailerId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">No trailer</option>
                {trailers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Location *</label>
              <PlacesAutocompleteInput
                value={fromLocationValue}
                onChange={val => { setValue('fromLocation', val, { shouldValidate: true }); setFromCoords(null); }}
                onPlaceSelect={(name, lat, lng) => { setValue('fromLocation', name, { shouldValidate: true }); setFromCoords({ lat, lng }); }}
                placeholder="e.g. Johannesburg"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {errors.fromLocation && <p className="text-red-500 text-xs mt-1">{errors.fromLocation.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Location *</label>
              <PlacesAutocompleteInput
                value={toLocationValue}
                onChange={val => { setValue('toLocation', val, { shouldValidate: true }); setToCoords(null); }}
                onPlaceSelect={(name, lat, lng) => { setValue('toLocation', name, { shouldValidate: true }); setToCoords({ lat, lng }); }}
                placeholder="e.g. Cape Town"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {errors.toLocation && <p className="text-red-500 text-xs mt-1">{errors.toLocation.message}</p>}
            </div>
            {estimatedDistance !== null && (
              <div className="col-span-2 flex items-center gap-1.5 text-xs text-brand-600 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
                <Navigation size={12} /> Estimated distance: <strong>~{estimatedDistance} km</strong>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input type="date" {...register('startDate')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" {...register('endDate')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trip Amount (excl. VAT)</label>
              <input type="number" step="0.01" {...register('amount')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="0.00" />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Customer's Vehicle (being transported)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Make/Model</label>
                <input {...register('customerVehicleMake')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Toyota Hilux" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Colour</label>
                <input {...register('customerVehicleColour')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. White" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Registration</label>
                <input {...register('customerVehicleRegistration')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">VIN Number</label>
                <input {...register('customerVehicleVin')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Vehicle Condition</label>
                <select {...register('vehicleCondition')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="">Select condition</option>
                  <option value="Runner">Runner</option>
                  <option value="Non-Runner">Non-Runner</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={isSubmitting || createMut.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {createMut.isPending ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </form>
      </Modal>

      {/* QR Code Modal */}
      {qrTrip && <QRCodeModal trip={qrTrip} onClose={() => setQrTrip(null)} />}

      {/* View Trip Modal */}
      {viewTrip && (
        <Modal title={`Trip #${viewTrip.id}`} open={!!viewTrip} onClose={() => setViewTrip(null)} width="max-w-xl">
          <div className="space-y-5 text-sm max-h-[80vh] overflow-y-auto pr-1">
            {/* Trip details */}
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-gray-500">Tracking Code</p><p className="font-mono font-medium">{viewTrip.trackingCode}</p></div>
              <div><p className="text-gray-500">Status</p><Badge label={statusMeta[viewTrip.status].label} variant={statusMeta[viewTrip.status].variant} /></div>
              <div><p className="text-gray-500">Customer</p><p className="font-medium">{viewTrip.customer.name}</p></div>
              <div><p className="text-gray-500">Vehicle</p><p className="font-medium">{viewTrip.vehicle.name} ({viewTrip.vehicle.registrationNo})</p></div>
              <div><p className="text-gray-500">Driver</p><p className="font-medium">{viewTrip.driver.name}</p></div>
              <div><p className="text-gray-500">Trailer</p><p className="font-medium">{viewTrip.trailer?.registrationNo ?? '—'}</p></div>
              <div className="col-span-2"><p className="text-gray-500">Route</p><p className="font-medium">{viewTrip.fromLocation} → {viewTrip.toLocation}</p></div>
              <div><p className="text-gray-500">Start Date</p><p className="font-medium">{format(new Date(viewTrip.startDate), 'dd MMM yyyy')}</p></div>
              <div><p className="text-gray-500">End Date</p><p className="font-medium">{viewTrip.endDate ? format(new Date(viewTrip.endDate), 'dd MMM yyyy') : '—'}</p></div>
              <div><p className="text-gray-500">Total Amount</p><p className="font-medium text-lg">{viewTrip.totalAmount ? new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(viewTrip.totalAmount)) : '—'}</p></div>
              <div>
                <p className="text-gray-500">Vehicle Condition</p>
                <p className={`font-medium ${viewTrip.vehicleCondition === 'Non-Runner' ? 'text-red-600' : viewTrip.vehicleCondition === 'Runner' ? 'text-green-600' : 'text-gray-400'}`}>
                  {viewTrip.vehicleCondition ?? '—'}
                </p>
              </div>
            </div>

            {/* ── OTP Delivery Verification ─────────────────────────── */}
            {viewTrip.status !== 'CANCELLED' && viewTrip.status !== 'PENDING' && (
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-brand-600" /> OTP Delivery Verification
                </p>

                {/* Status banner */}
                {otpInfo?.status === 'verified' && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs font-medium">
                    <ShieldCheck size={15} className="text-green-600 shrink-0" />
                    OTP Verified — {otpInfo.verifiedAt ? format(new Date(otpInfo.verifiedAt), 'dd MMM yyyy HH:mm') : ''}
                  </div>
                )}
                {otpInfo?.status === 'bypassed' && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium">
                    <ShieldAlert size={15} className="text-amber-600 shrink-0" />
                    Admin Bypass Approved — <em>{otpInfo.bypassReason}</em>
                  </div>
                )}
                {(!otpInfo || otpInfo.status === 'none' || otpInfo.status === 'expired') && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 text-xs">
                    <ShieldCheck size={14} className="shrink-0" />
                    {otpInfo?.status === 'expired' ? 'OTP expired — resend to continue.' : 'No OTP sent yet.'}
                  </div>
                )}
                {otpInfo?.status === 'pending' && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-xs">
                    <ShieldCheck size={14} className="shrink-0" />
                    OTP sent to <strong>{otpInfo.sentTo}</strong> — expires {otpInfo.expiresAt ? format(new Date(otpInfo.expiresAt), 'HH:mm') : ''}
                  </div>
                )}

                {/* Send / Resend OTP */}
                {otpInfo?.status !== 'verified' && otpInfo?.status !== 'bypassed' && (
                  <div className="space-y-2">
                    {otpSendErr && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12} /> {otpSendErr}</p>}
                    <button
                      type="button"
                      onClick={() => { setOtpSendErr(''); otpSendMut.mutate(viewTrip.id); }}
                      disabled={otpSendMut.isPending}
                      className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg disabled:opacity-60"
                    >
                      {otpSendMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      {otpInfo?.status === 'pending' ? 'Resend OTP' : 'Send OTP to Customer'}
                    </button>
                  </div>
                )}

                {/* Verify input */}
                {otpInfo?.status === 'pending' && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600">Enter the 6-digit code provided by the customer:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpVerifyErr(''); }}
                        placeholder="——————"
                        className="flex-1 border rounded-lg px-3 py-2 text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <button
                        type="button"
                        onClick={() => otpVerifyMut.mutate({ tripId: viewTrip.id, code: otpCode })}
                        disabled={otpCode.length !== 6 || otpVerifyMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                      >
                        {otpVerifyMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                        Verify
                      </button>
                    </div>
                    {otpVerifyErr && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12} /> {otpVerifyErr}</p>}
                  </div>
                )}

                {/* Admin bypass */}
                {isAdmin && otpInfo?.status !== 'verified' && otpInfo?.status !== 'bypassed' && (
                  <div className="border border-dashed border-amber-300 rounded-xl p-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowBypass(v => !v)}
                      className="flex items-center gap-1.5 text-xs text-amber-700 font-medium hover:text-amber-900"
                    >
                      <ShieldAlert size={13} /> Administrator Bypass {showBypass ? '▲' : '▼'}
                    </button>
                    {showBypass && (
                      <div className="space-y-2">
                        <textarea
                          value={bypassReason}
                          onChange={e => { setBypassReason(e.target.value); setOtpBypassErr(''); }}
                          rows={2}
                          placeholder="Reason for bypassing OTP verification…"
                          className="w-full border border-amber-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                        />
                        {otpBypassErr && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12} /> {otpBypassErr}</p>}
                        <button
                          type="button"
                          onClick={() => otpBypassMut.mutate({ tripId: viewTrip.id, reason: bypassReason })}
                          disabled={bypassReason.trim().length < 5 || otpBypassMut.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                        >
                          {otpBypassMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
                          Approve Bypass
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Complete trip button (only IN_PROGRESS + OTP authorised) */}
                {viewTrip.status === 'IN_PROGRESS' && (otpInfo?.status === 'verified' || otpInfo?.status === 'bypassed') && (
                  <div className="pt-1 space-y-2">
                    {statusErr && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12} /> {statusErr}</p>}
                    <button
                      type="button"
                      onClick={() => statusMut.mutate({ id: viewTrip.id, status: 'COMPLETED' })}
                      disabled={statusMut.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-60"
                    >
                      {statusMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Mark Trip Completed
                    </button>
                  </div>
                )}
                {viewTrip.status === 'IN_PROGRESS' && otpInfo && otpInfo.status !== 'verified' && otpInfo.status !== 'bypassed' && (
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <AlertTriangle size={12} /> Complete OTP verification above before marking this trip as completed.
                  </p>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
