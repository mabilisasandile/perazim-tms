import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, AlertCircle, Save, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';

/* ── types ──────────────────────────────────────────── */

interface Settings {
  id: number;
  companyName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  vat: number;
  currency: string;
  googleApiKey: string | null;
}

interface SmtpSettings {
  id: number;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  replyTo: string | null;
}

/* ── schemas ────────────────────────────────────────── */

const companySchema = z.object({
  companyName:  z.string().min(1, 'Company name required'),
  phone:        z.string().optional(),
  email:        z.string().email('Valid email required').optional().or(z.literal('')),
  address:      z.string().optional(),
  website:      z.string().optional(),
  vat:          z.coerce.number().min(0).max(100),
  currency:     z.string().min(1),
  googleApiKey: z.string().optional(),
});

const smtpSchema = z.object({
  host:      z.string().min(1, 'SMTP host required'),
  port:      z.coerce.number().int().positive(),
  secure:    z.boolean().default(false),
  username:  z.string().min(1, 'Username required'),
  password:  z.string().min(1, 'Password required'),
  fromEmail: z.string().email('Valid from email required'),
  replyTo:   z.string().optional(),
});

type CompanyForm = z.infer<typeof companySchema>;
type SmtpForm    = z.infer<typeof smtpSchema>;

/* ── shared input class (module-level so nested components can use it) ── */
const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

/* ── sub-components ─────────────────────────────────── */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border">
      <div className="px-6 py-4 border-b">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ── main component ─────────────────────────────────── */

