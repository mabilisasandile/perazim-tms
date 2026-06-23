import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState, useRef, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { format } from 'date-fns';
import {
  Plus, Loader2, Eye, Trash2, Settings, CheckCircle2, XCircle,
  MinusCircle, PlusCircle, Camera, Gauge, AlertTriangle,
  Pen, User, Package, Truck, MapPin, X, ChevronRight,
  Image as ImageIcon,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

// ── Types ─────────────────────────────────────────────────────────────────────

type Stage = 'COLLECTION' | 'WAREHOUSE' | 'HANDOVER' | 'DELIVERY';

interface InspItem     { id: number; name: string; isActive: boolean; order: number; }
interface InspCategory { id: number; name: string; isActive: boolean; order: number; items: InspItem[]; }

interface InspImage {
  id: number; filename: string; path: string;
  driver: { name: string }; trip: { trackingCode: string };
}

interface Inspection {
  id: number; tripId: number; driverId: number;
  stage: Stage;
  data: Record<string, string>;
  remarks: string | null;
  odometerReading: number | null;
  fuelLevel: number | null;
  damageNotes: string | null;
  driverSignature: string | null;
  receiverName: string | null;
  receiverSignature: string | null;
  createdAt: string;
  driver: { id: number; name: string };
  trip: {
    id: number; trackingCode: string;
    fromLocation: string; toLocation: string;
    customerVehicleRegistration: string | null;
    customer: { name: string };
  };
  images: InspImage[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGES: { id: Stage; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'COLLECTION', label: 'Collection',     icon: MapPin,    color: 'blue'   },
  { id: 'WAREHOUSE',  label: 'Warehouse',       icon: Package,   color: 'purple' },
  { id: 'HANDOVER',   label: 'Driver Handover', icon: Truck,     color: 'yellow' },
  { id: 'DELIVERY',   label: 'Delivery',        icon: CheckCircle2, color: 'green' },
];

const stageBadge: Record<Stage, 'blue' | 'green' | 'yellow' | 'red'> = {
  COLLECTION: 'blue', WAREHOUSE: 'yellow', HANDOVER: 'yellow', DELIVERY: 'green',
};

const resultMeta: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  pass: { label: 'Pass', cls: 'text-green-600', icon: CheckCircle2 },
  fail: { label: 'Fail', cls: 'text-red-600',   icon: XCircle },
  na:   { label: 'N/A',  cls: 'text-gray-400',  icon: MinusCircle },
};

const FUEL_PRESETS = [
  { value: 0,   label: 'E' },
  { value: 25,  label: '¼' },
  { value: 50,  label: '½' },
  { value: 75,  label: '¾' },
  { value: 100, label: 'F' },
];

// ── SignaturePad sub-component ────────────────────────────────────────────────

function SigPad({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const ref = useRef<SignatureCanvas>(null);
  const clear = () => { ref.current?.clear(); onChange(''); };
  const capture = () => {
    if (ref.current && !ref.current.isEmpty()) {
      onChange(ref.current.toDataURL('image/png'));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Pen size={13} className="text-brand-600" />{label}
        </label>
        <button type="button" onClick={clear} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
      </div>
      {value ? (
        <div className="relative border rounded-xl overflow-hidden bg-gray-50">
          <img src={value} alt={label} className="w-full h-28 object-contain" />
          <button
            type="button"
            onClick={clear}
            className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-gray-400 hover:text-red-500"
          ><X size={14} /></button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
          <SignatureCanvas
            ref={ref}
            onEnd={capture}
            penColor="#1e293b"
            canvasProps={{ className: 'w-full', height: 110, style: { touchAction: 'none' } }}
          />
          <p className="text-center text-xs text-gray-400 pb-2">Draw signature above</p>
        </div>
      )}
    </div>
  );
}

// ── FuelGauge sub-component ───────────────────────────────────────────────────

function FuelGauge({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const pct = value ?? 0;
  const color = pct <= 20 ? 'bg-red-500' : pct <= 40 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
        <Gauge size={13} className="text-brand-600" /> Fuel Level
      </label>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-100 rounded-full h-3 relative overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-bold text-gray-700 w-10 text-right">{pct}%</span>
      </div>
      <div className="flex gap-2">
        {FUEL_PRESETS.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${value === p.value ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Photo upload helper ───────────────────────────────────────────────────────

function PhotoStrip({ inspectionId, tripId, driverId, images, onAdded }: {
  inspectionId?: number; tripId: number; driverId: number;
  images: InspImage[]; onAdded: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !inspectionId) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('tripId', String(tripId));
      fd.append('driverId', String(driverId));
      fd.append('inspectionId', String(inspectionId));
      await api.post('/inspections/images', fd);
    }
    setUploading(false);
    onAdded();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Camera size={13} className="text-brand-600" /> Photos ({images.length})
        </label>
        {inspectionId && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Add Photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          </>
        )}
        {!inspectionId && <span className="text-xs text-gray-400">Save inspection first to add photos</span>}
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map(img => (
            <a key={img.id} href={img.path} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-100 hover:opacity-80 transition-opacity">
              <img src={img.path} alt="Inspection" className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {images.length === 0 && (
        <div className="flex items-center justify-center h-16 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-xs gap-2">
          <ImageIcon size={14} /> No photos yet
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type FormStep = 'basic' | 'checklist' | 'condition' | 'signatures';

export default function InspectionsPage() {
  const qc = useQueryClient();
  const [stageFilter, setStageFilter] = useState<Stage | ''>('');
  const [tab, setTab] = useState<'list' | 'checklist'>('list');
  const [viewing, setViewing] = useState<Inspection | null>(null);

  // New inspection form
  const [formOpen, setFormOpen] = useState(false);
  const [step, setStep] = useState<FormStep>('basic');

  // Basic
  const [tripId,   setTripId]   = useState('');
  const [driverId, setDriverId] = useState('');
  const [stage,    setStage]    = useState<Stage>('COLLECTION');
  const [remarks,  setRemarks]  = useState('');
  // Checklist
  const [results, setResults] = useState<Record<number, string>>({});
  // Condition
  const [odometer,    setOdometer]    = useState('');
  const [fuelLevel,   setFuelLevel]   = useState<number | null>(null);
  const [damageNotes, setDamageNotes] = useState('');
  // Signatures
  const [driverSig,   setDriverSig]   = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverSig, setReceiverSig] = useState('');

  // Checklist tab
  const [addCatOpen,  setAddCatOpen]  = useState(false);
  const [addItemCat,  setAddItemCat]  = useState<number | null>(null);
  const [newCatName,  setNewCatName]  = useState('');
  const [newItemName, setNewItemName] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: categories = [] } = useQuery<InspCategory[]>({
    queryKey: ['inspection-categories'],
    queryFn: () => api.get('/inspections/categories').then(r => r.data),
  });

  const { data: inspections = [], isLoading } = useQuery<Inspection[]>({
    queryKey: ['inspections', stageFilter],
    queryFn: () => api.get('/inspections', { params: stageFilter ? { stage: stageFilter } : {} }).then(r => r.data),
  });

  const { data: trips = [] } = useQuery<{ id: number; trackingCode: string; fromLocation: string; toLocation: string; customerVehicleRegistration: string | null; customer: { name: string } }[]>({
    queryKey: ['trips-select'],
    queryFn: () => api.get('/trips').then(r => r.data.filter((t: any) => t.status !== 'CANCELLED')),
    enabled: formOpen,
  });

  const { data: drivers = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['drivers-select'],
    queryFn: () => api.get('/drivers').then(r => r.data.filter((d: any) => d.isActive)),
    enabled: formOpen,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inspections'] });
  };

  const createMut = useMutation({
    mutationFn: (payload: object) => api.post('/inspections', payload),
    onSuccess: (res) => {
      invalidate();
      setViewing(res.data);
      closeForm();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/inspections/${id}`),
    onSuccess: () => invalidate(),
  });

  const addCatMut = useMutation({
    mutationFn: (name: string) => api.post('/inspections/categories', { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inspection-categories'] }); setAddCatOpen(false); setNewCatName(''); },
  });

  const addItemMut = useMutation({
    mutationFn: ({ catId, name }: { catId: number; name: string }) => api.post(`/inspections/categories/${catId}/items`, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inspection-categories'] }); setAddItemCat(null); setNewItemName(''); },
  });

  const delCatMut  = useMutation({ mutationFn: (id: number) => api.delete(`/inspections/categories/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection-categories'] }) });
  const delItemMut = useMutation({ mutationFn: (id: number) => api.delete(`/inspections/items/${id}`),      onSuccess: () => qc.invalidateQueries({ queryKey: ['inspection-categories'] }) });

  // ── Form helpers ───────────────────────────────────────────────────────────

  const allItems = categories.flatMap(c => c.items);

  const openForm = (defaultStage?: Stage) => {
    setStep('basic');
    setTripId(''); setDriverId('');
    setStage(defaultStage ?? 'COLLECTION');
    setRemarks('');
    setResults(Object.fromEntries(allItems.map(i => [i.id, 'pass'])));
    setOdometer(''); setFuelLevel(null); setDamageNotes('');
    setDriverSig(''); setReceiverName(''); setReceiverSig('');
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); };

  const handleSubmit = () => {
    createMut.mutate({
      tripId:          Number(tripId),
      driverId:        Number(driverId),
      stage,
      data:            results,
      remarks:         remarks || undefined,
      odometerReading: odometer ? Number(odometer) : undefined,
      fuelLevel:       fuelLevel ?? undefined,
      damageNotes:     damageNotes || undefined,
      driverSignature:  driverSig || undefined,
      receiverName:     receiverName || undefined,
      receiverSignature: receiverSig || undefined,
    });
  };

  const reloadViewing = useCallback(() => {
    if (!viewing) return;
    api.get(`/inspections/${viewing.id}`).then(r => setViewing(r.data));
  }, [viewing]);

  const STEPS: { id: FormStep; label: string }[] = [
    { id: 'basic',      label: 'Basic Info' },
    { id: 'checklist',  label: 'Checklist' },
    { id: 'condition',  label: 'Condition' },
    { id: 'signatures', label: 'Signatures' },
  ];

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const canNext = step === 'basic' ? (!!tripId && !!driverId) : true;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTab(tab === 'list' ? 'checklist' : 'list')}
            className="flex items-center gap-2 px-4 py-2 border text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            <Settings size={16} /> {tab === 'list' ? 'Manage Checklist' : 'View Inspections'}
          </button>
          {tab === 'list' && (
            <button
              onClick={() => openForm()}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              <Plus size={16} /> New Inspection
            </button>
          )}
        </div>
      </div>

      {/* Stage filter tabs */}
      {tab === 'list' && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStageFilter('')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${stageFilter === '' ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600 hover:border-brand-500'}`}
          >
            All Stages
          </button>
          {STAGES.map(s => (
            <button
              key={s.id}
              onClick={() => setStageFilter(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${stageFilter === s.id ? 'bg-brand-600 text-white' : 'bg-white border text-gray-600 hover:border-brand-500'}`}
            >
              <s.icon size={13} /> {s.label}
              <button
                onClick={e => { e.stopPropagation(); openForm(s.id); }}
                className="ml-1 text-current opacity-60 hover:opacity-100"
              ><Plus size={11} /></button>
            </button>
          ))}
        </div>
      )}

      {/* ── INSPECTIONS LIST ─────────────────────────────────── */}
      {tab === 'list' && (
        isLoading ? (
          <div className="flex flex-col justify-center h-40 items-center gap-2"><Loader2 className="animate-spin text-brand-600" size={28} /><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Stage</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Vehicle</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Driver</th>
                    <th className="px-4 py-3 text-left">Odometer</th>
                    <th className="px-4 py-3 text-left">Fuel</th>
                    <th className="px-4 py-3 text-left">Result</th>
                    <th className="px-4 py-3 text-left">Sigs</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inspections.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">No inspections yet.</td></tr>
                  ) : inspections.map(ins => {
                    const data     = ins.data || {};
                    const fails    = Object.values(data).filter(v => v === 'fail').length;
                    const stageObj = STAGES.find(s => s.id === ins.stage);
                    const hasDmg   = !!ins.damageNotes;
                    const sigs     = [ins.driverSignature, ins.receiverSignature].filter(Boolean).length;

                    return (
                      <tr key={ins.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Badge label={stageObj?.label ?? ins.stage} variant={stageBadge[ins.stage] ?? 'blue'} />
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(ins.createdAt), 'dd MMM yyyy')}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{ins.trip?.customerVehicleRegistration ?? '—'}</p>
                          <p className="text-xs text-gray-400 font-mono">{ins.trip?.trackingCode?.slice(0, 8)}…</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{ins.trip?.customer?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{ins.driver?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{ins.odometerReading != null ? `${ins.odometerReading.toLocaleString()} km` : '—'}</td>
                        <td className="px-4 py-3">
                          {ins.fuelLevel != null ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 bg-gray-100 rounded-full h-1.5">
                                <div className={`h-full rounded-full ${ins.fuelLevel <= 20 ? 'bg-red-500' : ins.fuelLevel <= 40 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${ins.fuelLevel}%` }} />
                              </div>
                              <span className="text-xs text-gray-500">{ins.fuelLevel}%</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-medium ${fails > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {fails > 0 ? `${fails} fail${fails !== 1 ? 's' : ''}` : 'Pass'}
                            </span>
                            {hasDmg && <span title="Damage noted"><AlertTriangle size={12} className="text-orange-500" /></span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{sigs}/2</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setViewing(ins)} className="p-1.5 text-gray-400 hover:text-brand-600"><Eye size={15} /></button>
                            <button onClick={() => { if (confirm('Delete this inspection?')) deleteMut.mutate(ins.id); }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── CHECKLIST MANAGER ────────────────────────────────── */}
      {tab === 'checklist' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setAddCatOpen(true)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
              <Plus size={16} /> Add Category
            </button>
          </div>
          {categories.length === 0 && (
            <div className="bg-white rounded-xl border p-12 text-center text-gray-400">No categories yet.</div>
          )}
          {categories.map(cat => (
            <div key={cat.id} className="bg-white rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b">
                <p className="font-semibold text-gray-900">{cat.name}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAddItemCat(cat.id)} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"><PlusCircle size={13} /> Add item</button>
                  <button onClick={() => { if (confirm(`Delete "${cat.name}"?`)) delCatMut.mutate(cat.id); }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="divide-y">
                {cat.items.length === 0
                  ? <p className="px-5 py-3 text-sm text-gray-400 italic">No items yet.</p>
                  : cat.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-sm text-gray-700">{item.name}</span>
                      <button onClick={() => { if (confirm(`Delete "${item.name}"?`)) delItemMut.mutate(item.id); }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── NEW INSPECTION MODAL ─────────────────────────────── */}
      <Modal title="New Inspection" open={formOpen} onClose={closeForm} width="max-w-2xl">
        {/* Step breadcrumb */}
        <div className="flex items-center gap-1 mb-6 -mt-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => i < stepIndex ? setStep(s.id) : undefined}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${step === s.id ? 'bg-brand-600 text-white' : i < stepIndex ? 'bg-brand-100 text-brand-700 hover:bg-brand-200 cursor-pointer' : 'text-gray-400'}`}
              >
                <span className="w-4 h-4 rounded-full bg-current opacity-20 absolute" />
                {i + 1}. {s.label}
              </button>
              {i < STEPS.length - 1 && <ChevronRight size={13} className="text-gray-300 shrink-0" />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Basic Info ──────────────────────────────── */}
        {step === 'basic' && (
          <div className="space-y-4">
            {/* Stage selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Inspection Stage *</label>
              <div className="grid grid-cols-2 gap-2">
                {STAGES.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStage(s.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left ${stage === s.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    <s.icon size={15} /> {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trip / Booking *</label>
                <select value={tripId} onChange={e => setTripId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select trip</option>
                  {trips.map(t => (
                    <option key={t.id} value={t.id}>
                      #{t.id} — {t.customer?.name ?? ''}{t.customerVehicleRegistration ? ` · ${t.customerVehicleRegistration}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver / Inspector *</label>
                <select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select driver</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" placeholder="Optional remarks…" />
            </div>
          </div>
        )}

        {/* ── Step 2: Checklist ───────────────────────────────── */}
        {step === 'checklist' && (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            {categories.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No checklist items. Add categories in the Checklist tab.</p>
            )}
            {categories.map(cat => (
              <div key={cat.id}>
                <p className="text-sm font-semibold text-gray-700 mb-2">{cat.name}</p>
                <div className="space-y-1.5">
                  {cat.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-700">{item.name}</span>
                      <div className="flex gap-1.5">
                        {(['pass', 'fail', 'na'] as const).map(r => {
                          const m = resultMeta[r]; const active = results[item.id] === r;
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setResults(p => ({ ...p, [item.id]: r }))}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${active ? `${m.cls} bg-white border-current` : 'text-gray-400 border-transparent hover:border-gray-300'}`}
                            >
                              <m.icon size={12} />{m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Step 3: Vehicle Condition ────────────────────────── */}
        {step === 'condition' && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Gauge size={13} className="text-brand-600" /> Odometer Reading (km)
              </label>
              <input
                type="number"
                value={odometer}
                onChange={e => setOdometer(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="e.g. 52340"
              />
            </div>

            <FuelGauge value={fuelLevel} onChange={setFuelLevel} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-orange-500" /> Damage Report
              </label>
              <textarea
                value={damageNotes}
                onChange={e => setDamageNotes(e.target.value)}
                rows={4}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                placeholder="Describe any visible damage, scratches, dents or defects…"
              />
            </div>
          </div>
        )}

        {/* ── Step 4: Signatures ───────────────────────────────── */}
        {step === 'signatures' && (
          <div className="space-y-5">
            <SigPad label="Driver Signature" value={driverSig} onChange={setDriverSig} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <User size={13} className="text-brand-600" /> Receiver / Customer Name
              </label>
              <input
                value={receiverName}
                onChange={e => setReceiverName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Name of person receiving the vehicle"
              />
            </div>

            <SigPad label="Receiver Signature" value={receiverSig} onChange={setReceiverSig} />
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

          {step !== 'signatures' ? (
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
              disabled={createMut.isPending}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50"
            >
              {createMut.isPending && <Loader2 className="animate-spin" size={15} />}
              Save Inspection
            </button>
          )}
        </div>
      </Modal>

      {/* ── ADD CATEGORY MODAL ───────────────────────────────── */}
      <Modal title="Add Category" open={addCatOpen} onClose={() => setAddCatOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
            <input value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Engine" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAddCatOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={() => addCatMut.mutate(newCatName)} disabled={!newCatName.trim() || addCatMut.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {addCatMut.isPending ? 'Adding…' : 'Add Category'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── ADD ITEM MODAL ───────────────────────────────────── */}
      <Modal title="Add Inspection Item" open={addItemCat !== null} onClose={() => setAddItemCat(null)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
            <input value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="e.g. Oil level" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAddItemCat(null)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={() => addItemMut.mutate({ catId: addItemCat!, name: newItemName })} disabled={!newItemName.trim() || addItemMut.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {addItemMut.isPending ? 'Adding…' : 'Add Item'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── VIEW INSPECTION MODAL ────────────────────────────── */}
      {viewing && (
        <Modal title={`Inspection — ${viewing.stage.charAt(0) + viewing.stage.slice(1).toLowerCase()} Stage`} open={!!viewing} onClose={() => setViewing(null)} width="max-w-3xl">
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1 text-sm">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4">
              <div><p className="text-gray-400 text-xs">Stage</p><Badge label={STAGES.find(s => s.id === viewing.stage)?.label ?? viewing.stage} variant={stageBadge[viewing.stage]} /></div>
              <div><p className="text-gray-400 text-xs">Date</p><p className="font-medium">{format(new Date(viewing.createdAt), 'dd MMM yyyy HH:mm')}</p></div>
              <div><p className="text-gray-400 text-xs">Vehicle</p><p className="font-medium">{viewing.trip?.customerVehicleRegistration ?? '—'}</p></div>
              <div><p className="text-gray-400 text-xs">Customer</p><p className="font-medium">{viewing.trip?.customer?.name ?? '—'}</p></div>
              <div><p className="text-gray-400 text-xs">Driver</p><p className="font-medium">{viewing.driver?.name ?? '—'}</p></div>
              <div><p className="text-gray-400 text-xs">Route</p><p className="font-medium">{viewing.trip?.fromLocation ?? '—'} → {viewing.trip?.toLocation ?? '—'}</p></div>
              {viewing.odometerReading != null && (
                <div><p className="text-gray-400 text-xs">Odometer</p><p className="font-medium">{viewing.odometerReading.toLocaleString()} km</p></div>
              )}
              {viewing.fuelLevel != null && (
                <div>
                  <p className="text-gray-400 text-xs">Fuel Level</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full ${viewing.fuelLevel <= 20 ? 'bg-red-500' : viewing.fuelLevel <= 40 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${viewing.fuelLevel}%` }} />
                    </div>
                    <span className="font-medium">{viewing.fuelLevel}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Checklist results */}
            {categories.map(cat => {
              const catItems = cat.items.filter(i => viewing.data[i.id]);
              if (!catItems.length) return null;
              return (
                <div key={cat.id}>
                  <p className="font-semibold text-gray-700 mb-2">{cat.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {catItems.map(item => {
                      const r = viewing.data[item.id] || 'pass';
                      const m = resultMeta[r] ?? resultMeta.pass;
                      return (
                        <div key={item.id} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-700">{item.name}</span>
                          <span className={`flex items-center gap-1 text-xs font-medium ${m.cls}`}><m.icon size={12} />{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Damage */}
            {viewing.damageNotes && (
              <div>
                <p className="font-semibold text-orange-700 flex items-center gap-1.5 mb-1"><AlertTriangle size={13} /> Damage Notes</p>
                <p className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-gray-700">{viewing.damageNotes}</p>
              </div>
            )}

            {/* Remarks */}
            {viewing.remarks && (
              <div>
                <p className="text-gray-400 text-xs mb-1">Remarks</p>
                <p className="bg-gray-50 rounded-lg p-3 text-gray-700">{viewing.remarks}</p>
              </div>
            )}

            {/* Photos */}
            <PhotoStrip
              inspectionId={viewing.id}
              tripId={viewing.tripId}
              driverId={viewing.driverId}
              images={viewing.images}
              onAdded={reloadViewing}
            />

            {/* Signatures */}
            {(viewing.driverSignature || viewing.receiverSignature) && (
              <div className="grid grid-cols-2 gap-4">
                {viewing.driverSignature && (
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Driver Signature</p>
                    <img src={viewing.driverSignature} alt="Driver signature" className="border rounded-xl bg-white p-2 w-full h-28 object-contain" />
                  </div>
                )}
                {viewing.receiverSignature && (
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Receiver Signature {viewing.receiverName ? `— ${viewing.receiverName}` : ''}</p>
                    <img src={viewing.receiverSignature} alt="Receiver signature" className="border rounded-xl bg-white p-2 w-full h-28 object-contain" />
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
