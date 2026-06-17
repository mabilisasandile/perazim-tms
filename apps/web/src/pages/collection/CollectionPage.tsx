import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState, useRef, useEffect, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { format } from 'date-fns';
import {
  Plus, Loader2, Eye, Trash2, CheckCircle2, ChevronRight, X,
  User, Phone, Mail, CreditCard, Users, Navigation, FileCheck,
  Camera, Upload, RefreshCw, ShieldCheck, MapPin, AlertTriangle,
  Download, ClipboardCheck, UserCheck, BadgeCheck, ImageOff,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Collection {
  id: number;
  tripId: number;
  collectorFirstName:  string;
  collectorLastName:   string;
  collectorPhone:      string;
  collectorEmail:      string | null;
  relationshipToOwner: string | null;
  idType:              string;
  idNumber:            string;
  idPhotoPath:         string | null;
  selfiePath:          string | null;
  signature:           string;
  gpsLatitude:         number | null;
  gpsLongitude:        number | null;
  gpsAccuracy:         number | null;
  collectedAt:         string;
  notes:               string | null;
  createdAt:           string;
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

// ── Constants ─────────────────────────────────────────────────────────────────

const RELATIONSHIPS = [
  'Vehicle Owner', 'Spouse', 'Parent', 'Sibling', 'Child',
  'Friend', 'Colleague', 'Authorised Agent', 'Other',
];

const ID_TYPES = [
  'South African ID',
  'Passport',
  "Driver's License",
  'Other Government ID',
];

// ── GPS Capture ───────────────────────────────────────────────────────────────

function GPSCapture({ lat, lng, accuracy, onCapture }: {
  lat: number | null; lng: number | null; accuracy: number | null;
  onCapture: (lat: number, lng: number, acc: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const capture = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    setLoading(true); setError('');
    navigator.geolocation.getCurrentPosition(
      pos => { onCapture(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy); setLoading(false); },
      err => { setError(err.message); setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <Navigation size={13} className="text-brand-600" /> GPS Location
      </label>
      {lat !== null ? (
        <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">Location captured</p>
            <p className="text-xs text-green-600 font-mono">{lat.toFixed(6)}, {lng!.toFixed(6)}{accuracy ? ` · ±${Math.round(accuracy)}m` : ''}</p>
          </div>
          <button type="button" onClick={capture} className="text-xs text-green-600 hover:underline shrink-0">Recapture</button>
        </div>
      ) : (
        <div>
          <button type="button" onClick={capture} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl w-full justify-center text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
            {loading ? 'Getting location…' : 'Capture GPS Location'}
          </button>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          <p className="text-xs text-gray-400 mt-1">Optional — requires location permission</p>
        </div>
      )}
    </div>
  );
}

// ── Signature Pad ─────────────────────────────────────────────────────────────

function SigPad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<SignatureCanvas>(null);
  const clear = () => { ref.current?.clear(); onChange(''); };
  const capture = () => { if (ref.current && !ref.current.isEmpty()) onChange(ref.current.toDataURL('image/png')); };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <FileCheck size={13} className="text-brand-600" /> Collector's Signature *
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
          <SignatureCanvas ref={ref} onEnd={capture} penColor="#1e293b"
            canvasProps={{ className: 'w-full', height: 120, style: { touchAction: 'none' } }} />
          <p className="text-center text-xs text-gray-400 pb-2">Draw signature above</p>
        </div>
      )}
    </div>
  );
}

// ── ID Document Photo Upload ───────────────────────────────────────────────────

function IdPhotoUpload({ file, preview, onChange }: {
  file: File | null;
  preview: string;
  onChange: (file: File, preview: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => onChange(f, reader.result as string);
    reader.readAsDataURL(f);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <CreditCard size={13} className="text-brand-600" /> ID Document Photo *
      </label>
      <p className="text-xs text-gray-500">Take a clear photo of the collector's identity document.</p>

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          <img src={preview} alt="ID Document" className="w-full max-h-48 object-contain" />
          <button
            type="button"
            onClick={() => { onChange(null as any, ''); if (inputRef.current) inputRef.current.value = ''; }}
            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-gray-400 hover:text-red-500"
          ><X size={14} /></button>
          <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-xs py-1.5 px-3 flex items-center gap-1.5">
            <CheckCircle2 size={12} /> {file?.name ?? 'ID document captured'}
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors"
        >
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
            <Upload size={22} className="text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Upload ID Document</p>
            <p className="text-xs text-gray-400 mt-0.5">Click to browse or use camera · JPG, PNG</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {!preview && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 w-full justify-center"
        >
          <Camera size={14} /> Take Photo / Upload File
        </button>
      )}
    </div>
  );
}

// ── Selfie Capture ─────────────────────────────────────────────────────────────

function SelfieCapture({ preview, onCapture }: {
  preview: string;
  onCapture: (blob: Blob | null, preview: string) => void;
}) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const [mode, setMode]         = useState<'idle' | 'streaming' | 'captured'>('idle');
  const [camError, setCamError] = useState('');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setMode('streaming');
    } catch {
      setCamError('Camera unavailable — please use file upload instead.');
    }
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width  = videoRef.current.videoWidth  || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    // Mirror horizontally (front camera selfie feel)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    canvas.toBlob(b => {
      if (b) onCapture(b, dataUrl);
    }, 'image/jpeg', 0.85);
    stopCamera();
    setMode('captured');
  };

  const retake = () => {
    onCapture(null, '');
    setMode('idle');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onCapture(file, reader.result as string);
      setMode('captured');
    };
    reader.readAsDataURL(file);
  };

  // ── Captured view ──────────────────────────────────────────────────────────
  if (preview) {
    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Camera size={13} className="text-brand-600" /> Selfie Captured
        </label>
        <div className="relative rounded-xl overflow-hidden border-2 border-green-300 bg-gray-50">
          <img src={preview} alt="Selfie" className="w-full max-h-56 object-cover" />
          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5">
            <CheckCircle2 size={14} className="text-white" />
          </div>
          <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-xs py-1.5 px-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><ShieldCheck size={12} /> Identity captured</span>
            <button type="button" onClick={retake} className="flex items-center gap-1 hover:text-amber-300 transition-colors">
              <RefreshCw size={11} /> Retake
            </button>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // ── Live camera view ───────────────────────────────────────────────────────
  if (mode === 'streaming') {
    return (
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Camera size={13} className="text-brand-600" /> Camera — Position face in frame
        </label>
        <div className="relative rounded-xl overflow-hidden bg-black border border-gray-300">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ transform: 'scaleX(-1)' }}
            className="w-full max-h-64 object-cover"
          />
          {/* Face guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-36 h-44 border-2 border-dashed border-white/60 rounded-full" />
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-2">
          <button type="button" onClick={captureFrame}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Camera size={16} /> Take Selfie
          </button>
          <button type="button" onClick={() => { stopCamera(); setMode('idle'); }}
            className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Idle — options ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Camera size={13} className="text-brand-600" /> Selfie Photo *
        </label>
        <p className="text-xs text-gray-500 mt-0.5">Capture a live photo of the collector for identity verification.</p>
      </div>

      {camError && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={13} /> {camError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={startCamera}
          className="flex flex-col items-center gap-2.5 p-5 border-2 border-dashed border-brand-300 rounded-xl hover:border-brand-500 hover:bg-brand-50 transition-colors">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
            <Camera size={20} className="text-brand-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Open Camera</p>
            <p className="text-xs text-gray-400">Live selfie capture</p>
          </div>
        </button>

        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center gap-2.5 p-5 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-colors">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <Upload size={20} className="text-gray-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Upload Photo</p>
            <p className="text-xs text-gray-400">From gallery or file</p>
          </div>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFile}
      />

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ── Download helper ────────────────────────────────────────────────────────────

function downloadCollection(col: Collection) {
  const host = window.location.origin;
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Customer Collection — ${col.trip.trackingCode}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; }
    h1 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 13px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field label { font-size: 11px; color: #9ca3af; display: block; }
    .field span { font-size: 14px; font-weight: 500; }
    .photos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
    .photos img { width: 100%; border-radius: 8px; border: 1px solid #e5e7eb; }
    .sig { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; display: block; max-height: 120px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>Customer Collection Record</h1>
  <p><strong>Trip #${col.tripId}</strong> &nbsp;|&nbsp; <strong>Tracking:</strong> ${col.trip.trackingCode} &nbsp;|&nbsp; <strong>Collected:</strong> ${format(new Date(col.collectedAt), 'dd MMM yyyy HH:mm')}</p>

  <div class="section">
    <h2>Vehicle Details</h2>
    <div class="grid">
      <div class="field"><label>Registration</label><span>${col.trip.customerVehicleRegistration ?? '—'}</span></div>
      <div class="field"><label>Make</label><span>${col.trip.customerVehicleMake ?? '—'}</span></div>
      <div class="field"><label>Route</label><span>${col.trip.fromLocation} → ${col.trip.toLocation}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>Collector Identity</h2>
    <div class="grid">
      <div class="field"><label>Full Name</label><span>${col.collectorFirstName} ${col.collectorLastName}</span></div>
      <div class="field"><label>Phone</label><span>${col.collectorPhone}</span></div>
      ${col.collectorEmail ? `<div class="field"><label>Email</label><span>${col.collectorEmail}</span></div>` : ''}
      <div class="field"><label>ID Type</label><span>${col.idType}</span></div>
      <div class="field"><label>ID Number</label><span>${col.idNumber}</span></div>
      ${col.relationshipToOwner ? `<div class="field"><label>Relationship</label><span>${col.relationshipToOwner}</span></div>` : ''}
    </div>
  </div>

  ${(col.idPhotoPath || col.selfiePath) ? `
  <div class="section">
    <h2>Verification Photos</h2>
    <div class="photos">
      ${col.idPhotoPath ? `<div><p style="font-size:11px;color:#6b7280;margin-bottom:4px;">ID Document</p><img src="${host}${col.idPhotoPath}" alt="ID"/></div>` : ''}
      ${col.selfiePath  ? `<div><p style="font-size:11px;color:#6b7280;margin-bottom:4px;">Selfie</p><img src="${host}${col.selfiePath}" alt="Selfie"/></div>` : ''}
    </div>
  </div>` : ''}

  ${col.gpsLatitude ? `<div class="section"><h2>GPS</h2><p>${col.gpsLatitude.toFixed(6)}, ${col.gpsLongitude!.toFixed(6)}</p></div>` : ''}
  ${col.notes ? `<div class="section"><h2>Notes</h2><p>${col.notes}</p></div>` : ''}

  <div class="section">
    <h2>Digital Signature</h2>
    <img src="${col.signature}" class="sig" alt="Signature" />
    <p style="font-size:12px;color:#6b7280;margin-top:4px;">Signed: ${col.collectorFirstName} ${col.collectorLastName}</p>
  </div>

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

// ── Main Page ─────────────────────────────────────────────────────────────────

type FormStep = 'trip' | 'collector' | 'identity' | 'selfie' | 'signature';

const STEPS: { id: FormStep; label: string; icon: React.ElementType }[] = [
  { id: 'trip',      label: 'Trip',      icon: ClipboardCheck },
  { id: 'collector', label: 'Collector', icon: User },
  { id: 'identity',  label: 'Identity',  icon: CreditCard },
  { id: 'selfie',    label: 'Selfie',    icon: Camera },
  { id: 'signature', label: 'Sign',      icon: FileCheck },
];

export default function CollectionPage() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [step, setStep]         = useState<FormStep>('trip');
  const [viewing, setViewing]   = useState<Collection | null>(null);

  // Form state
  const [tripId,              setTripId]              = useState('');
  const [collectorFirstName,  setCollectorFirstName]  = useState('');
  const [collectorLastName,   setCollectorLastName]   = useState('');
  const [collectorPhone,      setCollectorPhone]      = useState('');
  const [collectorEmail,      setCollectorEmail]      = useState('');
  const [relationshipToOwner, setRelationshipToOwner] = useState('');
  const [idType,              setIdType]              = useState('');
  const [idNumber,            setIdNumber]            = useState('');
  const [idPhotoFile,         setIdPhotoFile]         = useState<File | null>(null);
  const [idPhotoPreview,      setIdPhotoPreview]      = useState('');
  const [selfieBlob,          setSelfieBlob]          = useState<Blob | null>(null);
  const [selfiePreview,       setSelfiePreview]       = useState('');
  const [signature,           setSignature]           = useState('');
  const [gpsLat,              setGpsLat]              = useState<number | null>(null);
  const [gpsLng,              setGpsLng]              = useState<number | null>(null);
  const [gpsAcc,              setGpsAcc]              = useState<number | null>(null);
  const [notes,               setNotes]               = useState('');

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: collections = [], isLoading } = useQuery<Collection[]>({
    queryKey: ['collections'],
    queryFn: () => api.get('/collections').then(r => r.data),
  });

  const { data: trips = [] } = useQuery<TripOption[]>({
    queryKey: ['trips-collection-select'],
    queryFn: () => api.get('/trips').then(r =>
      r.data.filter((t: TripOption) => t.status !== 'CANCELLED')
    ),
    enabled: formOpen,
  });

  const collectionTripIds = new Set(collections.map(c => c.tripId));

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMut = useMutation({
    mutationFn: async (payload: object) => {
      // 1. Create the base record
      const res  = await api.post('/collections', payload);
      const id   = res.data.id as number;
      const uploads: Promise<any>[] = [];

      // 2. Upload ID photo
      if (idPhotoFile) {
        const fd = new FormData();
        fd.append('idPhoto', idPhotoFile);
        uploads.push(api.post(`/collections/${id}/id-photo`, fd));
      }

      // 3. Upload selfie
      if (selfieBlob) {
        const fd = new FormData();
        fd.append('selfie', selfieBlob, 'selfie.jpg');
        uploads.push(api.post(`/collections/${id}/selfie`, fd));
      }

      await Promise.all(uploads);

      // 4. Return fresh record (with photo paths)
      return api.get(`/collections/${id}`).then(r => r.data);
    },
    onSuccess: (data: Collection) => {
      qc.invalidateQueries({ queryKey: ['collections'] });
      closeForm();
      setViewing(data);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/collections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections'] }),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const openForm = () => {
    setStep('trip');
    setTripId(''); setCollectorFirstName(''); setCollectorLastName('');
    setCollectorPhone(''); setCollectorEmail(''); setRelationshipToOwner('');
    setIdType(''); setIdNumber('');
    setIdPhotoFile(null); setIdPhotoPreview('');
    setSelfieBlob(null); setSelfiePreview('');
    setSignature('');
    setGpsLat(null); setGpsLng(null); setGpsAcc(null);
    setNotes('');
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const stepIndex = STEPS.findIndex(s => s.id === step);

  const canNext: boolean = (() => {
    if (step === 'trip')      return !!tripId;
    if (step === 'collector') return !!collectorFirstName && !!collectorLastName && !!collectorPhone;
    if (step === 'identity')  return !!idType && !!idNumber && !!idPhotoPreview;
    if (step === 'selfie')    return !!selfiePreview;
    return true;
  })();

  const handleSubmit = () => {
    createMut.mutate({
      tripId:              Number(tripId),
      collectorFirstName,
      collectorLastName,
      collectorPhone,
      collectorEmail:      collectorEmail || undefined,
      relationshipToOwner: relationshipToOwner || undefined,
      idType,
      idNumber,
      signature,
      gpsLatitude:         gpsLat ?? undefined,
      gpsLongitude:        gpsLng ?? undefined,
      gpsAccuracy:         gpsAcc ?? undefined,
      notes:               notes || undefined,
    });
  };


  const selectedTrip = trips.find(t => String(t.id) === tripId);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Collection</h1>
          <p className="text-sm text-gray-500 mt-0.5">Verify identity and record vehicle collection with photo evidence</p>
        </div>
        <button
          onClick={openForm}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Plus size={16} /> New Collection
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Collections', value: collections.length,                                                                    color: 'text-blue-600',  bg: 'bg-blue-50',  icon: UserCheck },
          { label: 'With Selfie',       value: collections.filter(c => c.selfiePath).length,                                          color: 'text-green-600', bg: 'bg-green-50', icon: Camera },
          { label: 'This Month',        value: collections.filter(c => new Date(c.collectedAt).getMonth() === new Date().getMonth()).length, color: 'text-purple-600', bg: 'bg-purple-50', icon: BadgeCheck },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3`}>
            <s.icon size={20} className={s.color} />
            <div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Collection list */}
      {isLoading ? (
        <div className="flex justify-center h-40 items-center"><Loader2 className="animate-spin text-brand-600" size={28} /></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Trip / Vehicle</th>
                  <th className="px-4 py-3 text-left">Collector</th>
                  <th className="px-4 py-3 text-left">Identity</th>
                  <th className="px-4 py-3 text-left">Relationship</th>
                  <th className="px-4 py-3 text-left">Verification</th>
                  <th className="px-4 py-3 text-left">Collected</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {collections.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No collection records yet.</td></tr>
                ) : collections.map(col => (
                  <tr key={col.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{col.trip.customerVehicleRegistration ?? '—'}</p>
                      <p className="text-xs text-gray-400 font-mono">{col.trip.trackingCode.slice(0, 10)}…</p>
                      <p className="text-xs text-gray-400">{col.trip.fromLocation} → {col.trip.toLocation}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{col.collectorFirstName} {col.collectorLastName}</p>
                      <p className="text-xs text-gray-500">{col.collectorPhone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={col.idType} variant="blue" />
                      <p className="text-xs text-gray-500 mt-1 font-mono">{col.idNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      {col.relationshipToOwner
                        ? <Badge label={col.relationshipToOwner} variant="gray" />
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${col.idPhotoPath ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          <CreditCard size={10} /> ID
                        </span>
                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${col.selfiePath ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          <Camera size={10} /> Selfie
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {format(new Date(col.collectedAt), 'dd MMM yyyy')}
                      <p className="text-xs">{format(new Date(col.collectedAt), 'HH:mm')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewing(col)} className="p-1.5 text-gray-400 hover:text-brand-600" title="View"><Eye size={15} /></button>
                        <button onClick={() => downloadCollection(col)} className="p-1.5 text-gray-400 hover:text-green-600" title="Download"><Download size={15} /></button>
                        <button onClick={() => { if (confirm('Delete this collection record?')) deleteMut.mutate(col.id); }} className="p-1.5 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── NEW COLLECTION MODAL ──────────────────────────────── */}
      <Modal title="New Customer Collection" open={formOpen} onClose={closeForm} width="max-w-2xl">
        {/* Step breadcrumb */}
        <div className="flex items-center gap-1 mb-6 -mt-1 flex-wrap">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => i < stepIndex ? setStep(s.id) : undefined}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                    step === s.id ? 'bg-brand-600 text-white'
                    : i < stepIndex ? 'bg-brand-100 text-brand-700 hover:bg-brand-200 cursor-pointer'
                    : 'text-gray-400 bg-gray-100'
                  }`}
                >
                  <Icon size={10} /> {i + 1}. {s.label}
                </button>
                {i < STEPS.length - 1 && <ChevronRight size={13} className="text-gray-300 shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Trip ──────────────────────────────────────── */}
        {step === 'trip' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Trip *</label>
              <select
                value={tripId}
                onChange={e => setTripId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Choose a trip…</option>
                {trips.map(t => (
                  <option key={t.id} value={t.id} disabled={collectionTripIds.has(t.id)}>
                    #{t.id} — {t.customer.name}
                    {t.customerVehicleRegistration ? ` · ${t.customerVehicleRegistration}` : ''}
                    {` · ${t.fromLocation} → ${t.toLocation}`}
                    {collectionTripIds.has(t.id) ? ' ✓ Collected' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedTrip && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <Badge label={selectedTrip.status} variant="blue" />
                  <span className="text-gray-500 font-mono text-xs">{selectedTrip.trackingCode.slice(0, 12)}…</span>
                </div>
                <p className="font-medium text-gray-900">{selectedTrip.customer.name}</p>
                {selectedTrip.customerVehicleRegistration && <p className="text-gray-500">Vehicle: {selectedTrip.customerVehicleRegistration}</p>}
                <p className="text-gray-500 flex items-center gap-1"><MapPin size={12} /> {selectedTrip.fromLocation} → {selectedTrip.toLocation}</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Collection Requirements</p>
              <ul className="space-y-0.5 pl-3 list-disc">
                <li>Identity document (ID / Passport / Licence)</li>
                <li>Live selfie photo for fraud prevention</li>
                <li>Digital signature confirmation</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── Step 2: Collector Info ────────────────────────────── */}
        {step === 'collector' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><User size={12} className="text-brand-600" /> First Name *</label>
                <input value={collectorFirstName} onChange={e => setCollectorFirstName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="John" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input value={collectorLastName} onChange={e => setCollectorLastName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Smith" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Phone size={12} className="text-brand-600" /> Contact Number *</label>
                <input value={collectorPhone} onChange={e => setCollectorPhone(e.target.value)} type="tel" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="+27 82 123 4567" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Mail size={12} className="text-brand-600" /> Email</label>
                <input value={collectorEmail} onChange={e => setCollectorEmail(e.target.value)} type="email" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="john@email.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Users size={12} className="text-brand-600" /> Relationship to Vehicle Owner</label>
              <select value={relationshipToOwner} onChange={e => setRelationshipToOwner(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Select relationship…</option>
                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── Step 3: Identity Verification ────────────────────── */}
        {step === 'identity' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Document Type *</label>
                <select value={idType} onChange={e => setIdType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select type…</option>
                  {ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID / Passport Number *</label>
                <input value={idNumber} onChange={e => setIdNumber(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono" placeholder="9001015009087" />
              </div>
            </div>
            <IdPhotoUpload
              file={idPhotoFile}
              preview={idPhotoPreview}
              onChange={(f, p) => { setIdPhotoFile(f); setIdPhotoPreview(p); }}
            />
          </div>
        )}

        {/* ── Step 4: Selfie Capture ────────────────────────────── */}
        {step === 'selfie' && (
          <SelfieCapture
            preview={selfiePreview}
            onCapture={(b, p) => { setSelfieBlob(b); setSelfiePreview(p); }}
          />
        )}

        {/* ── Step 5: Signature + GPS + Notes ──────────────────── */}
        {step === 'signature' && (
          <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
              Please hand the device to <strong>{collectorFirstName} {collectorLastName}</strong> to confirm collection.
            </div>
            <SigPad value={signature} onChange={setSignature} />
            <GPSCapture
              lat={gpsLat} lng={gpsLng} accuracy={gpsAcc}
              onCapture={(lat, lng, acc) => { setGpsLat(lat); setGpsLng(lng); setGpsAcc(acc); }}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                placeholder="Any remarks about the collection…"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
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
              <ShieldCheck size={15} /> Confirm Collection
            </button>
          )}
        </div>

        {createMut.isError && (
          <p className="text-xs text-red-600 mt-2 text-center">
            {(createMut.error as any)?.response?.data?.error || 'Failed to record collection.'}
          </p>
        )}
      </Modal>

      {/* ── VIEW COLLECTION MODAL ─────────────────────────────── */}
      {viewing && (
        <Modal
          title={`Collection — ${viewing.collectorFirstName} ${viewing.collectorLastName}`}
          open={!!viewing}
          onClose={() => setViewing(null)}
          width="max-w-3xl"
        >
          <div className="space-y-5 max-h-[78vh] overflow-y-auto pr-1 text-sm">
            {/* Trip info */}
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4">
              <div><p className="text-gray-400 text-xs">Trip ID</p><p className="font-medium">#{viewing.tripId}</p></div>
              <div><p className="text-gray-400 text-xs">Tracking</p><p className="font-mono text-xs font-medium">{viewing.trip.trackingCode}</p></div>
              <div><p className="text-gray-400 text-xs">Vehicle</p><p className="font-medium">{viewing.trip.customerVehicleRegistration ?? '—'}{viewing.trip.customerVehicleMake ? ` · ${viewing.trip.customerVehicleMake}` : ''}</p></div>
              <div><p className="text-gray-400 text-xs">Route</p><p className="font-medium">{viewing.trip.fromLocation} → {viewing.trip.toLocation}</p></div>
              <div><p className="text-gray-400 text-xs">Customer</p><p className="font-medium">{viewing.trip.customer.name}</p></div>
              <div><p className="text-gray-400 text-xs">Collected At</p><p className="font-medium">{format(new Date(viewing.collectedAt), 'dd MMM yyyy HH:mm')}</p></div>
            </div>

            {/* Collector identity */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Collector Identity</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: User,       label: 'Full Name',    val: `${viewing.collectorFirstName} ${viewing.collectorLastName}` },
                  { icon: Phone,      label: 'Phone',        val: viewing.collectorPhone },
                  { icon: Mail,       label: 'Email',        val: viewing.collectorEmail },
                  { icon: CreditCard, label: 'ID Type',      val: viewing.idType },
                  { icon: CreditCard, label: 'ID Number',    val: viewing.idNumber },
                  { icon: Users,      label: 'Relationship', val: viewing.relationshipToOwner },
                ].filter(f => f.val).map(f => (
                  <div key={f.label} className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg">
                    <f.icon size={14} className="text-gray-400 shrink-0" />
                    <div><p className="text-gray-400 text-xs">{f.label}</p><p className="font-medium">{f.val}</p></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification photos */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Verification Photos</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><CreditCard size={11} /> ID Document</p>
                  {viewing.idPhotoPath ? (
                    <a href={viewing.idPhotoPath} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={viewing.idPhotoPath} alt="ID Document" className="w-full rounded-xl border border-gray-200 object-cover hover:opacity-80 transition-opacity" />
                    </a>
                  ) : (
                    <div className="flex items-center justify-center h-28 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-xs gap-1.5">
                      <ImageOff size={14} /> Not captured
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Camera size={11} /> Selfie</p>
                  {viewing.selfiePath ? (
                    <a href={viewing.selfiePath} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={viewing.selfiePath} alt="Selfie" className="w-full rounded-xl border border-gray-200 object-cover hover:opacity-80 transition-opacity" />
                    </a>
                  ) : (
                    <div className="flex items-center justify-center h-28 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-xs gap-1.5">
                      <ImageOff size={14} /> Not captured
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* GPS */}
            {viewing.gpsLatitude !== null && (
              <div>
                <p className="text-gray-400 text-xs mb-1">GPS Location</p>
                <a
                  href={`https://maps.google.com/?q=${viewing.gpsLatitude},${viewing.gpsLongitude}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-brand-600 hover:underline text-sm font-medium"
                >
                  <MapPin size={13} /> {viewing.gpsLatitude.toFixed(5)}, {viewing.gpsLongitude!.toFixed(5)}
                </a>
              </div>
            )}

            {/* Notes */}
            {viewing.notes && (
              <div><p className="text-gray-400 text-xs mb-1">Notes</p><p className="bg-gray-50 rounded-lg p-3 text-gray-700">{viewing.notes}</p></div>
            )}

            {/* Signature */}
            <div>
              <p className="text-gray-400 text-xs mb-2">Digital Signature — {viewing.collectorFirstName} {viewing.collectorLastName}</p>
              <img src={viewing.signature} alt="Signature" className="border rounded-xl bg-white p-2 w-full max-h-36 object-contain" />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <button onClick={() => downloadCollection(viewing)} className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Download size={14} /> Download / Print
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
