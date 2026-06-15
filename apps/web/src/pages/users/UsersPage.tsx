import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Pencil, Trash2, Loader2, AlertCircle, Shield,
  Lock, Unlock, UserCog, ChevronDown,
} from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';

// ── Types ────────────────────────────────────────────────────────────────────

interface RoleDef {
  key: string;
  label: string;
  permissions: Record<string, boolean>;
}

interface User {
  id: number; name: string; email: string; username: string;
  role: string; isActive: boolean; createdAt: string;
  lastLoginAt: string | null; failedLoginCount: number;
  lockedUntil: string | null;
  permissions: Record<string, boolean> | null;
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const ROLE_KEYS = [
  'SUPER_ADMIN','ADMIN','OPERATIONS_CONTROLLER','WAREHOUSE_CONTROLLER',
  'DISPATCH_CONTROLLER','ACCOUNTS','DRIVER','SECURITY_GATE',
] as const;

const createSchema = z.object({
  name:     z.string().min(1, 'Required'),
  email:    z.string().email(),
  username: z.string().min(3, 'Min 3 chars'),
  password: z.string().min(8, 'Min 8 chars'),
  role:     z.enum(ROLE_KEYS).default('ADMIN'),
  isActive: z.boolean().default(true),
});
const updateSchema = createSchema.omit({ password: true }).extend({
  password: z.string().min(8).optional().or(z.literal('')),
});
type CForm = z.infer<typeof createSchema>;
type UForm = z.infer<typeof updateSchema>;

// ── Permission groups (for fine-tune modal) ──────────────────────────────────

const PERM_GROUPS = [
  { label: 'Vehicles',       keys: ['vehicleList','vehicleView','vehicleEdit','vehicleAdd','vehicleGroup','vehicleGroupAdd','vehicleGroupAction'] },
  { label: 'Drivers',        keys: ['driverList','driverEdit','driverAdd'] },
  { label: 'Trips',          keys: ['tripList','tripEdit','tripAdd'] },
  { label: 'Customers',      keys: ['customerList','customerEdit','customerAdd'] },
  { label: 'Fuel',           keys: ['fuelList','fuelEdit','fuelAdd'] },
  { label: 'Reminders',      keys: ['reminderList','reminderDelete','reminderAdd'] },
  { label: 'Income/Expense', keys: ['incomeExpenseList','incomeExpenseEdit'] },
];
const pLabel = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

// ── Role colours ─────────────────────────────────────────────────────────────

const roleMeta: Record<string, { label: string; variant: 'green'|'blue'|'yellow'|'red'|'gray' }> = {
  SUPER_ADMIN:            { label: 'Super Admin',          variant: 'red'    },
  ADMIN:                  { label: 'Administrator',        variant: 'blue'   },
  OPERATIONS_CONTROLLER:  { label: 'Operations',           variant: 'green'  },
  WAREHOUSE_CONTROLLER:   { label: 'Warehouse',            variant: 'yellow' },
  DISPATCH_CONTROLLER:    { label: 'Dispatch',             variant: 'blue'   },
  ACCOUNTS:               { label: 'Accounts',             variant: 'green'  },
  DRIVER:                 { label: 'Driver',               variant: 'gray'   },
  SECURITY_GATE:          { label: 'Security Gate',        variant: 'yellow' },
};

const inp = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

// ── Component ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const qc = useQueryClient();
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editing,    setEditing]    = useState<User | null>(null);
  const [permUser,   setPermUser]   = useState<User | null>(null);
  const [localPerms, setLocalPerms] = useState<Record<string, boolean>>({});
  const [roleUser,   setRoleUser]   = useState<User | null>(null);
  const [roleChoice, setRoleChoice] = useState('');

  const { data: users = [], isLoading, isError } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => Array.isArray(r.data) ? r.data : r.data?.data ?? []),
  });

  const { data: roles = [] } = useQuery<RoleDef[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/users/roles').then(r => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CForm | UForm>({
    resolver: zodResolver(editing ? updateSchema : createSchema),
  });

  const createMut  = useMutation({ mutationFn: (d: CForm) => api.post('/users', d),                           onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); close(); } });
  const updateMut  = useMutation({ mutationFn: (d: UForm) => api.put(`/users/${editing!.id}`, d),             onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); close(); } });
  const deleteMut  = useMutation({ mutationFn: (id: number) => api.delete(`/users/${id}`),                    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
  const permsMut   = useMutation({ mutationFn: ({ id, perms }: { id: number; perms: Record<string,boolean> }) => api.put(`/users/${id}/permissions`, perms), onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setPermUser(null); } });
  const roleMut    = useMutation({ mutationFn: ({ id, role }: { id: number; role: string }) => api.put(`/users/${id}/role`, { role }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setRoleUser(null); } });
  const unlockMut  = useMutation({ mutationFn: (id: number) => api.post(`/users/${id}/unlock`),               onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });

  const openAdd  = () => { setEditing(null); reset({ name:'', email:'', username:'', password:'', role:'ADMIN', isActive:true }); setModalOpen(true); };
  const openEdit = (u: User) => { setEditing(u); reset({ name:u.name, email:u.email, username:u.username, role:u.role as any, isActive:u.isActive, password:'' }); setModalOpen(true); };
  const openPerms = (u: User) => { setPermUser(u); setLocalPerms(u.permissions ?? {}); };
  const openRole  = (u: User) => { setRoleUser(u); setRoleChoice(u.role); };
  const close = () => { setModalOpen(false); setEditing(null); };

  const isLocked = (u: User) => !!u.lockedUntil && new Date(u.lockedUntil) > new Date();

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={32} /></div>;
  if (isError)   return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20} /><span>Failed to load users.</span></div>;

  const selectedRoleDef = roles.find(r => r.key === roleChoice);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users & Roles</h1>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Role legend */}
      <div className="bg-white rounded-xl border p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Role Definitions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {roles.map(r => (
            <div key={r.key} className="flex items-center gap-2">
              <Badge label={roleMeta[r.key]?.label ?? r.key} variant={roleMeta[r.key]?.variant ?? 'gray'} />
              <span className="text-xs text-gray-400">{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Last Login</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0
              ? <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No users yet.</td></tr>
              : users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3">
                  <Badge label={roleMeta[u.role]?.label ?? u.role} variant={roleMeta[u.role]?.variant ?? 'gray'} />
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {u.lastLoginAt ? format(new Date(u.lastLoginAt), 'dd MMM yyyy HH:mm') : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge label={u.isActive ? 'Active' : 'Inactive'} variant={u.isActive ? 'green' : 'red'} />
                    {isLocked(u) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                        <Lock size={10} /> Locked
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {isLocked(u) && (
                      <button onClick={() => unlockMut.mutate(u.id)} className="p-1.5 text-orange-400 hover:text-orange-600" title="Unlock account">
                        <Unlock size={15} />
                      </button>
                    )}
                    <button onClick={() => openRole(u)} className="p-1.5 text-gray-400 hover:text-indigo-600" title="Assign role">
                      <UserCog size={15} />
                    </button>
                    <button onClick={() => openPerms(u)} className="p-1.5 text-gray-400 hover:text-brand-600" title="Fine-tune permissions">
                      <Shield size={15} />
                    </button>
                    <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-brand-600">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => confirm(`Delete "${u.name}"?`) && deleteMut.mutate(u.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit modal */}
      <Modal title={editing ? 'Edit User' : 'Add User'} open={modalOpen} onClose={close}>
        <form onSubmit={handleSubmit(d => editing ? updateMut.mutate(d as UForm) : createMut.mutate(d as CForm))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input {...register('name')} className={inp} />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
              <input {...register('username')} className={inp} />
              {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" {...register('email')} className={inp} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {editing ? 'New Password (blank = keep current)' : 'Password *'}
              </label>
              <input type="password" {...register('password')} className={inp} />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <div className="relative">
                <select {...register('role')} className={`${inp} appearance-none pr-8`}>
                  {roles.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('isActive')} id="uActive" className="rounded" />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>
          <p className="text-xs text-gray-400">Default permissions for the selected role will be applied automatically.</p>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={close} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSubmitting || createMut.isPending || updateMut.isPending}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="animate-spin" size={16} />}
              {editing ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign role modal */}
      {roleUser && (
        <Modal title={`Assign Role — ${roleUser.name}`} open={!!roleUser} onClose={() => setRoleUser(null)} width="max-w-lg">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              {roles.map(r => (
                <label key={r.key} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${roleChoice === r.key ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="roleChoice" value={r.key} checked={roleChoice === r.key} onChange={() => setRoleChoice(r.key)} className="text-brand-600" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge label={roleMeta[r.key]?.label ?? r.key} variant={roleMeta[r.key]?.variant ?? 'gray'} />
                      <span className="text-sm font-medium text-gray-800">{r.label}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {selectedRoleDef && (
              <div className="bg-gray-50 rounded-lg p-3 border">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Permissions included</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(selectedRoleDef.permissions).filter(([, v]) => v).map(([k]) => (
                    <span key={k} className="text-xs bg-white border rounded px-1.5 py-0.5 text-gray-600">{pLabel(k)}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => setRoleUser(null)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => roleMut.mutate({ id: roleUser.id, role: roleChoice })} disabled={roleMut.isPending}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                {roleMut.isPending && <Loader2 className="animate-spin" size={16} />} Assign Role
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Fine-tune permissions modal */}
      {permUser && (
        <Modal title={`Permissions — ${permUser.name}`} open={!!permUser} onClose={() => setPermUser(null)} width="max-w-2xl">
          <div className="space-y-5">
            {PERM_GROUPS.map(g => (
              <div key={g.label}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{g.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {g.keys.map(k => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!localPerms[k]} onChange={e => setLocalPerms(p => ({ ...p, [k]: e.target.checked }))} className="rounded border-gray-300 text-brand-600" />
                      <span className="text-sm text-gray-700">{pLabel(k)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => setPermUser(null)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => permsMut.mutate({ id: permUser.id, perms: localPerms })} disabled={permsMut.isPending}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                {permsMut.isPending && <Loader2 className="animate-spin" size={16} />} Save Permissions
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
