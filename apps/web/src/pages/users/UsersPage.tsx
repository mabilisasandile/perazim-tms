import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Shield } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';

interface User { id:number; name:string; email:string; username:string; isActive:boolean; createdAt:string; permissions:Record<string,boolean>|null; }

const createSchema = z.object({ name:z.string().min(1,'Required'), email:z.string().email(), username:z.string().min(3,'Min 3 chars'), password:z.string().min(8,'Min 8 chars'), isActive:z.boolean().default(true) });
const updateSchema = createSchema.omit({password:true}).extend({ password:z.string().min(8).optional().or(z.literal('')) });
type CForm = z.infer<typeof createSchema>;
type UForm = z.infer<typeof updateSchema>;

const PERM_GROUPS = [
  {label:'Vehicles', keys:['vehicleList','vehicleView','vehicleEdit','vehicleAdd','vehicleGroup','vehicleGroupAdd','vehicleGroupAction']},
  {label:'Drivers',  keys:['driverList','driverEdit','driverAdd']},
  {label:'Trips',    keys:['tripList','tripEdit','tripAdd']},
  {label:'Customers',keys:['customerList','customerEdit','customerAdd']},
  {label:'Fuel',     keys:['fuelList','fuelEdit','fuelAdd']},
  {label:'Reminders',keys:['reminderList','reminderDelete','reminderAdd']},
  {label:'Income/Expense',keys:['incomeExpenseList','incomeExpenseEdit']},
];
const pLabel=(k:string)=>k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase());

export default function UsersPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User|null>(null);
  const [permUser, setPermUser] = useState<User|null>(null);
  const [localPerms, setLocalPerms] = useState<Record<string,boolean>>({});

  const { data:users=[], isLoading, isError } = useQuery<User[]>({
    queryKey:['users'], queryFn:()=>api.get('/users').then(r=>Array.isArray(r.data)?r.data:r.data?.data??[]),
  });

  const { register, handleSubmit, reset, formState:{errors,isSubmitting} } = useForm<CForm|UForm>({
    resolver:zodResolver(editing?updateSchema:createSchema),
  });

  const createMut = useMutation({ mutationFn:(d:CForm)=>api.post('/users',d), onSuccess:()=>{ qc.invalidateQueries({queryKey:['users']}); close(); }});
  const updateMut = useMutation({ mutationFn:(d:UForm)=>api.put(`/users/${editing!.id}`,d), onSuccess:()=>{ qc.invalidateQueries({queryKey:['users']}); close(); }});
  const deleteMut = useMutation({ mutationFn:(id:number)=>api.delete(`/users/${id}`), onSuccess:()=>qc.invalidateQueries({queryKey:['users']})});
  const permsMut  = useMutation({ mutationFn:({id,perms}:{id:number;perms:Record<string,boolean>})=>api.put(`/users/${id}/permissions`,perms), onSuccess:()=>{ qc.invalidateQueries({queryKey:['users']}); setPermUser(null); }});

  const openAdd=()=>{ setEditing(null); reset({name:'',email:'',username:'',password:'',isActive:true}); setModalOpen(true); };
  const openEdit=(u:User)=>{ setEditing(u); reset({name:u.name,email:u.email,username:u.username,isActive:u.isActive,password:''}); setModalOpen(true); };
  const openPerms=(u:User)=>{ setPermUser(u); setLocalPerms(u.permissions??{}); };
  const close=()=>{ setModalOpen(false); setEditing(null); };

  if(isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;
  if(isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20}/><span>Failed to load users.</span></div>;

  const inp='w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"><Plus size={16}/> Add User</button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Username</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Created</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length===0
              ? <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No users yet.</td></tr>
              : users.map(u=>(
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3 text-gray-500">{format(new Date(u.createdAt),'dd MMM yyyy')}</td>
                <td className="px-4 py-3"><Badge label={u.isActive?'Active':'Inactive'} variant={u.isActive?'green':'red'}/></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={()=>openPerms(u)} className="p-1.5 text-gray-400 hover:text-brand-600" title="Permissions"><Shield size={16}/></button>
                    <button onClick={()=>openEdit(u)} className="p-1.5 text-gray-400 hover:text-brand-600"><Pencil size={16}/></button>
                    <button onClick={()=>confirm(`Delete "${u.name}"?`)&&deleteMut.mutate(u.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={editing?'Edit User':'Add User'} open={modalOpen} onClose={close}>
        <form onSubmit={handleSubmit(d=>editing?updateMut.mutate(d as UForm):createMut.mutate(d as CForm))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label><input {...register('name')} className={inp}/>{errors.name&&<p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Username *</label><input {...register('username')} className={inp}/>{errors.username&&<p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}</div>
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input type="email" {...register('email')} className={inp}/>{errors.email&&<p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}</div>
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">{editing?'New Password (blank = keep current)':'Password *'}</label><input type="password" {...register('password')} className={inp}/>{errors.password&&<p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}</div>
            <div className="flex items-center gap-2"><input type="checkbox" {...register('isActive')} id="uActive" className="rounded"/><label htmlFor="uActive" className="text-sm font-medium text-gray-700">Active</label></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={close} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSubmitting||createMut.isPending||updateMut.isPending}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {(createMut.isPending||updateMut.isPending)&&<Loader2 className="animate-spin" size={16}/>}
              {editing?'Save Changes':'Add User'}
            </button>
          </div>
        </form>
      </Modal>

      {permUser && (
        <Modal title={`Permissions — ${permUser.name}`} open={!!permUser} onClose={()=>setPermUser(null)} width="max-w-2xl">
          <div className="space-y-5">
            {PERM_GROUPS.map(g=>(
              <div key={g.label}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{g.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {g.keys.map(k=>(
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!localPerms[k]} onChange={e=>setLocalPerms(p=>({...p,[k]:e.target.checked}))} className="rounded border-gray-300 text-brand-600"/>
                      <span className="text-sm text-gray-700">{pLabel(k)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={()=>setPermUser(null)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={()=>permsMut.mutate({id:permUser.id,perms:localPerms})} disabled={permsMut.isPending}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                {permsMut.isPending&&<Loader2 className="animate-spin" size={16}/>} Save Permissions
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
