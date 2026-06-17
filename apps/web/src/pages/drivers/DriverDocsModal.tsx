import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState, useRef } from 'react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { format, differenceInDays, parseISO } from 'date-fns';
import {
  Upload, Trash2, ExternalLink, Plus, Pencil, Loader2, X,
  FileText, User, PhoneCall, AlertOctagon, ShieldAlert,
  CheckCircle, AlertTriangle,
} from 'lucide-react';

/* ── types ─────────────────────────────────────────────── */

interface DriverDocument {
  id: number;
  type: string;
  label: string | null;
  filename: string;
  path: string;
  expiryDate: string | null;
  notes: string | null;
  createdAt: string;
}

interface DriverContact {
  id: number;
  name: string;
  relationship: string;
  phone: string;
  altPhone: string | null;
  email: string | null;
  address: string | null;
  isPrimary: boolean;
}

interface DriverIncident {
  id: number;
  incidentDate: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface DriverWarning {
  id: number;
  warningDate: string;
  type: string;
  reason: string;
  description: string;
  issuedBy: string;
  acknowledged: boolean;
  notes: string | null;
  createdAt: string;
}

interface DriverProfile {
  id: number;
  name: string;
  email: string;
  mobile: string;
  licenseNo: string;
  licenseExpiry: string | null;
  isActive: boolean;
  assignedVehicle: { id: number; name: string; registrationNo: string } | null;
  documents: DriverDocument[];
  emergencyContacts: DriverContact[];
  incidents: DriverIncident[];
  warnings: DriverWarning[];
}

/* ── constants ──────────────────────────────────────────── */

const DOC_TYPES = [
  { value: 'DRIVER_LICENSE',      label: 'Driver License',                hasExpiry: true  },
  { value: 'PDP',                 label: 'PDP (Professional Driving Permit)', hasExpiry: true  },
  { value: 'PASSPORT',            label: 'Passport',                      hasExpiry: true  },
  { value: 'WORK_PERMIT',         label: 'Work Permit',                   hasExpiry: true  },
  { value: 'DRIVER_PHOTO',        label: 'Driver Photo',                  hasExpiry: false },
  { value: 'EMPLOYMENT_CONTRACT', label: 'Employment Contract',           hasExpiry: false },
  { value: 'OTHER',               label: 'Other',                         hasExpiry: false },
];

const SEVERITY_OPTS   = ['MINOR', 'MODERATE', 'MAJOR'];
const INCIDENT_STATUS = ['OPEN', 'UNDER_INVESTIGATION', 'CLOSED'];
const WARNING_TYPES   = ['VERBAL', 'WRITTEN', 'FINAL'];

/* ── helpers ────────────────────────────────────────────── */

const safeDate = (v: string | null | undefined, fmt = 'dd MMM yyyy') =>
  v ? format(parseISO(v), fmt) : '—';

const getExpiryInfo = (expiryDate: string | null): {
  label: string; variant: 'green' | 'yellow' | 'red' | 'gray'; days: number | null;
} => {
  if (!expiryDate) return { label: 'No expiry', variant: 'gray', days: null };
  const days = differenceInDays(parseISO(expiryDate), new Date());
  if (days < 0)   return { label: `Expired ${Math.abs(days)}d ago`, variant: 'red',    days };
  if (days <= 30) return { label: `Expires in ${days}d`,            variant: 'red',    days };
  if (days <= 90) return { label: `Expires in ${days}d`,            variant: 'yellow', days };
  return { label: format(parseISO(expiryDate), 'dd MMM yyyy'),      variant: 'green',  days };
};

const severityVariant = (s: string): 'red' | 'yellow' | 'gray' =>
  s === 'MAJOR' ? 'red' : s === 'MODERATE' ? 'yellow' : 'gray';

const warningVariant = (t: string): 'red' | 'yellow' | 'gray' =>
  t === 'FINAL' ? 'red' : t === 'WRITTEN' ? 'yellow' : 'gray';

const docTypeLabel = (type: string) =>
  DOC_TYPES.find(d => d.value === type)?.label ?? type;

/* ── sub-components ─────────────────────────────────────── */

type TabId = 'documents' | 'contacts' | 'incidents' | 'warnings';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'documents', label: 'Documents',         icon: FileText    },
  { id: 'contacts',  label: 'Emergency Contacts', icon: PhoneCall   },
  { id: 'incidents', label: 'Incidents',          icon: AlertOctagon },
  { id: 'warnings',  label: 'Written Warnings',   icon: ShieldAlert  },
];

