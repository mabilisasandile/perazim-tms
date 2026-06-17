import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Bell, Mail, MessageSquare, Phone, CheckCircle, XCircle,
  Clock, Settings, RefreshCw, Send, Eye, EyeOff, Save,
  Loader2, AlertCircle, BarChart3,
} from 'lucide-react';
import Badge from '../../components/ui/Badge';

/* ── types ─────────────────────────────────────────────────────────────────── */

interface NotificationLog {
  id: number; type: string; channel: string; recipientType: string;
  recipientName: string | null; recipientEmail: string | null; recipientPhone: string | null;
  entityType: string; entityId: number; subject: string | null; body: string;
  status: string; sentAt: string | null; failureReason: string | null; createdAt: string;
}

interface NotifSetting {
  id: number; notificationType: string;
  emailEnabled: boolean; smsEnabled: boolean; whatsappEnabled: boolean;
}

interface TwilioConfig {
  id?: number; accountSid: string; authToken: string; fromPhone: string;
  whatsappFrom: string | null; enabled: boolean;
}

interface WhatsAppConfig {
  id?: number; phoneNumberId: string; accessToken: string; enabled: boolean;
}

interface Stats {
  total: number; sent: number; failed: number; pending: number; last30Days: number;
  byChannel: Record<string, number>; byType: Record<string, number>;
}

