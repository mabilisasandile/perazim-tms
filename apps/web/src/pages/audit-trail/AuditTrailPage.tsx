import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { History, Loader2, AlertCircle, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../../components/ui/Modal';

interface AuditLog {
  id: number;
  username: string;
  ipAddress: string | null;
  actionType: string;
  entityType: string;
  entityId: number | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
}

interface AuditResponse {
  total: number;
  page: number;
  limit: number;
  logs: AuditLog[];
}

const ENTITY_TYPES = ['BOOKING', 'INVOICE', 'USER', 'CUSTOMER', 'DRIVER', 'WAREHOUSE', 'PAYMENT'];

const ACTION_TYPES: Record<string, string[]> = {
  BOOKING:   ['BOOKING_CREATED', 'BOOKING_UPDATED', 'BOOKING_STATUS_UPDATED', 'BOOKING_DELETED'],
  INVOICE:   ['INVOICE_CREATED', 'INVOICE_STATUS_UPDATED', 'INVOICE_DELETED'],
  USER:      ['USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_PERMISSIONS_UPDATED', 'USER_PASSWORD_CHANGED'],
  CUSTOMER:  ['CUSTOMER_CREATED', 'CUSTOMER_UPDATED', 'CUSTOMER_DELETED', 'CUSTOMER_PASSWORD_SET'],
  DRIVER:    ['DRIVER_CREATED', 'DRIVER_UPDATED', 'DRIVER_DELETED'],
  WAREHOUSE: ['WAREHOUSE_LOADSHEET_CREATED', 'WAREHOUSE_LOADSHEET_UPDATED', 'WAREHOUSE_LOADSHEET_DELETED'],
  PAYMENT:   ['PAYMENT_CREATED', 'PAYMENT_MARKED_PAID', 'PAYMENT_STATUS_UPDATED', 'PAYMENT_DELETED'],
};

const ALL_ACTION_TYPES = Object.values(ACTION_TYPES).flat();

const entityColor: Record<string, string> = {
  BOOKING:   'bg-blue-100 text-blue-700',
  INVOICE:   'bg-yellow-100 text-yellow-700',
  USER:      'bg-gray-100 text-gray-700',
  CUSTOMER:  'bg-green-100 text-green-700',
  DRIVER:    'bg-orange-100 text-orange-700',
  WAREHOUSE: 'bg-purple-100 text-purple-700',
  PAYMENT:   'bg-emerald-100 text-emerald-700',
};

const actionColor = (a: string): string => {
  if (a.endsWith('_DELETED'))  return 'bg-red-100 text-red-700';
  if (a.endsWith('_CREATED'))  return 'bg-green-100 text-green-700';
  if (a.includes('_UPDATED') || a.includes('_MARKED') || a.includes('_SET') || a.includes('_CHANGED'))
    return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-600';
};

const fmtAction = (a: string) =>
  a.replace(/_/g, ' ').replace(/\b(\w)/g, c => c.toUpperCase());

function JsonView({ value }: { value: unknown }) {
  if (value == null) return <span className="text-gray-400 italic text-xs">—</span>;
  return (
    <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-72 whitespace-pre-wrap break-all font-mono border">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

const LIMIT = 25;

export default function AuditTrailPage() {
  const [page, setPage]               = useState(1);
  const [username, setUsername]       = useState('');
  const [entityType, setEntityType]   = useState('');
  const [actionType, setActionType]   = useState('');
  const [from, setFrom]               = useState('');
  const [to, setTo]                   = useState('');
  const [viewing, setViewing]         = useState<AuditLog | null>(null);

  const params = {
    page,
    limit: LIMIT,
    ...(username   ? { username }   : {}),
    ...(entityType ? { entityType } : {}),
    ...(actionType ? { actionType } : {}),
    ...(from       ? { from }       : {}),
    ...(to         ? { to }         : {}),
  };

  const { data, isLoading, isError } = useQuery<AuditResponse>({
    queryKey: ['audit-trail', params],
    queryFn: () => api.get('/audit-trail', { params }).then(r => r.data),
    placeholderData: prev => prev,
  });

  const logs  = data?.logs  ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const resetFilters = () => {
    setUsername(''); setEntityType(''); setActionType('');
    setFrom(''); setTo(''); setPage(1);
  };

  const applyEntityType = (v: string) => { setEntityType(v); setActionType(''); setPage(1); };

  const inp = 'border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-brand-50 rounded-lg">
          <History size={20} className="text-brand-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
          <p className="text-sm text-gray-500 mt-0.5">Complete log of all system activities</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            placeholder="Filter by username…"
            value={username}
            onChange={e => { setUsername(e.target.value); setPage(1); }}
            className={inp}
          />

          <select value={entityType} onChange={e => applyEntityType(e.target.value)} className={inp}>
            <option value="">All modules</option>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
          </select>

          <select value={actionType} onChange={e => { setActionType(e.target.value); setPage(1); }} className={inp}>
            <option value="">All actions</option>
            {(entityType ? (ACTION_TYPES[entityType] ?? []) : ALL_ACTION_TYPES).map(a => (
              <option key={a} value={a}>{fmtAction(a)}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} className={`${inp} flex-1`} title="From date" />
            <input type="date" value={to}   onChange={e => { setTo(e.target.value);   setPage(1); }} className={`${inp} flex-1`} title="To date" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400">
            {total > 0 ? `${total.toLocaleString()} record${total !== 1 ? 's' : ''} found` : 'No records'}
          </p>
          <button onClick={resetFilters} className="text-xs text-brand-600 hover:underline">Clear filters</button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="animate-spin text-brand-600" size={32} />
          <p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p>
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
          <AlertCircle size={20} /><span>Failed to load audit logs.</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Date & Time</th>
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">IP Address</th>
                <th className="px-4 py-3 text-left">Module</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Record ID</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <History size={36} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-400 text-sm">No audit records match your filters.</p>
                  </td>
                </tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-medium text-gray-900">{format(new Date(log.createdAt), 'dd MMM yyyy')}</p>
                    <p className="text-xs text-gray-400">{format(new Date(log.createdAt), 'HH:mm:ss')}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{log.username}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{log.ipAddress ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entityColor[log.entityType] ?? 'bg-gray-100 text-gray-600'}`}>
                      {log.entityType.charAt(0) + log.entityType.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${actionColor(log.actionType)}`}>
                      {fmtAction(log.actionType)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {log.entityId != null ? <span className="font-mono text-xs">#{log.entityId}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setViewing(log)}
                      className="p-1.5 text-gray-400 hover:text-brand-600 rounded transition-colors"
                      title="View details"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages} &bull; {total.toLocaleString()} records
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded border text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded border text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail modal */}
      {viewing && (
        <Modal title="Audit Log Detail" open={!!viewing} onClose={() => setViewing(null)} width="max-w-2xl">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date & Time</p>
                <p className="font-medium">{format(new Date(viewing.createdAt), 'dd MMM yyyy, HH:mm:ss')}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Username</p>
                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{viewing.username}</span>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">IP Address</p>
                <p className="font-mono text-xs">{viewing.ipAddress ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Record ID</p>
                <p className="font-mono text-xs">{viewing.entityId != null ? `#${viewing.entityId}` : '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Module</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entityColor[viewing.entityType] ?? 'bg-gray-100 text-gray-600'}`}>
                  {viewing.entityType.charAt(0) + viewing.entityType.slice(1).toLowerCase()}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Action</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${actionColor(viewing.actionType)}`}>
                  {fmtAction(viewing.actionType)}
                </span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Old Value</p>
                <JsonView value={viewing.oldValue} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">New Value</p>
                <JsonView value={viewing.newValue} />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setViewing(null)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <X size={14} /> Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