export default function SettingsPage() {
  const qc = useQueryClient();
  const [companySaved, setCompanySaved] = useState(false);
  const [smtpSaved, setSmtpSaved] = useState(false);

  const { data: settings, isLoading: loadingSettings } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  });

  const { data: smtp, isLoading: loadingSmtp } = useQuery<SmtpSettings | null>({
    queryKey: ['smtp-settings'],
    // FIX: catch errors gracefully and return null to avoid query going to error state
    queryFn: () => api.get('/settings/smtp').then(r => r.data).catch(() => null),
  });

  const companyForm = useForm<CompanyForm>({ resolver: zodResolver(companySchema) });
  const smtpForm    = useForm<SmtpForm>({ resolver: zodResolver(smtpSchema) });

  useEffect(() => {
    if (settings) {
      companyForm.reset({
        companyName:  settings.companyName,
        phone:        settings.phone ?? '',
        email:        settings.email ?? '',
        address:      settings.address ?? '',
        website:      settings.website ?? '',
        vat:          settings.vat ?? 0,
        currency:     settings.currency ?? 'ZAR',
        googleApiKey: settings.googleApiKey ?? '',
      });
    }
  }, [settings]);

  useEffect(() => {
    if (smtp) {
      smtpForm.reset({
        host:      smtp.host ?? '',
        port:      smtp.port ?? 587,
        secure:    smtp.secure ?? false,
        username:  smtp.username ?? '',
        password:  smtp.password ?? '',
        fromEmail: smtp.fromEmail ?? '',
        replyTo:   smtp.replyTo ?? '',
      });
    }
  }, [smtp]);

  const saveCompany = useMutation({
    mutationFn: (d: CompanyForm) => api.put('/settings', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 3000);
    },
  });

  const saveSmtp = useMutation({
    mutationFn: (d: SmtpForm) => api.put('/settings/smtp', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['smtp-settings'] });
      setSmtpSaved(true);
      setTimeout(() => setSmtpSaved(false), 3000);
    },
  });

  const testSmtp = useMutation({
    mutationFn: () => api.post('/settings/smtp/test'),
  });

  if (loadingSettings || loadingSmtp) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={32} /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Company Settings */}
      <SectionCard title="Company Information">
        <form onSubmit={companyForm.handleSubmit(d => saveCompany.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company Name" required>
              <input {...companyForm.register('companyName')} className={inputCls} />
              {companyForm.formState.errors.companyName && (
                <p className="text-red-500 text-xs mt-1">{companyForm.formState.errors.companyName.message}</p>
              )}
            </Field>
            <Field label="Phone">
              <input {...companyForm.register('phone')} className={inputCls} placeholder="+27 11 000 0000" />
            </Field>
            <Field label="Email">
              <input type="email" {...companyForm.register('email')} className={inputCls} />
            </Field>
            <Field label="Website">
              <input {...companyForm.register('website')} className={inputCls} placeholder="https://example.com" />
            </Field>
            <Field label="VAT %" required>
              <input type="number" step="0.01" {...companyForm.register('vat')} className={inputCls} />
            </Field>
            <Field label="Currency" required>
              <select {...companyForm.register('currency')} className={inputCls}>
                <option value="ZAR">ZAR — South African Rand</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="BWP">BWP — Botswana Pula</option>
                <option value="ZWL">ZWL — Zimbabwean Dollar</option>
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="Address">
                <textarea {...companyForm.register('address')} rows={3} className={inputCls} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Google Maps API Key">
                <input {...companyForm.register('googleApiKey')} className={inputCls} placeholder="AIza..." />
                <p className="text-xs text-gray-400 mt-1">Used for geocoding and route distance calculation.</p>
              </Field>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saveCompany.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              <Save size={15} />
              {saveCompany.isPending ? 'Saving...' : 'Save Company Settings'}
            </button>
            {companySaved && (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle2 size={15} /> Saved successfully
              </span>
            )}
          </div>
        </form>
      </SectionCard>

      {/* SMTP Settings */}
      <SectionCard title="Email (SMTP) Settings">
        <form onSubmit={smtpForm.handleSubmit(d => saveSmtp.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="SMTP Host" required>
              <input {...smtpForm.register('host')} className={inputCls} placeholder="smtp.gmail.com" />
              {smtpForm.formState.errors.host && <p className="text-red-500 text-xs mt-1">{smtpForm.formState.errors.host.message}</p>}
            </Field>
            <Field label="Port" required>
              <input type="number" {...smtpForm.register('port')} className={inputCls} placeholder="587" />
            </Field>
            <Field label="Username" required>
              <input {...smtpForm.register('username')} className={inputCls} placeholder="your@email.com" />
              {smtpForm.formState.errors.username && <p className="text-red-500 text-xs mt-1">{smtpForm.formState.errors.username.message}</p>}
            </Field>
            <Field label="Password" required>
              <input type="password" {...smtpForm.register('password')} className={inputCls} />
              {smtpForm.formState.errors.password && <p className="text-red-500 text-xs mt-1">{smtpForm.formState.errors.password.message}</p>}
            </Field>
            <Field label="From Email" required>
              <input type="email" {...smtpForm.register('fromEmail')} className={inputCls} placeholder="noreply@company.com" />
              {smtpForm.formState.errors.fromEmail && <p className="text-red-500 text-xs mt-1">{smtpForm.formState.errors.fromEmail.message}</p>}
            </Field>
            <Field label="Reply-To">
              <input type="email" {...smtpForm.register('replyTo')} className={inputCls} />
            </Field>
            <div className="flex items-center gap-2">
              <input type="checkbox" {...smtpForm.register('secure')} id="smtpSecure" className="rounded" />
              <label htmlFor="smtpSecure" className="text-sm font-medium text-gray-700">Use SSL/TLS (port 465)</label>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saveSmtp.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              <Save size={15} />
              {saveSmtp.isPending ? 'Saving...' : 'Save SMTP Settings'}
            </button>
            <button type="button" onClick={() => testSmtp.mutate()}
              disabled={testSmtp.isPending}
              className="px-4 py-2 border text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-60">
              {testSmtp.isPending ? 'Sending...' : 'Send Test Email'}
            </button>
            {smtpSaved && (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle2 size={15} /> Saved
              </span>
            )}
            {testSmtp.isSuccess && (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle2 size={15} /> Test email sent!
              </span>
            )}
            {testSmtp.isError && (
              <span className="flex items-center gap-1 text-red-600 text-sm">
                <AlertCircle size={15} /> Test failed. Check credentials.
              </span>
            )}
          </div>
        </form>
      </SectionCard>

      {/* Change Password */}
      <SectionCard title="Change Admin Password">
        <ChangePasswordForm />
      </SectionCard>
    </div>
  );
}

/* ── nested component — now uses the module-level inputCls ── */

function ChangePasswordForm() {
  const schema = z.object({
    currentPassword: z.string().min(1, 'Current password required'),
    newPassword:     z.string().min(8, 'Minimum 8 characters'),
    confirmPassword: z.string(),
  }).refine(d => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

  type PwForm = z.infer<typeof schema>;
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PwForm>({
    resolver: zodResolver(schema),
  });

  const mut = useMutation({
    mutationFn: (d: PwForm) => api.put('/auth/change-password', d),
    onSuccess: () => { reset(); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  return (
    <form onSubmit={handleSubmit(d => mut.mutate(d))} className="space-y-4 max-w-sm">
      {[
        { label: 'Current Password', field: 'currentPassword' },
        { label: 'New Password', field: 'newPassword' },
        { label: 'Confirm New Password', field: 'confirmPassword' },
      ].map(({ label, field }) => (
        <div key={field}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
          <input type="password" {...register(field as keyof PwForm)} className={inputCls} />
          {errors[field as keyof PwForm] && (
            <p className="text-red-500 text-xs mt-1">{errors[field as keyof PwForm]?.message}</p>
          )}
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isSubmitting || mut.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
          <Save size={15} /> {mut.isPending ? 'Updating...' : 'Update Password'}
        </button>
        {saved && <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle2 size={15} /> Updated</span>}
        {mut.isError && <span className="text-red-600 text-sm">Incorrect current password.</span>}
      </div>
    </form>
  );
}