/* ── helpers ───────────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  BOOKING_UPDATE:      'Booking Update',
  DELIVERY_UPDATE:     'Delivery Update',
  INVOICE_NOTIFICATION:'Invoice Notification',
  OTP_NOTIFICATION:    'OTP Notification',
  TRIP_ALLOCATION:     'Trip Allocation',
  DISPATCH_ASSIGNMENT: 'Dispatch Assignment',
  SCHEDULE_CHANGE:     'Schedule Change',
};

const TYPE_AUDIENCE: Record<string, string> = {
  BOOKING_UPDATE: 'Customer', DELIVERY_UPDATE: 'Customer',
  INVOICE_NOTIFICATION: 'Customer', OTP_NOTIFICATION: 'Customer',
  TRIP_ALLOCATION: 'Driver', DISPATCH_ASSIGNMENT: 'Driver', SCHEDULE_CHANGE: 'Driver',
};

function channelIcon(ch: string) {
  if (ch === 'EMAIL')    return <Mail    size={14} className="inline mr-1" />;
  if (ch === 'SMS')      return <Phone   size={14} className="inline mr-1" />;
  if (ch === 'WHATSAPP') return <MessageSquare size={14} className="inline mr-1" />;
  return null;
}

function statusBadge(s: string) {
  if (s === 'SENT')    return <Badge label="Sent"    variant="green" />;
  if (s === 'FAILED')  return <Badge label="Failed"  variant="red" />;
  return                      <Badge label="Pending" variant="yellow" />;
}

/* ── Toggle ─────────────────────────────────────────────────────────────────── */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${value ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

/* ── SecretInput ────────────────────────────────────────────────────────────── */
function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button type="button" onClick={() => setShow(s => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

/* ── Log Tab ────────────────────────────────────────────────────────────────── */
function LogTab() {
  const [typeFilter,    setTypeFilter]    = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [expanded,      setExpanded]      = useState<number | null>(null);

  const { data: logs = [], isLoading } = useQuery<NotificationLog[]>({
    queryKey: ['notifications', typeFilter, channelFilter, statusFilter],
    queryFn: () => api.get('/notifications', {
      params: {
        type:    typeFilter    || undefined,
        channel: channelFilter || undefined,
        status:  statusFilter  || undefined,
        limit:   200,
      },
    }).then(r => r.data),
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ['notifications-stats'],
    queryFn: () => api.get('/notifications/stats').then(r => r.data),
  });

  const statCards = [
    { label: 'Total Sent',   value: stats?.sent      ?? 0, icon: <CheckCircle size={18} className="text-green-600" /> },
    { label: 'Failed',       value: stats?.failed     ?? 0, icon: <XCircle     size={18} className="text-red-500"   /> },
    { label: 'Last 30 Days', value: stats?.last30Days ?? 0, icon: <Clock       size={18} className="text-blue-600"  /> },
    { label: 'Total Logged', value: stats?.total      ?? 0, icon: <BarChart3   size={18} className="text-purple-600"/> },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            {c.icon}
            <div>
              <p className="text-xl font-bold text-gray-900">{c.value}</p>
              <p className="text-xs text-gray-500">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Channel breakdown */}
      {stats && (Object.keys(stats.byChannel).length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Sent by Channel</p>
          <div className="flex gap-6">
            {Object.entries(stats.byChannel).map(([ch, count]) => (
              <div key={ch} className="flex items-center gap-2 text-sm">
                {channelIcon(ch)}<span className="font-medium">{count}</span>
                <span className="text-gray-500">{ch.charAt(0) + ch.slice(1).toLowerCase()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Channels</option>
            <option value="EMAIL">Email</option>
            <option value="SMS">SMS</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Statuses</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Bell size={36} className="mx-auto mb-2 opacity-40" />
            <p>No notifications logged yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Channel</th>
                  <th className="pb-2 pr-4">Recipient</th>
                  <th className="pb-2 pr-4">Entity</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => (
                  <>
                    <tr key={log.id} className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                      <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                        {format(parseISO(log.createdAt), 'dd MMM HH:mm')}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">{TYPE_LABELS[log.type] ?? log.type}</td>
                      <td className="py-2.5 pr-4 text-gray-600">
                        {channelIcon(log.channel)}{log.channel}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="text-gray-800">{log.recipientName ?? '—'}</div>
                        <div className="text-xs text-gray-400">{log.recipientEmail ?? log.recipientPhone ?? ''}</div>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500">{log.entityType} #{log.entityId}</td>
                      <td className="py-2.5">{statusBadge(log.status)}</td>
                    </tr>
                    {expanded === log.id && (
                      <tr key={`${log.id}-detail`} className="bg-gray-50">
                        <td colSpan={6} className="px-4 py-3">
                          {log.failureReason && (
                            <p className="text-red-600 text-xs mb-2 flex items-center gap-1">
                              <AlertCircle size={12} /> {log.failureReason}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 font-medium mb-1">Message body:</p>
                          <div className="text-xs text-gray-700 bg-white border border-gray-200 rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                            {log.body}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Settings Tab ───────────────────────────────────────────────────────────── */
function SettingsTab() {
  const qc = useQueryClient();

  const { data: settings = [] } = useQuery<NotifSetting[]>({
    queryKey: ['notif-settings'],
    queryFn: () => api.get('/notifications/settings').then(r => r.data),
  });

  const { data: twilioRaw } = useQuery<TwilioConfig | null>({
    queryKey: ['twilio-config'],
    queryFn: () => api.get('/notifications/twilio').then(r => r.data),
  });

  const { data: waRaw } = useQuery<WhatsAppConfig | null>({
    queryKey: ['wa-config'],
    queryFn: () => api.get('/notifications/whatsapp').then(r => r.data),
  });

  const [twilio, setTwilio] = useState<TwilioConfig>({ accountSid: '', authToken: '', fromPhone: '', whatsappFrom: '', enabled: false });
  const [wa, setWa]         = useState<WhatsAppConfig>({ phoneNumberId: '', accessToken: '', enabled: false });
  const [testPhone, setTestPhone] = useState('');
  const [testMsg,   setTestMsg]   = useState('');

  // Sync form state when data loads
  if (twilioRaw !== undefined && twilioRaw !== null && twilio.accountSid === '' && twilioRaw.accountSid) {
    setTwilio({ ...twilioRaw, whatsappFrom: twilioRaw.whatsappFrom ?? '' });
  }
  if (waRaw !== undefined && waRaw !== null && wa.phoneNumberId === '' && waRaw.phoneNumberId) {
    setWa(waRaw);
  }

  const toggleSetting = useMutation({
    mutationFn: ({ type, data }: { type: string; data: Partial<NotifSetting> }) =>
      api.put(`/notifications/settings/${type}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notif-settings'] }),
  });

  const saveTwilio = useMutation({
    mutationFn: () => api.put('/notifications/twilio', { ...twilio, whatsappFrom: twilio.whatsappFrom || null }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['twilio-config'] }); setTestMsg('Twilio config saved.'); },
    onError: (e: any) => setTestMsg(e.response?.data?.message ?? 'Save failed'),
  });

  const saveWa = useMutation({
    mutationFn: () => api.put('/notifications/whatsapp', wa).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wa-config'] }); setTestMsg('WhatsApp config saved.'); },
    onError: (e: any) => setTestMsg(e.response?.data?.message ?? 'Save failed'),
  });

  const testTwilio = useMutation({
    mutationFn: () => api.post('/notifications/twilio/test', { phone: testPhone }).then(r => r.data),
    onSuccess: () => setTestMsg('SMS test sent successfully!'),
    onError: (e: any) => setTestMsg(`SMS test failed: ${e.response?.data?.message ?? e.message}`),
  });

  const testWa = useMutation({
    mutationFn: () => api.post('/notifications/whatsapp/test', { phone: testPhone }).then(r => r.data),
    onSuccess: () => setTestMsg('WhatsApp test sent successfully!'),
    onError: (e: any) => setTestMsg(`WhatsApp test failed: ${e.response?.data?.message ?? e.message}`),
  });

  const customerTypes = NOTIFICATION_TYPES_LIST.filter(t => TYPE_AUDIENCE[t] === 'Customer');
  const driverTypes   = NOTIFICATION_TYPES_LIST.filter(t => TYPE_AUDIENCE[t] === 'Driver');

  const settingFor = (type: string) => settings.find(s => s.notificationType === type);

  function handleToggle(type: string, channel: 'emailEnabled' | 'smsEnabled' | 'whatsappEnabled', val: boolean) {
    const s = settingFor(type);
    const patch = {
      emailEnabled:    s?.emailEnabled    ?? false,
      smsEnabled:      s?.smsEnabled      ?? false,
      whatsappEnabled: s?.whatsappEnabled ?? false,
      [channel]: val,
    };
    toggleSetting.mutate({ type, data: patch });
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";
  const btnCls   = "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg";

  return (
    <div className="space-y-6">
      {/* Twilio Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Phone size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-800">Twilio — SMS &amp; WhatsApp</h3>
          </div>
          <Toggle value={twilio.enabled} onChange={v => setTwilio(s => ({ ...s, enabled: v }))} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Account SID</label>
            <input className={inputCls} value={twilio.accountSid}
              onChange={e => setTwilio(s => ({ ...s, accountSid: e.target.value }))}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
          </div>
          <div>
            <label className={labelCls}>Auth Token</label>
            <SecretInput value={twilio.authToken}
              onChange={v => setTwilio(s => ({ ...s, authToken: v }))}
              placeholder="Your Twilio auth token" />
          </div>
          <div>
            <label className={labelCls}>SMS From Number (E.164)</label>
            <input className={inputCls} value={twilio.fromPhone}
              onChange={e => setTwilio(s => ({ ...s, fromPhone: e.target.value }))}
              placeholder="+14155238886" />
          </div>
          <div>
            <label className={labelCls}>WhatsApp From (leave blank to disable WhatsApp via Twilio)</label>
            <input className={inputCls} value={twilio.whatsappFrom ?? ''}
              onChange={e => setTwilio(s => ({ ...s, whatsappFrom: e.target.value || null }))}
              placeholder="whatsapp:+14155238886" />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => saveTwilio.mutate()}
            disabled={saveTwilio.isPending}
            className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60`}>
            {saveTwilio.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Twilio
          </button>
          <div className="flex items-center gap-2">
            <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
              placeholder="Test phone (+27...)" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
            <button onClick={() => testTwilio.mutate()}
              disabled={testTwilio.isPending || !testPhone}
              className={`${btnCls} border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50`}>
              {testTwilio.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Test SMS
            </button>
          </div>
        </div>
      </div>

      {/* Meta WhatsApp Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-green-600" />
            <h3 className="font-semibold text-gray-800">Meta WhatsApp Cloud API</h3>
            <span className="text-xs text-gray-400">(alternative to Twilio WhatsApp)</span>
          </div>
          <Toggle value={wa.enabled} onChange={v => setWa(s => ({ ...s, enabled: v }))} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Phone Number ID</label>
            <input className={inputCls} value={wa.phoneNumberId}
              onChange={e => setWa(s => ({ ...s, phoneNumberId: e.target.value }))}
              placeholder="1234567890" />
          </div>
          <div>
            <label className={labelCls}>Access Token</label>
            <SecretInput value={wa.accessToken}
              onChange={v => setWa(s => ({ ...s, accessToken: v }))}
              placeholder="EAAxxxxxxxxxxxxxxx" />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => saveWa.mutate()}
            disabled={saveWa.isPending}
            className={`${btnCls} bg-green-600 text-white hover:bg-green-700 disabled:opacity-60`}>
            {saveWa.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save WhatsApp
          </button>
          <div className="flex items-center gap-2">
            <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
              placeholder="Test phone (+27...)" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
            <button onClick={() => testWa.mutate()}
              disabled={testWa.isPending || !testPhone}
              className={`${btnCls} border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50`}>
              {testWa.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Test WhatsApp
            </button>
          </div>
        </div>
        {testMsg && (
          <p className="mt-2 text-sm text-blue-700 bg-blue-50 rounded px-3 py-1.5">{testMsg}</p>
        )}
      </div>

      {/* Per-Type Channel Toggles */}
      {[
        { label: 'Customer Notifications', types: customerTypes },
        { label: 'Driver Notifications',   types: driverTypes },
      ].map(group => (
        <div key={group.label} className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Bell size={16} className="text-blue-600" />
            {group.label}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="pb-2 pr-6">Notification Type</th>
                  <th className="pb-2 pr-6 text-center">
                    <Mail size={14} className="inline mr-1" />Email
                  </th>
                  <th className="pb-2 pr-6 text-center">
                    <Phone size={14} className="inline mr-1" />SMS
                  </th>
                  <th className="pb-2 text-center">
                    <MessageSquare size={14} className="inline mr-1" />WhatsApp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {group.types.map(type => {
                  const s = settingFor(type);
                  return (
                    <tr key={type} className="hover:bg-gray-50">
                      <td className="py-3 pr-6 font-medium text-gray-700">{TYPE_LABELS[type]}</td>
                      <td className="py-3 pr-6 text-center">
                        <Toggle value={s?.emailEnabled ?? false}
                          onChange={v => handleToggle(type, 'emailEnabled', v)} />
                      </td>
                      <td className="py-3 pr-6 text-center">
                        <Toggle value={s?.smsEnabled ?? false}
                          onChange={v => handleToggle(type, 'smsEnabled', v)} />
                      </td>
                      <td className="py-3 text-center">
                        <Toggle value={s?.whatsappEnabled ?? false}
                          onChange={v => handleToggle(type, 'whatsappEnabled', v)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

const NOTIFICATION_TYPES_LIST = [
  'BOOKING_UPDATE', 'DELIVERY_UPDATE', 'INVOICE_NOTIFICATION', 'OTP_NOTIFICATION',
  'TRIP_ALLOCATION', 'DISPATCH_ASSIGNMENT', 'SCHEDULE_CHANGE',
];

/* ── Page ───────────────────────────────────────────────────────────────────── */

type TabId = 'log' | 'settings';

export default function NotificationsPage() {
  const [tab, setTab] = useState<TabId>('log');
  const qc = useQueryClient();

  const tabClass = (t: TabId) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-blue-600 text-blue-700'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification System</h1>
          <p className="text-sm text-gray-500 mt-1">Email, SMS, and WhatsApp notifications for customers and drivers</p>
        </div>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['notifications'] })}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-1">
        <button className={tabClass('log')}     onClick={() => setTab('log')}>
          <Bell size={14} className="inline mr-1.5" />Notification Log
        </button>
        <button className={tabClass('settings')} onClick={() => setTab('settings')}>
          <Settings size={14} className="inline mr-1.5" />Settings &amp; Channels
        </button>
      </div>

      {tab === 'log'      && <LogTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}
