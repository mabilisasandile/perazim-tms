import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState, useRef, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { format } from 'date-fns';
import {
  Plus, Loader2, Eye, Trash2, CheckCircle2, MapPin, Camera,
  Phone, Mail, CreditCard, Users, Navigation, X, ChevronRight,
  Image as ImageIcon, FileCheck, Download, User, ClipboardCheck,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PodPhoto {
  id: number; podId: number; filename: string; path: string; createdAt: string;
}

interface POD {
  id: number;
  tripId: number;
  receiverFirstName:   string;
  receiverLastName:    string;
  receiverPhone:       string;
  receiverEmail:       string | null;
  receiverIdNumber:    string | null;
  relationshipToOwner: string | null;
  signature:           string;
  gpsLatitude:         number | null;
  gpsLongitude:        number | null;
  gpsAccuracy:         number | null;
  deliveredAt:         string;
  notes:               string | null;
  createdAt:           string;
  photos: PodPhoto[];
  trip: {
    id: number; trackingCode: string; status: string;
    fromLocation: string; toLocation: string;
    startDate: string; endDate: string | null;
    customerVehicleRegistration: string | null;
    customerVehicleMake: string | null;
    customerVehicleVin: string | null;
    customer: { id: number; name: string; phone: string | null; email: string };
    driver:   { id: number; name: string; mobile: string };
  };
}

interface TripOption {
  id: number; trackingCode: string; status: string;
  fromLocation: string; toLocation: string;
  customerVehicleRegistration: string | null;
  customer: { name: string };
}

// ── Relationships ──────────────────────────────────────────────────────────────

const RELATIONSHIPS = [
  'Owner', 'Spouse', 'Parent', 'Sibling', 'Child',
  'Friend', 'Colleague', 'Authorised Agent', 'Other',
];

// ── GPS Capture ───────────────────────────────────────────────────────────────

function GPSCapture({ lat, lng, accuracy, onCapture }: {
  lat: number | null; lng: number | null; accuracy: number | null;
  onCapture: (lat: number, lng: number, acc: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const capture = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    setLoading(true); setError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        onCapture(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        setLoading(false);
      },
      err => { setError(err.message); setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <Navigation size={13} className="text-brand-600" /> GPS Location
      </label>
      {lat !== null && lng !== null ? (
        <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800">Location captured</p>
            <p className="text-xs text-green-600 font-mono mt-0.5">
              {lat.toFixed(6)}, {lng.toFixed(6)}
              {accuracy !== null && ` · ±${Math.round(accuracy)}m`}
            </p>
            <a
              href={`https://maps.google.com/?q=${lat},${lng}`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-brand-600 hover:underline"
            >View on map →</a>
          </div>
          <button type="button" onClick={capture} className="text-xs text-green-600 hover:text-green-800 underline shrink-0">Recapture</button>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={capture}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl w-full justify-center text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
            {loading ? 'Getting location…' : 'Capture Current GPS Location'}
          </button>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          <p className="text-xs text-gray-400 mt-1">Optional — requires browser location permission</p>
        </div>
      )}
    </div>
  );
}

// ── Signature Pad ──────────────────────────────────────────────────────────────

function SigPad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<SignatureCanvas>(null);
  const clear = () => { ref.current?.clear(); onChange(''); };
  const capture = () => {
    if (ref.current && !ref.current.isEmpty()) onChange(ref.current.toDataURL('image/png'));
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <FileCheck size={13} className="text-brand-600" /> Receiver Signature *
        </label>
        <button type="button" onClick={clear} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
      </div>
      {value ? (
        <div className="relative border rounded-xl overflow-hidden bg-gray-50">
          <img src={value} alt="Signature" className="w-full h-32 object-contain" />
          <button type="button" onClick={clear} className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-gray-400 hover:text-red-500"><X size={14} /></button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
          <SignatureCanvas
            ref={ref}
            onEnd={capture}
            penColor="#1e293b"
            canvasProps={{ className: 'w-full', height: 120, style: { touchAction: 'none' } }}
          />
          <p className="text-center text-xs text-gray-400 pb-2">Draw signature above</p>
        </div>
      )}
    </div>
  );
}

// ── Photo upload strip ─────────────────────────────────────────────────────────

function PhotoStrip({ podId, photos, onRefresh }: { podId: number; photos: PodPhoto[]; onRefresh: () => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('photos', f));
    await api.post(`/pod/${podId}/photos`, fd);
    setUploading(false);
    onRefresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Camera size={13} className="text-brand-600" /> Delivery Photos ({photos.length})
        </label>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add Photos
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
      </div>
      {photos.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {photos.map(p => (
            <a key={p.id} href={p.path} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-100 hover:opacity-80 transition-opacity">
              <img src={p.path} alt="POD" className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-16 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-xs gap-2">
          <ImageIcon size={14} /> No photos uploaded yet
        </div>
      )}
    </div>
  );
}

// ── Download POD helper ────────────────────────────────────────────────────────

function downloadPOD(pod: POD) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Proof of Delivery — ${pod.trip.trackingCode}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; }
    h1 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 13px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field { margin-bottom: 8px; }
    .field label { font-size: 11px; color: #9ca3af; display: block; }
    .field span { font-size: 14px; font-weight: 500; }
    .sig { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; display: block; max-height: 120px; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; background: #dcfce7; color: #166534; font-weight: 600; }
    .photos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px; }
    .photos img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>Proof of Delivery</h1>
  <p><strong>Booking:</strong> #${pod.tripId} &nbsp;|&nbsp; <strong>Tracking:</strong> ${pod.trip.trackingCode} &nbsp;|&nbsp; <strong>Delivered:</strong> ${format(new Date(pod.deliveredAt), 'dd MMM yyyy HH:mm')}</p>

  <div class="section">
    <h2>Vehicle Details</h2>
    <div class="grid">
      <div class="field"><label>Registration</label><span>${pod.trip.customerVehicleRegistration ?? '—'}</span></div>
      <div class="field"><label>Make</label><span>${pod.trip.customerVehicleMake ?? '—'}</span></div>
      <div class="field"><label>VIN</label><span>${pod.trip.customerVehicleVin ?? '—'}</span></div>
      <div class="field"><label>Route</label><span>${pod.trip.fromLocation} → ${pod.trip.toLocation}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>Customer</h2>
    <div class="grid">
      <div class="field"><label>Name</label><span>${pod.trip.customer.name}</span></div>
      <div class="field"><label>Phone</label><span>${pod.trip.customer.phone}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>Receiver Information</h2>
    <div class="grid">
      <div class="field"><label>First Name</label><span>${pod.receiverFirstName}</span></div>
      <div class="field"><label>Last Name</label><span>${pod.receiverLastName}</span></div>
      <div class="field"><label>Phone</label><span>${pod.receiverPhone}</span></div>
      <div class="field"><label>Email</label><span>${pod.receiverEmail ?? '—'}</span></div>
      <div class="field"><label>ID / Passport</label><span>${pod.receiverIdNumber ?? '—'}</span></div>
      <div class="field"><label>Relationship to Owner</label><span>${pod.relationshipToOwner ?? '—'}</span></div>
    </div>
  </div>

  ${pod.gpsLatitude !== null ? `
  <div class="section">
    <h2>GPS Coordinates</h2>
    <p>${pod.gpsLatitude.toFixed(6)}, ${pod.gpsLongitude!.toFixed(6)}${pod.gpsAccuracy !== null ? ` · ±${Math.round(pod.gpsAccuracy)}m` : ''}</p>
  </div>` : ''}

  ${pod.notes ? `<div class="section"><h2>Notes</h2><p>${pod.notes}</p></div>` : ''}

  <div class="section">
    <h2>Receiver Signature</h2>
    <img src="${pod.signature}" class="sig" alt="Signature" />
    <p style="font-size:12px;color:#6b7280;margin-top:4px;">Signed: ${pod.receiverFirstName} ${pod.receiverLastName}</p>
  </div>

  ${pod.photos.length > 0 ? `
  <div class="section">
    <h2>Delivery Photos</h2>
    <div class="photos">${pod.photos.map(p => `<img src="${window.location.origin}${p.path}" alt=""/>`).join('')}</div>
  </div>` : ''}

  <p style="font-size:11px;color:#9ca3af;margin-top:40px;border-top:1px solid #e5e7eb;padding-top:8px;">
    Generated on ${format(new Date(), 'dd MMM yyyy HH:mm')} · Perazim TMS
  </p>
</body>
</html>`;

  const win = window.open('', '_blank')!;
  win.document.write(html);
  win.document.close();
  win.print();
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type FormStep = 'trip' | 'receiver' | 'verification' | 'signature';

const STEPS: { id: FormStep; label: string }[] = [
  { id: 'trip',         label: 'Trip' },
  { id: 'receiver',     label: 'Receiver' },
  { id: 'verification', label: 'Location & Notes' },
  { id: 'signature',    label: 'Signature' },
];

export default function PODPage() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [step, setStep] = useState<FormStep>('trip');
  const [viewing, setViewing] = useState<POD | null>(null);

  // Form state
  const [tripId,              setTripId]              = useState('');
  const [receiverFirstName,   setReceiverFirstName]   = useState('');
  const [receiverLastName,    setReceiverLastName]    = useState('');
  const [receiverPhone,       setReceiverPhone]       = useState('');
  const [receiverEmail,       setReceiverEmail]       = useState('');
  const [receiverIdNumber,    setReceiverIdNumber]    = useState('');
  const [relationshipToOwner, setRelationshipToOwner] = useState('');
  const [notes,               setNotes]               = useState('');
  const [gpsLat,              setGpsLat]              = useState<number | null>(null);
  const [gpsLng,              setGpsLng]              = useState<number | null>(null);
  const [gpsAcc,              setGpsAcc]              = useState<number | null>(null);
  const [signature,           setSignature]           = useState('');

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: pods = [], isLoading } = useQuery<POD[]>({
    queryKey: ['pods'],
    queryFn: () => api.get('/pod').then(r => r.data),
  });

  const { data: trips = [] } = useQuery<TripOption[]>({
    queryKey: ['trips-pod-select'],
    queryFn: () => api.get('/trips').then(r =>
      r.data.filter((t: TripOption) => t.status !== 'CANCELLED')
    ),
    enabled: formOpen,
  });

  // Trips that already have a POD
  const podTripIds = new Set(pods.map(p => p.tripId));

  // ── Mutations ────────────────────────────────────────────────────────────────

  const createMut = useMutation({
    mutationFn: (payload: object) => api.post('/pod', payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['pods'] });
      closeForm();
      setViewing(res.data);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/pod/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pods'] }),
  });

  // ── Form helpers ─────────────────────────────────────────────────────────────

  const openForm = () => {
    setStep('trip');
    setTripId(''); setReceiverFirstName(''); setReceiverLastName('');
    setReceiverPhone(''); setReceiverEmail(''); setReceiverIdNumber('');
    setRelationshipToOwner(''); setNotes('');
    setGpsLat(null); setGpsLng(null); setGpsAcc(null);
    setSignature('');
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const stepIndex = STEPS.findIndex(s => s.id === step);

  const canNext = step === 'trip'
    ? !!tripId
    : step === 'receiver'
    ? (!!receiverFirstName && !!receiverLastName && !!receiverPhone)
    : true;

  const handleSubmit = () => {
    createMut.mutate({
      tripId:               Number(tripId),
      receiverFirstName,
      receiverLastName,
      receiverPhone,
      receiverEmail:        receiverEmail || undefined,
      receiverIdNumber:     receiverIdNumber || undefined,
      relationshipToOwner:  relationshipToOwner || undefined,
      signature,
      gpsLatitude:          gpsLat ?? undefined,
      gpsLongitude:         gpsLng ?? undefined,
      gpsAccuracy:          gpsAcc ?? undefined,
      notes:                notes || undefined,
    });
  };

  const reloadViewing = useCallback(() => {
    if (!viewing) return;
    api.get(`/pod/${viewing.id}`).then(r => setViewing(r.data));
  }, [viewing]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proof of Delivery</h1>
          <p className="text-sm text-gray-500 mt-0.5">Record and verify vehicle delivery with receiver confirmation</p>
        </div>
        <button
          onClick={openForm}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Plus size={16} /> New POD
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total PODs',       value: pods.length,                            color: 'text-blue-600',  bg: 'bg-blue-50'  },
          { label: 'This Month',       value: pods.filter(p => new Date(p.deliveredAt).getMonth() === new Date().getMonth()).length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'With GPS',         value: pods.filter(p => p.gpsLatitude !== null).length, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3`}>
            <ClipboardCheck size={20} className={s.color} />
            <div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* POD List */}
      {isLoading ? (
        <div className="flex justify-center h-40 items-center"><Loader2 className="animate-spin text-brand-600" size={28} /></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Trip / Vehicle</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Receiver</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Relationship</th>
                  <th className="px-4 py-3 text-left">Delivered</th>
                  <th className="px-4 py-3 text-left">GPS</th>
                  <th className="px-4 py-3 text-left">Photos</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pods.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No proofs of delivery yet. Create the first one.</td></tr>
                ) : pods.map(pod => (
                  <tr key={pod.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{pod.trip.customerVehicleRegistration ?? '—'}</p>
                      <p className="text-xs text-gray-400 font-mono">{pod.trip.trackingCode.slice(0, 10)}…</p>
                      <p className="text-xs text-gray-400 mt-0.5">{pod.trip.fromLocation} → {pod.trip.toLocation}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{pod.trip.customer.name}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{pod.receiverFirstName} {pod.receiverLastName}</p>
                      {pod.receiverIdNumber && <p className="text-xs text-gray-400">ID: {pod.receiverIdNumber}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{pod.receiverPhone}</p>
                      {pod.receiverEmail && <p className="text-xs text-gray-400">{pod.receiverEmail}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {pod.relationshipToOwner ? (
                        <Badge label={pod.relationshipToOwner} variant="blue" />
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {format(new Date(pod.deliveredAt), 'dd MMM yyyy')}
                      <p className="text-xs">{format(new Date(pod.deliveredAt), 'HH:mm')}</p>
                    </td>
                    <td className="px-4 py-3">
                      {pod.gpsLatitude !== null ? (
                        <a
                          href={`https://maps.google.com/?q=${pod.gpsLatitude},${pod.gpsLongitude}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                        >
                          <MapPin size={11} /> Map
                        </a>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{pod.photos.length}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewing(pod)} className="p-1.5 text-gray-400 hover:text-brand-600" title="View"><Eye size={15} /></button>
                        <button onClick={() => downloadPOD(pod)} className="p-1.5 text-gray-400 hover:text-green-600" title="Download/Print"><Download size={15} /></button>
                        <button onClick={() => { if (confirm('Delete this proof of delivery?')) deleteMut.mutate(pod.id); }} className="p-1.5 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── NEW POD MODAL ─────────────────────────────────────── */}
      <Modal title="New Proof of Delivery" open={formOpen} onClose={closeForm} width="max-w-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 mb-6 -mt-1 flex-wrap">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => i < stepIndex ? setStep(s.id) : undefined}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${step === s.id ? 'bg-brand-600 text-white' : i < stepIndex ? 'bg-brand-100 text-brand-700 hover:bg-brand-200 cursor-pointer' : 'text-gray-400 bg-gray-100'}`}
              >
                {i + 1}. {s.label}
              </button>
              {i < STEPS.length - 1 && <ChevronRight size={13} className="text-gray-300 shrink-0" />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Trip Selection ────────────── */}
        {step === 'trip' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Trip / Booking *</label>
              <select
                value={tripId}
                onChange={e => setTripId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Choose a trip…</option>
                {trips.map(t => (
                  <option key={t.id} value={t.id} disabled={podTripIds.has(t.id)}>
                    #{t.id} — {t.customer.name}
                    {t.customerVehicleRegistration ? ` · ${t.customerVehicleRegistration}` : ''}
                    {` · ${t.fromLocation} → ${t.toLocation}`}
                    {podTripIds.has(t.id) ? ' ✓ POD exists' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Trips already having a POD are disabled.</p>
            </div>

            {/* Preview selected trip */}
            {tripId && (() => {
              const t = trips.find(x => String(x.id) === tripId);
              if (!t) return null;
              return (
                <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge label={t.status} variant="blue" />
                    <span className="text-gray-500 font-mono text-xs">{t.trackingCode.slice(0, 12)}…</span>
                  </div>
                  <p className="font-medium text-gray-900">{t.customer.name}</p>
                  {t.customerVehicleRegistration && <p className="text-gray-500">Vehicle: {t.customerVehicleRegistration}</p>}
                  <p className="text-gray-500 flex items-center gap-1"><MapPin size={12} /> {t.fromLocation} → {t.toLocation}</p>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Step 2: Receiver Information ─────── */}
        {step === 'receiver' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><User size={12} className="text-brand-600" /> First Name *</label>
                <input value={receiverFirstName} onChange={e => setReceiverFirstName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="John" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input value={receiverLastName} onChange={e => setReceiverLastName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Smith" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Phone size={12} className="text-brand-600" /> Contact Number *</label>
                <input value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} type="tel" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="+27 82 123 4567" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Mail size={12} className="text-brand-600" /> Email Address</label>
                <input value={receiverEmail} onChange={e => setReceiverEmail(e.target.value)} type="email" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="john@email.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><CreditCard size={12} className="text-brand-600" /> ID / Passport Number</label>
                <input value={receiverIdNumber} onChange={e => setReceiverIdNumber(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="9001015009087" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Users size={12} className="text-brand-600" /> Relationship to Vehicle Owner</label>
                <select value={relationshipToOwner} onChange={e => setRelationshipToOwner(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select relationship…</option>
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: GPS + Notes ───────────────── */}
        {step === 'verification' && (
          <div className="space-y-5">
            <GPSCapture
              lat={gpsLat} lng={gpsLng} accuracy={gpsAcc}
              onCapture={(lat, lng, acc) => { setGpsLat(lat); setGpsLng(lng); setGpsAcc(acc); }}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                placeholder="Any additional notes about the delivery…"
              />
            </div>
          </div>
        )}

        {/* ── Step 4: Signature ─────────────────── */}
        {step === 'signature' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
              Please hand the device to the receiver (<strong>{receiverFirstName} {receiverLastName}</strong>) to sign below.
            </div>
            <SigPad value={signature} onChange={setSignature} />
          </div>
        )}

        {/* Step navigation */}
        <div className="flex items-center justify-between pt-5 mt-4 border-t">
          <button
            type="button"
            onClick={() => stepIndex > 0 ? setStep(STEPS[stepIndex - 1].id) : closeForm()}
            className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {stepIndex === 0 ? 'Cancel' : '← Back'}
          </button>

          {step !== 'signature' ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep(STEPS[stepIndex + 1].id)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!signature || createMut.isPending}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50"
            >
              {createMut.isPending && <Loader2 className="animate-spin" size={15} />}
              <CheckCircle2 size={15} /> Confirm Delivery
            </button>
          )}
        </div>
      </Modal>

      {/* ── VIEW POD MODAL ───────────────────────────────────── */}
      {viewing && (
        <Modal
          title={`POD — ${viewing.receiverFirstName} ${viewing.receiverLastName}`}
          open={!!viewing}
          onClose={() => setViewing(null)}
          width="max-w-3xl"
        >
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1 text-sm">
            {/* Trip info */}
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4">
              <div><p className="text-gray-400 text-xs">Trip ID</p><p className="font-medium">#{viewing.tripId}</p></div>
              <div><p className="text-gray-400 text-xs">Tracking Code</p><p className="font-mono text-xs font-medium">{viewing.trip.trackingCode}</p></div>
              <div><p className="text-gray-400 text-xs">Vehicle</p><p className="font-medium">{viewing.trip.customerVehicleRegistration ?? '—'}{viewing.trip.customerVehicleMake ? ` · ${viewing.trip.customerVehicleMake}` : ''}</p></div>
              <div><p className="text-gray-400 text-xs">Route</p><p className="font-medium">{viewing.trip.fromLocation} → {viewing.trip.toLocation}</p></div>
              <div><p className="text-gray-400 text-xs">Customer</p><p className="font-medium">{viewing.trip.customer.name}</p></div>
              <div><p className="text-gray-400 text-xs">Driver</p><p className="font-medium">{viewing.trip.driver.name}</p></div>
              <div><p className="text-gray-400 text-xs">Delivered At</p><p className="font-medium">{format(new Date(viewing.deliveredAt), 'dd MMM yyyy HH:mm')}</p></div>
              {viewing.gpsLatitude !== null && (
                <div>
                  <p className="text-gray-400 text-xs">GPS</p>
                  <a href={`https://maps.google.com/?q=${viewing.gpsLatitude},${viewing.gpsLongitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline font-medium">
                    <MapPin size={12} /> {viewing.gpsLatitude.toFixed(5)}, {viewing.gpsLongitude!.toFixed(5)}
                  </a>
                </div>
              )}
            </div>

            {/* Receiver */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Receiver Information</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg">
                  <User size={14} className="text-gray-400 shrink-0" />
                  <div><p className="text-gray-400 text-xs">Full Name</p><p className="font-medium">{viewing.receiverFirstName} {viewing.receiverLastName}</p></div>
                </div>
                <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg">
                  <Phone size={14} className="text-gray-400 shrink-0" />
                  <div><p className="text-gray-400 text-xs">Phone</p><p className="font-medium">{viewing.receiverPhone}</p></div>
                </div>
                {viewing.receiverEmail && (
                  <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg">
                    <Mail size={14} className="text-gray-400 shrink-0" />
                    <div><p className="text-gray-400 text-xs">Email</p><p className="font-medium">{viewing.receiverEmail}</p></div>
                  </div>
                )}
                {viewing.receiverIdNumber && (
                  <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg">
                    <CreditCard size={14} className="text-gray-400 shrink-0" />
                    <div><p className="text-gray-400 text-xs">ID / Passport</p><p className="font-medium">{viewing.receiverIdNumber}</p></div>
                  </div>
                )}
                {viewing.relationshipToOwner && (
                  <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg">
                    <Users size={14} className="text-gray-400 shrink-0" />
                    <div><p className="text-gray-400 text-xs">Relationship</p><p className="font-medium">{viewing.relationshipToOwner}</p></div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {viewing.notes && (
              <div>
                <p className="text-gray-400 text-xs mb-1">Notes</p>
                <p className="bg-gray-50 rounded-lg p-3 text-gray-700">{viewing.notes}</p>
              </div>
            )}

            {/* Signature */}
            <div>
              <p className="text-gray-400 text-xs mb-2">Receiver Signature — {viewing.receiverFirstName} {viewing.receiverLastName}</p>
              <img src={viewing.signature} alt="Receiver signature" className="border rounded-xl bg-white p-2 w-full max-h-36 object-contain" />
            </div>

            {/* Photos */}
            <PhotoStrip podId={viewing.id} photos={viewing.photos} onRefresh={reloadViewing} />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button
                onClick={() => downloadPOD(viewing)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download size={14} /> Download / Print
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
