import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2, AlertCircle, Eye, CheckCircle2, XCircle, Clock, DollarSign } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { format } from 'date-fns';

interface Payment {
  id:number; tripId:number; vehicleId:number; amount:string|number; method:string; status:'pending'|'paid'|'failed';
  reference:string|null; paidAt:string|null; createdAt:string;
  trip:{ id:number; trackingCode:string; fromLocation:string; toLocation:string; customer:{name:string}; };
}
interface Summary { total:{count:number;amount:number}; paid:{count:number;amount:number}; pending:{count:number;amount:number}; failed:{count:number;amount:number}; }

const schema = z.object({
  tripId:    z.coerce.number().int().positive('Trip is required'),
  vehicleId: z.coerce.number().int().positive('Vehicle is required'),
  amount:    z.coerce.number().positive('Amount required'),
  method:    z.enum(['payfast','manual','eft']).default('manual'),
  reference: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const fmt=(n:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(n);
const statusMeta:{[k:string]:{label:string;variant:'green'|'red'|'yellow'|'gray';icon:React.ElementType}}={
  paid:{label:'Paid',variant:'green',icon:CheckCircle2},
  pending:{label:'Pending',variant:'yellow',icon:Clock},
  failed:{label:'Failed',variant:'red',icon:XCircle},
};

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<Payment|null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data:payments=[], isLoading, isError } = useQuery<Payment[]>({
    queryKey:['payments',statusFilter],
    queryFn:()=>api.get('/payments',{params:statusFilter?{status:statusFilter}:{}}).then(r=>Array.isArray(r.data)?r.data:r.data?.data??[]),
  });
  const { data:summary } = useQuery<Summary>({ queryKey:['payments-summary'], queryFn:()=>api.get('/payments/summary').then(r=>r.data) });
  const { data:trips=[] } = useQuery<{id:number;trackingCode:string;fromLocation:string;toLocation:string;vehicleId:number}[]>({
    queryKey:['trips-select'], queryFn:()=>api.get('/trips').then(r=>(Array.isArray(r.data)?r.data:r.data?.data??[]).filter((t:any)=>t.status!=='CANCELLED')),
  });

  const { register, handleSubmit, reset, formState:{errors,isSubmitting} } = useForm<FormData>({ resolver:zodResolver(schema) });

  const createMut = useMutation({ mutationFn:(d:FormData)=>api.post('/payments',d), onSuccess:()=>{ qc.invalidateQueries({queryKey:['payments']}); qc.invalidateQueries({queryKey:['payments-summary']}); setModalOpen(false); reset(); }});
  const markPaidMut = useMutation({ mutationFn:({id,ref}:{id:number;ref?:string})=>api.patch(`/payments/${id}/mark-paid`,{reference:ref}), onSuccess:()=>{ qc.invalidateQueries({queryKey:['payments']}); qc.invalidateQueries({queryKey:['payments-summary']}); }});

  if(isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;
  if(isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20}/><span>Failed to load payments.</span></div>;

  const inp='w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <button onClick={()=>{ reset(); setModalOpen(true); }} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"><Plus size={16}/> Record Payment</button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {label:'Total',val:summary.total.amount,count:summary.total.count,clr:'text-gray-900',bg:'bg-gray-100',icon:DollarSign},
            {label:'Paid',val:summary.paid.amount,count:summary.paid.count,clr:'text-green-600',bg:'bg-green-100',icon:CheckCircle2},
            {label:'Pending',val:summary.pending.amount,count:summary.pending.count,clr:'text-yellow-600',bg:'bg-yellow-100',icon:Clock},
            {label:'Failed',val:summary.failed.amount,count:summary.failed.count,clr:'text-red-600',bg:'bg-red-100',icon:XCircle},
          ].map(({label,val,count,clr,bg,icon:Icon})=>(
            <div key={label} className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-2"><div className={`p-2 ${bg} rounded-lg`}><Icon className={clr} size={18}/></div><p className="text-sm font-medium text-gray-500">{label}</p></div>
              <p className={`text-xl font-bold ${clr}`}>{fmt(val)}</p>
              <p className="text-xs text-gray-400 mt-1">{count} payments</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {['','pending','paid','failed'].map(s=>(
          <button key={s} onClick={()=>setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter===s?'bg-brand-600 text-white':'bg-white border text-gray-600 hover:border-brand-500'}`}>
            {s===''?'All':s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr><th className="px-4 py-3 text-left">Trip</th><th className="px-4 py-3 text-left">Customer</th><th className="px-4 py-3 text-left">Method</th><th className="px-4 py-3 text-left">Reference</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Paid At</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.length===0
              ? <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No payments found.</td></tr>
              : payments.map(p=>{
              const sm=statusMeta[p.status]??{label:p.status,variant:'gray' as const,icon:Clock};
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.trip.trackingCode.slice(0,8)}…</td>
                  <td className="px-4 py-3 font-medium">{p.trip.customer.name}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{p.method}</td>
                  <td className="px-4 py-3 text-gray-500">{p.reference??'—'}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(Number(p.amount))}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.paidAt?format(new Date(p.paidAt),'dd MMM yyyy'):'—'}</td>
                  <td className="px-4 py-3"><Badge label={sm.label} variant={sm.variant}/></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={()=>setViewing(p)} className="p-1.5 text-gray-400 hover:text-brand-600"><Eye size={15}/></button>
                      {p.status==='pending'&&<button onClick={()=>markPaidMut.mutate({id:p.id})} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100" title="Mark as paid"><CheckCircle2 size={13}/></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal title="Record Payment" open={modalOpen} onClose={()=>setModalOpen(false)}>
        <form onSubmit={handleSubmit(d=>createMut.mutate(d))} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Trip *</label>
            <select {...register('tripId')} onChange={e=>{ const t=trips.find(t=>t.id===+e.target.value); if(t) reset(prev=>({...prev,tripId:t.id,vehicleId:t.vehicleId})); }} className={`${inp} bg-white`}>
              <option value="">Select trip</option>
              {trips.map(t=><option key={t.id} value={t.id}>{t.trackingCode.slice(0,8)} — {t.fromLocation} → {t.toLocation}</option>)}
            </select>
            {errors.tripId&&<p className="text-red-500 text-xs mt-1">{errors.tripId.message}</p>}</div>
          <input type="hidden" {...register('vehicleId')}/>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount (ZAR) *</label>
              <input type="number" step="0.01" {...register('amount')} className={inp}/>
              {errors.amount&&<p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Method *</label>
              <select {...register('method')} className={`${inp} bg-white`}><option value="manual">Manual</option><option value="eft">EFT</option><option value="payfast">PayFast</option></select></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Reference</label><input {...register('reference')} className={inp} placeholder="e.g. bank ref or invoice number"/></div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={()=>setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSubmitting||createMut.isPending} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {createMut.isPending&&<Loader2 className="animate-spin" size={16}/>} Record Payment
            </button>
          </div>
        </form>
      </Modal>

      {viewing&&(
        <Modal title={`Payment #${viewing.id}`} open={!!viewing} onClose={()=>setViewing(null)}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {([['Trip',viewing.trip.trackingCode.slice(0,12)+'…'],['Customer',viewing.trip.customer.name],
               ['Route',`${viewing.trip.fromLocation} → ${viewing.trip.toLocation}`],
               ['Amount',fmt(Number(viewing.amount))],['Method',viewing.method],
               ['Reference',viewing.reference??'—'],['Status',viewing.status],
               ['Paid At',viewing.paidAt?format(new Date(viewing.paidAt),'dd MMM yyyy HH:mm'):'—']] as [string,string][])
              .map(([l,v])=><div key={l}><p className="text-gray-500">{l}</p><p className="font-medium">{v}</p></div>)}
          </div>
        </Modal>
      )}
    </div>
  );
}