/* ── documents tab ──────────────────────────────────────── */

function DocumentsTab({ driverId, docs, onRefresh }: {
  driverId: number;
  docs: DriverDocument[];
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [form, setForm] = useState({ type: 'DRIVER_LICENSE', label: '', expiryDate: '', notes: '' });
  const [showForm, setShowForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const selectedType = DOC_TYPES.find(d => d.value === form.type);

  const handleUpload = async () => {
    if (!selectedFile) { setUploadErr('Please select a file'); return; }
    setUploadErr('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('type', form.type);
      if (form.label)      fd.append('label', form.label);
      if (form.expiryDate) fd.append('expiryDate', form.expiryDate);
      if (form.notes)      fd.append('notes', form.notes);
      await api.post(`/driver-docs/drivers/${driverId}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      qc.invalidateQueries({ queryKey: ['driver-profile', driverId] });
      onRefresh();
      setShowForm(false);
      setSelectedFile(null);
      setForm({ type: 'DRIVER_LICENSE', label: '', expiryDate: '', notes: '' });
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      setUploadErr(e.response?.data?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/driver-docs/documents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-profile', driverId] });
      onRefresh();
    },
  });

  // Compliance summary
  const withExpiry = docs.filter(d => d.expiryDate);
  const expired    = withExpiry.filter(d => differenceInDays(parseISO(d.expiryDate!), new Date()) < 0).length;
  const expiring   = withExpiry.filter(d => { const n = differenceInDays(parseISO(d.expiryDate!), new Date()); return n >= 0 && n <= 30; }).length;
  const valid      = withExpiry.filter(d => differenceInDays(parseISO(d.expiryDate!), new Date()) > 30).length;

  // Profile photo (most recent DRIVER_PHOTO)
  const photo = docs.find(d => d.type === 'DRIVER_PHOTO');

  return (
    <div className="space-y-4">
      {/* compliance pills */}
      {withExpiry.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {expired  > 0 && <span className="inline-flex items-center gap-1.5 text-xs bg-red-50 text-red-700 px-3 py-1 rounded-full font-medium"><AlertTriangle size={12}/>{expired} Expired</span>}
          {expiring > 0 && <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-medium"><AlertTriangle size={12}/>{expiring} Expiring Soon</span>}
          {valid    > 0 && <span className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium"><CheckCircle size={12}/>{valid} Valid</span>}
        </div>
      )}

      {/* profile photo */}
      {photo && (
        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border">
          <img src={`http://localhost:3000${photo.path}`} alt="Driver Photo"
            className="h-16 w-16 object-cover rounded-full border-2 border-white shadow" />
          <div>
            <p className="text-xs font-medium text-gray-700">Driver Photo</p>
            <p className="text-xs text-gray-500">Uploaded {safeDate(photo.createdAt)}</p>
          </div>
          <a href={`http://localhost:3000${photo.path}`} target="_blank" rel="noreferrer"
            className="ml-auto p-1.5 text-gray-400 hover:text-brand-600">
            <ExternalLink size={15}/>
          </a>
        </div>
      )}

      {/* document grid */}
      {docs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No documents uploaded yet.</p>
      ) : (
        <div className="grid gap-2">
          {docs.map(doc => {
            const expiry = getExpiryInfo(doc.expiryDate);
            return (
              <div key={doc.id} className="flex items-center gap-3 border rounded-lg px-3 py-2.5 bg-white hover:bg-gray-50">
                <FileText size={18} className="text-gray-400 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {doc.label || docTypeLabel(doc.type)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{doc.filename}</p>
                </div>
                {doc.expiryDate && (
                  <Badge label={expiry.label} variant={expiry.variant}/>
                )}
                <a href={`http://localhost:3000${doc.path}`} target="_blank" rel="noreferrer"
                  className="p-1 text-gray-400 hover:text-brand-600 shrink-0">
                  <ExternalLink size={15}/>
                </a>
                <button onClick={() => { if (confirm('Delete this document?')) deleteMut.mutate(doc.id); }}
                  className="p-1 text-gray-400 hover:text-red-500 shrink-0">
                  <Trash2 size={15}/>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* upload form */}
      {showForm ? (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-gray-700">Upload Document</p>
            <button onClick={() => { setShowForm(false); setSelectedFile(null); setUploadErr(''); }}
              className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Document Type *</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Custom Label</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. License Front"
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
            {selectedType?.hasExpiry && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
                <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes"
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">File *</label>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file"
                accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
                onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"/>
            </div>
            {selectedFile && <p className="text-xs text-gray-500 mt-1">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)</p>}
          </div>

          {uploadErr && <p className="text-xs text-red-600">{uploadErr}</p>}

          <div className="flex gap-2">
            <button onClick={handleUpload} disabled={uploading}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-60">
              {uploading ? <Loader2 size={13} className="animate-spin"/> : <Upload size={13}/>}
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
          <Upload size={15}/> Upload Document
        </button>
      )}
    </div>
  );
}

/* ── contacts tab ───────────────────────────────────────── */

function ContactsTab({ driverId, contacts, onRefresh }: {
  driverId: number;
  contacts: DriverContact[];
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const blank = { name: '', relationship: '', phone: '', altPhone: '', email: '', address: '', isPrimary: false };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState('');

  const saveMut = useMutation({
    mutationFn: () => editId
      ? api.patch(`/driver-docs/contacts/${editId}`, form)
      : api.post(`/driver-docs/drivers/${driverId}/contacts`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-profile', driverId] });
      onRefresh();
      setShowForm(false); setEditId(null); setForm(blank); setErr('');
    },
    onError: (e: any) => setErr(e.response?.data?.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/driver-docs/contacts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-profile', driverId] });
      onRefresh();
    },
  });

  const openEdit = (c: DriverContact) => {
    setForm({ name: c.name, relationship: c.relationship, phone: c.phone,
      altPhone: c.altPhone ?? '', email: c.email ?? '', address: c.address ?? '', isPrimary: c.isPrimary });
    setEditId(c.id); setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {contacts.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No emergency contacts on record.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map(c => (
            <div key={c.id} className="border rounded-lg px-3 py-3 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                    {c.isPrimary && <Badge label="Primary" variant="blue"/>}
                  </div>
                  <p className="text-xs text-gray-500">{c.relationship} · {c.phone}</p>
                  {c.altPhone && <p className="text-xs text-gray-400">Alt: {c.altPhone}</p>}
                  {c.email    && <p className="text-xs text-gray-400">{c.email}</p>}
                  {c.address  && <p className="text-xs text-gray-400">{c.address}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1 text-gray-400 hover:text-brand-600"><Pencil size={14}/></button>
                  <button onClick={() => { if (confirm(`Remove contact "${c.name}"?`)) deleteMut.mutate(c.id); }}
                    className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-gray-700">{editId ? 'Edit Contact' : 'Add Emergency Contact'}</p>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(blank); setErr(''); }}
              className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Name *',         field: 'name',         placeholder: 'Full name' },
              { label: 'Relationship *', field: 'relationship', placeholder: 'e.g. Spouse, Sibling' },
              { label: 'Phone *',        field: 'phone',        placeholder: '+27 82 000 0000' },
              { label: 'Alt Phone',      field: 'altPhone',     placeholder: '' },
              { label: 'Email',          field: 'email',        placeholder: '' },
            ].map(({ label, field, placeholder }) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input value={(form as any)[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
              <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                rows={2}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isPrimary" checked={form.isPrimary}
              onChange={e => setForm(f => ({ ...f, isPrimary: e.target.checked }))} className="rounded"/>
            <label htmlFor="isPrimary" className="text-xs text-gray-600">Set as primary contact</label>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name || !form.phone || !form.relationship}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-60">
            {saveMut.isPending ? <Loader2 size={13} className="animate-spin"/> : null}
            {editId ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
          <Plus size={15}/> Add Contact
        </button>
      )}
    </div>
  );
}

/* ── incidents tab ──────────────────────────────────────── */

function IncidentsTab({ driverId, incidents, onRefresh }: {
  driverId: number;
  incidents: DriverIncident[];
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const blank = { incidentDate: '', title: '', description: '', severity: 'MINOR', status: 'OPEN', notes: '' };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState('');

  const saveMut = useMutation({
    mutationFn: () => editId
      ? api.patch(`/driver-docs/incidents/${editId}`, form)
      : api.post(`/driver-docs/drivers/${driverId}/incidents`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-profile', driverId] });
      onRefresh();
      setShowForm(false); setEditId(null); setForm(blank); setErr('');
    },
    onError: (e: any) => setErr(e.response?.data?.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/driver-docs/incidents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['driver-profile', driverId] }); onRefresh(); },
  });

  const openEdit = (inc: DriverIncident) => {
    setForm({ incidentDate: inc.incidentDate.split('T')[0], title: inc.title,
      description: inc.description, severity: inc.severity, status: inc.status, notes: inc.notes ?? '' });
    setEditId(inc.id); setShowForm(true);
  };

  const statusLabel = (s: string) => s.replace('_', ' ');

  return (
    <div className="space-y-4">
      {incidents.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No incidents on record.</p>
      ) : (
        <div className="space-y-2">
          {incidents.map(inc => (
            <div key={inc.id} className="border rounded-lg px-3 py-3 bg-white">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800">{inc.title}</p>
                    <Badge label={inc.severity} variant={severityVariant(inc.severity)}/>
                    <Badge label={statusLabel(inc.status)} variant={inc.status === 'CLOSED' ? 'green' : inc.status === 'UNDER_INVESTIGATION' ? 'yellow' : 'gray'}/>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{safeDate(inc.incidentDate)}</p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{inc.description}</p>
                </div>
                <div className="flex gap-1 ml-2 shrink-0">
                  <button onClick={() => openEdit(inc)} className="p-1 text-gray-400 hover:text-brand-600"><Pencil size={14}/></button>
                  <button onClick={() => { if (confirm('Delete this incident?')) deleteMut.mutate(inc.id); }}
                    className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-gray-700">{editId ? 'Edit Incident' : 'Log Incident'}</p>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(blank); setErr(''); }}
              className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Incident Date *</label>
              <input type="date" value={form.incidentDate} onChange={e => setForm(f => ({ ...f, incidentDate: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Brief title"
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Severity</label>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                {SEVERITY_OPTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                {INCIDENT_STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} placeholder="What happened?"
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.incidentDate || !form.title || !form.description}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-60">
            {saveMut.isPending ? <Loader2 size={13} className="animate-spin"/> : null}
            {editId ? 'Save Changes' : 'Log Incident'}
          </button>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
          <Plus size={15}/> Log Incident
        </button>
      )}
    </div>
  );
}

/* ── warnings tab ───────────────────────────────────────── */

function WarningsTab({ driverId, warnings, onRefresh }: {
  driverId: number;
  warnings: DriverWarning[];
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const blank = { warningDate: '', type: 'WRITTEN', reason: '', description: '', issuedBy: '', acknowledged: false, notes: '' };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState('');

  const saveMut = useMutation({
    mutationFn: () => editId
      ? api.patch(`/driver-docs/warnings/${editId}`, form)
      : api.post(`/driver-docs/drivers/${driverId}/warnings`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-profile', driverId] });
      onRefresh();
      setShowForm(false); setEditId(null); setForm(blank); setErr('');
    },
    onError: (e: any) => setErr(e.response?.data?.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/driver-docs/warnings/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['driver-profile', driverId] }); onRefresh(); },
  });

  const openEdit = (w: DriverWarning) => {
    setForm({ warningDate: w.warningDate.split('T')[0], type: w.type, reason: w.reason,
      description: w.description, issuedBy: w.issuedBy, acknowledged: w.acknowledged, notes: w.notes ?? '' });
    setEditId(w.id); setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {warnings.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No written warnings on record.</p>
      ) : (
        <div className="space-y-2">
          {warnings.map(w => (
            <div key={w.id} className="border rounded-lg px-3 py-3 bg-white">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800">{w.reason}</p>
                    <Badge label={w.type} variant={warningVariant(w.type)}/>
                    {w.acknowledged && <Badge label="Acknowledged" variant="green"/>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{safeDate(w.warningDate)} · Issued by {w.issuedBy}</p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{w.description}</p>
                </div>
                <div className="flex gap-1 ml-2 shrink-0">
                  <button onClick={() => openEdit(w)} className="p-1 text-gray-400 hover:text-brand-600"><Pencil size={14}/></button>
                  <button onClick={() => { if (confirm('Delete this warning?')) deleteMut.mutate(w.id); }}
                    className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-gray-700">{editId ? 'Edit Warning' : 'Issue Warning'}</p>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(blank); setErr(''); }}
              className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input type="date" value={form.warningDate} onChange={e => setForm(f => ({ ...f, warningDate: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Warning Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                {WARNING_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason *</label>
              <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Brief reason"
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Issued By *</label>
              <input value={form.issuedBy} onChange={e => setForm(f => ({ ...f, issuedBy: e.target.value }))}
                placeholder="Manager name"
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} placeholder="Details of the warning"
              className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"/>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="acknowledged" checked={form.acknowledged}
              onChange={e => setForm(f => ({ ...f, acknowledged: e.target.checked }))} className="rounded"/>
            <label htmlFor="acknowledged" className="text-xs text-gray-600">Driver has acknowledged this warning</label>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.warningDate || !form.reason || !form.description || !form.issuedBy}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-60">
            {saveMut.isPending ? <Loader2 size={13} className="animate-spin"/> : null}
            {editId ? 'Save Changes' : 'Issue Warning'}
          </button>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium">
          <Plus size={15}/> Issue Warning
        </button>
      )}
    </div>
  );
}

/* ── main modal ─────────────────────────────────────────── */

export default function DriverDocsModal({ driverId, open, onClose }: {
  driverId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('documents');

  const { data: profile, isLoading, isError, refetch } = useQuery<DriverProfile>({
    queryKey: ['driver-profile', driverId],
    queryFn: () => api.get(`/driver-docs/profile/${driverId}`).then(r => r.data),
    enabled: open && driverId !== null,
  });

  const photo = profile?.documents.find(d => d.type === 'DRIVER_PHOTO');
  const docsWithExpiry = profile?.documents.filter(d => d.expiryDate) ?? [];
  const alertCount = docsWithExpiry.filter(d => differenceInDays(parseISO(d.expiryDate!), new Date()) <= 30).length;

  return (
    <Modal title="Driver Profile" open={open} onClose={onClose} width="max-w-3xl">
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-brand-600"/>
        </div>
      )}
      {isError && (
        <p className="text-sm text-red-600 py-6 text-center">Failed to load driver profile.</p>
      )}
      {profile && (
        <div className="space-y-4 -mt-2">
          {/* header */}
          <div className="flex items-center gap-4 pb-4 border-b">
            {photo ? (
              <img src={`http://localhost:3000${photo.path}`} alt={profile.name}
                className="h-14 w-14 rounded-full object-cover border-2 border-brand-100 shrink-0"/>
            ) : (
              <div className="h-14 w-14 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                <User size={22} className="text-brand-600"/>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">{profile.name}</h2>
                <Badge label={profile.isActive ? 'Active' : 'Inactive'} variant={profile.isActive ? 'green' : 'red'}/>
                {alertCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    <AlertTriangle size={11}/>{alertCount} doc alert{alertCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate">{profile.email} · {profile.mobile}</p>
              <p className="text-xs text-gray-400">License: {profile.licenseNo}
                {profile.licenseExpiry && ` · Exp ${safeDate(profile.licenseExpiry)}`}
              </p>
            </div>
          </div>

          {/* tabs */}
          <div className="flex gap-1 border-b -mx-1 px-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const badge = tab.id === 'documents' ? alertCount
                : tab.id === 'incidents' ? profile.incidents.filter(i => i.status === 'OPEN').length
                : tab.id === 'warnings' ? profile.warnings.filter(w => !w.acknowledged).length
                : 0;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-brand-600 text-brand-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  <Icon size={13}/>
                  {tab.label}
                  {badge > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* tab content */}
          <div className="min-h-[300px]">
            {activeTab === 'documents' && (
              <DocumentsTab driverId={driverId!} docs={profile.documents} onRefresh={() => refetch()}/>
            )}
            {activeTab === 'contacts' && (
              <ContactsTab driverId={driverId!} contacts={profile.emergencyContacts} onRefresh={() => refetch()}/>
            )}
            {activeTab === 'incidents' && (
              <IncidentsTab driverId={driverId!} incidents={profile.incidents} onRefresh={() => refetch()}/>
            )}
            {activeTab === 'warnings' && (
              <WarningsTab driverId={driverId!} warnings={profile.warnings} onRefresh={() => refetch()}/>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
