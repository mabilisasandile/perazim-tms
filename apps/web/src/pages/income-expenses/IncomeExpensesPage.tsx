import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Loader2, AlertCircle, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';

interface Entry { id:number; type:'INCOME'|'EXPENSE'; description:string; amount:string|number; date:string; vehicle:{id:number;name:string;registrationNo:string}|null; }
interface Summary { income:{count:number;total:number}; expense:{count:number;total:number}; net:number; }

const schema = z.object({
  vehicleId:   z.coerce.number().int().positive().optional().nullable(),
  type:        z.enum(['INCOME','EXPENSE']),
  description: z.string().min(1,'Description is required'),
  amount:      z.coerce.number().positive('Amount must be positive'),
  date:        z.string().min(1,'Date is required'),
});
type FormData = z.infer<typeof schema>;

const fmt = (n:number) => new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(n);
const norm = (r:unknown):any[] => { if(Array.isArray(r)) return r; if(r&&typeof r==='object') for(const k of['data','items','results']) if(Array.isArray((r as any)[k])) return (r as any)[k]; return []; };

export default function IncomeExpensesPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Entry|null>(null);
  const [typeFilter, setTypeFilter] = useState<''|'INCOME'|'EXPENSE'>('');
  const [vFilter, setVFilter] = useState<number|undefined>();

  const { data:entries=[], isLoading, isError } = useQuery<Entry[]>({
    queryKey:['income-expenses',typeFilter,vFilter],
    queryFn:()=>api.get('/income-expenses',{params:{...(typeFilter&&{type:typeFilter}),...(vFilter&&{vehicleId:vFilter})}}).then(r=>norm(r.data)),
  });
  const { data:summary } = useQuery<Summary>({
    queryKey:['income-expenses-summary',vFilter],
    queryFn:()=>api.get('/income-expenses/summary',{params:vFilter?{vehicleId:vFilter}:{}}).then(r=>r.data),
  });
  const { data:vehicles=[] } = useQuery<{id:number;name:string;registrationNo:string}[]>({
    queryKey:['vehicles-select'],
    queryFn:()=>api.get('/vehicles').then(r=>norm(r.data).filter((v:any)=>v.isActive)),
  });

  const { register, handleSubmit, reset, formState:{errors,isSubmitting} } = useForm<FormData>({
    resolver:zodResolver(schema), defaultValues:{type:'EXPENSE'},
  });

  const createMut = useMutation({ mutationFn:(d:FormData)=>api.post('/income-expenses',d), onSuccess:()=>{ qc.invalidateQueries({queryKey:['income-expenses']}); qc.invalidateQueries({queryKey:['income-expenses-summary']}); close(); }});
  const updateMut = useMutation({ mutationFn:(d:FormData)=>api.put(`/income-expenses/${editing!.id}`,d), onSuccess:()=>{ qc.invalidateQueries({queryKey:['income-expenses']}); qc.invalidateQueries({queryKey:['income-expenses-summary']}); close(); }});
  const deleteMut = useMutation({ mutationFn:(id:number)=>api.delete(`/income-expenses/${id}`), onSuccess:()=>{ qc.invalidateQueries({queryKey:['income-expenses']}); qc.invalidateQueries({queryKey:['income-expenses-summary']}); }});

  const openAdd=()=>{ setEditing(null); reset({type:'EXPENSE',description:'',date:new Date().toISOString().split('T')[0]}); setModalOpen(true); };
  const openEdit=(e:Entry)=>{ setEditing(e); reset({type:e.type,description:e.description,amount:Number(e.amount),date:e.date.split('T')[0],vehicleId:e.vehicle?.id??null}); setModalOpen(true); };
  const close=()=>{ setModalOpen(false); setEditing(null); };

  if(isLoading) return <div className="flex flex-col items-center justify-center h-64 gap-3"><Loader2 className="animate-spin text-brand-600" size={32}/><p className="text-sm text-gray-400 font-medium tracking-wide animate-pulse">Loading...</p></div>;
  if(isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20}/><span>Failed to load records.</span></div>;

  const inp='w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Income & Expenses</h1>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"><Plus size={16}/> Add Entry</button>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            {label:'Total Income',val:summary.income.total,count:summary.income.count,icon:TrendingUp,bg:'bg-green-100',clr:'text-green-600'},
            {label:'Total Expenses',val:summary.expense.total,count:summary.expense.count,icon:TrendingDown,bg:'bg-red-100',clr:'text-red-600'},
            {label:'Net Position',val:summary.net,count:null,icon:DollarSign,bg:summary.net>=0?'bg-blue-100':'bg-orange-100',clr:summary.net>=0?'text-blue-600':'text-orange-600'},
          ].map(({label,val,count,icon:Icon,bg,clr})=>(
            <div key={label} className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-2"><div className={`p-2 ${bg} rounded-lg`}><Icon className={clr} size={18}/></div><p className="text-sm font-medium text-gray-500">{label}</p></div>
              <p className={`text-2xl font-bold ${clr}`}>{fmt(val)}</p>
              {count!=null && <p className="text-xs text-gray-400 mt-1">{count} entries</p>}
              {count==null && <p className="text-xs text-gray-400 mt-1">{val>=0?'Profit':'Loss'}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {(['','INCOME','EXPENSE'] as const).map(t=>(
            <button key={t} onClick={()=>setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter===t?'bg-brand-600 text-white':'bg-white border text-gray-600 hover:border-brand-500'}`}>
              {t===''?'All':t==='INCOME'?'Income':'Expenses'}
            </button>
          ))}
        </div>
        <select value={vFilter??''} onChange={e=>setVFilter(e.target.value?+e.target.value:undefined)} className={`${inp} w-auto`}>
          <option value="">All Vehicles</option>
          {vehicles.map(v=><option key={v.id} value={v.id}>{v.name} ({v.registrationNo})</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-left">Vehicle</th>
              <th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.length===0
              ? <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No entries found.</td></tr>
              : entries.map(e=>(
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(e.date),'dd MMM yyyy')}</td>
                <td className="px-4 py-3"><Badge label={e.type==='INCOME'?'Income':'Expense'} variant={e.type==='INCOME'?'green':'red'}/></td>
                <td className="px-4 py-3 font-medium">{e.description}</td>
                <td className="px-4 py-3 text-gray-500">{e.vehicle?`${e.vehicle.name} (${e.vehicle.registrationNo})`:'—'}</td>
                <td className={`px-4 py-3 text-right font-semibold ${e.type==='INCOME'?'text-green-600':'text-red-600'}`}>
                  {e.type==='INCOME'?'+':'-'}{fmt(Number(e.amount))}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={()=>openEdit(e)} className="p-1.5 text-gray-400 hover:text-brand-600"><Pencil size={16}/></button>
                    <button onClick={()=>confirm('Delete this entry?')&&deleteMut.mutate(e.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={editing?'Edit Entry':'Add Entry'} open={modalOpen} onClose={close}>
        <form onSubmit={handleSubmit(d=>editing?updateMut.mutate(d):createMut.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select {...register('type')} className={`${inp} bg-white`}><option value="INCOME">Income</option><option value="EXPENSE">Expense</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" {...register('date')} className={inp}/>
              {errors.date&&<p className="text-red-500 text-xs mt-1">{errors.date.message}</p>}</div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <input {...register('description')} className={inp} placeholder="e.g. Trip payment received"/>
            {errors.description&&<p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}</div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount (ZAR) *</label>
              <input type="number" step="0.01" {...register('amount')} className={inp} placeholder="0.00"/>
              {errors.amount&&<p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Vehicle (optional)</label>
              <select {...register('vehicleId')} className={`${inp} bg-white`}>
                <option value="">No specific vehicle</option>
                {vehicles.map(v=><option key={v.id} value={v.id}>{v.name} ({v.registrationNo})</option>)}
              </select></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={close} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSubmitting||createMut.isPending||updateMut.isPending}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {(createMut.isPending||updateMut.isPending)&&<Loader2 className="animate-spin" size={16}/>}
              {editing?'Save Changes':'Add Entry'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
