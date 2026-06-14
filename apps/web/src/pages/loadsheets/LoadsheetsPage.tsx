import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2, AlertCircle, Eye, Trash2, PlusCircle } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { format } from 'date-fns';

interface LoadItem { description:string; registration:string; make:string; colour:string; vin:string; condition:string; vehicleStatus:string; }
interface SheetData { items:LoadItem[]; }
interface LoadSheet {
  id:number; notes:string|null; createdAt:string;
  driver:{id:number;name:string;mobile:string};
  vehicle:{id:number;name:string;registrationNo:string};
  trailer:{id:number;registrationNo:string}|null;
  data:SheetData|any;
}

const itemSchema = z.object({
  description:   z.string().min(1,'Required'),
  registration:  z.string().optional().default(''),
  make:          z.string().optional().default(''),
  colour:        z.string().optional().default(''),
  vin:           z.string().optional().default(''),
  condition:     z.enum(['Good','Fair','Poor']).default('Good'),
  vehicleStatus: z.enum(['Runner','Non-Runner']).default('Runner'),
});
const schema = z.object({
  driverId:  z.coerce.number().int().positive('Driver required'),
  vehicleId: z.coerce.number().int().positive('Vehicle required'),
  trailerId: z.coerce.number().int().positive().optional().nullable(),
  notes:     z.string().optional(),
  items:     z.array(itemSchema).min(1,'At least one item required'),
});
type FormData = z.infer<typeof schema>;

const norm=(r:unknown):any[]=>{ if(Array.isArray(r)) return r; if(r&&typeof r==='object') for(const k of['data','items','results']) if(Array.isArray((r as any)[k])) return (r as any)[k]; return []; };

export default function LoadsheetsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<LoadSheet|null>(null);

  const { data:sheets=[], isLoading, isError } = useQuery<LoadSheet[]>({ queryKey:['loadsheets'], queryFn:()=>api.get('/loadsheets').then(r=>norm(r.data)) });
  const { data:drivers=[] } = useQuery<{id:number;name:string}[]>({ queryKey:['drivers-select'], queryFn:()=>api.get('/drivers').then(r=>norm(r.data).filter((d:any)=>d.isActive)) });
  const { data:vehicles=[] } = useQuery<{id:number;name:string;registrationNo:string}[]>({ queryKey:['vehicles-select'], queryFn:()=>api.get('/vehicles').then(r=>norm(r.data).filter((v:any)=>v.isActive)) });
  const { data:trailers=[] } = useQuery<{id:number;registrationNo:string}[]>({ queryKey:['trailers-select'], queryFn:()=>api.get('/trailers').then(r=>norm(r.data).filter((t:any)=>t.isActive)) });

  const { register, handleSubmit, control, reset, formState:{errors,isSubmitting} } = useForm<FormData>({
    resolver:zodResolver(schema),
    defaultValues:{items:[{description:'',registration:'',make:'',colour:'',vin:'',condition:'Good',vehicleStatus:'Runner'}]},
  });
  const { fields, append, remove } = useFieldArray({control, name:'items'});

  const createMut = useMutation({
    mutationFn:(d:FormData)=>api.post('/loadsheets',{driverId:d.driverId,vehicleId:d.vehicleId,trailerId:d.trailerId||null,notes:d.notes,data:{items:d.items}}),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['loadsheets']}); setModalOpen(false); reset(); },
  });
  const deleteMut = useMutation({ mutationFn:(id:number)=>api.delete(`/loadsheets/${id}`), onSuccess:()=>qc.invalidateQueries({queryKey:['loadsheets']}) });

  if(isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;
  if(isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20}/><span>Failed to load sheets.</span></div>;

  const inp='w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
  const condCls:{[k:string]:string}={Good:'text-green-600',Fair:'text-yellow-600',Poor:'text-red-600'};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Load Sheets</h1>
        <button onClick={()=>{ reset({items:[{description:'',registration:'',make:'',colour:'',vin:'',condition:'Good',vehicleStatus:'Runner'}]}); setModalOpen(true); }} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"><Plus size={16}/> New Load Sheet</button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Driver</th><th className="px-4 py-3 text-left">Vehicle</th><th className="px-4 py-3 text-left">Trailer</th><th className="px-4 py-3 text-left">Items</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sheets.length===0
              ? <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No load sheets yet.</td></tr>
              : sheets.map(s=>(
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(s.createdAt),'dd MMM yyyy')}</td>
                <td className="px-4 py-3 font-medium">{s.driver?.name??'—'}</td>
                <td className="px-4 py-3 text-gray-500">{s.vehicle?.name??'—'} ({s.vehicle?.registrationNo??'—'})</td>
                <td className="px-4 py-3 text-gray-500">{s.trailer?.registrationNo??'—'}</td>
                <td className="px-4 py-3 text-gray-500">{s.data?.items?.length??0} vehicle{(s.data?.items?.length??0)!==1?'s':''}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={()=>setViewing(s)} className="p-1.5 text-gray-400 hover:text-brand-600"><Eye size={16}/></button>
                    <button onClick={()=>confirm('Delete this load sheet?')&&deleteMut.mutate(s.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title="New Load Sheet" open={modalOpen} onClose={()=>setModalOpen(false)} width="max-w-4xl">
        <form onSubmit={handleSubmit(d=>createMut.mutate(d))} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Driver *</label>
              <select {...register('driverId')} className={`${inp} bg-white`}><option value="">Select driver</option>{drivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
              {errors.driverId&&<p className="text-red-500 text-xs mt-1">{errors.driverId.message}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Vehicle *</label>
              <select {...register('vehicleId')} className={`${inp} bg-white`}><option value="">Select vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.name} ({v.registrationNo})</option>)}</select>
              {errors.vehicleId&&<p className="text-red-500 text-xs mt-1">{errors.vehicleId.message}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Trailer</label>
              <select {...register('trailerId')} className={`${inp} bg-white`}><option value="">No trailer</option>{trailers.map(t=><option key={t.id} value={t.id}>{t.registrationNo}</option>)}</select></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Vehicles Being Transported *</p>
              <button type="button" onClick={()=>append({description:'',registration:'',make:'',colour:'',vin:'',condition:'Good',vehicleStatus:'Runner'})} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"><PlusCircle size={14}/> Add vehicle</button>
            </div>
            <div className="space-y-3">
              {fields.map((field,i)=>(
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Description *</label>
                    <input {...register(`items.${i}.description`)} placeholder="e.g. Toyota Hilux" className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"/>
                    {errors.items?.[i]?.description&&<p className="text-red-500 text-xs">{errors.items[i]?.description?.message}</p>}
                  </div>
                  <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Reg No</label><input {...register(`items.${i}.registration`)} placeholder="ABC 123" className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"/></div>
                  <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Make</label><input {...register(`items.${i}.make`)} placeholder="Toyota" className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"/></div>
                  <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Colour</label><input {...register(`items.${i}.colour`)} placeholder="White" className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"/></div>
                  <div className="col-span-2"><label className="block text-xs text-gray-500 mb-1">Status</label>
                    <select {...register(`items.${i}.vehicleStatus`)} className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                      <option>Runner</option><option>Non-Runner</option>
                    </select></div>
                  <div className="col-span-1"><label className="block text-xs text-gray-500 mb-1">Condition</label>
                    <select {...register(`items.${i}.condition`)} className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                      <option>Good</option><option>Fair</option><option>Poor</option>
                    </select></div>
                  <div className="col-span-1 flex items-end justify-center pb-1">
                    {fields.length>1&&<button type="button" onClick={()=>remove(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>}
                  </div>
                </div>
              ))}
            </div>
            {errors.items?.root&&<p className="text-red-500 text-xs mt-1">{errors.items.root.message}</p>}
          </div>

          <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea {...register('notes')} rows={2} className={inp} placeholder="Optional notes..."/></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={()=>setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={isSubmitting||createMut.isPending} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {createMut.isPending&&<Loader2 className="animate-spin" size={16}/>} Create Load Sheet
            </button>
          </div>
        </form>
      </Modal>

      {viewing&&(
        <Modal title={`Load Sheet #${viewing.id}`} open={!!viewing} onClose={()=>setViewing(null)} width="max-w-2xl">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-gray-500">Driver</p><p className="font-medium">{viewing.driver?.name??'—'}</p></div>
              <div><p className="text-gray-500">Date</p><p className="font-medium">{format(new Date(viewing.createdAt),'dd MMM yyyy HH:mm')}</p></div>
              <div><p className="text-gray-500">Vehicle</p><p className="font-medium">{viewing.vehicle?.name} ({viewing.vehicle?.registrationNo})</p></div>
              <div><p className="text-gray-500">Trailer</p><p className="font-medium">{viewing.trailer?.registrationNo??'—'}</p></div>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-2">Loaded Vehicles ({viewing.data?.items?.length??0})</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border rounded-lg overflow-hidden">
                  <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-left">Reg</th><th className="px-3 py-2 text-left">Make</th><th className="px-3 py-2 text-left">Colour</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Condition</th></tr></thead>
                  <tbody className="divide-y">
                    {(viewing.data?.items??[]).map((item:LoadItem,i:number)=>(
                      <tr key={i}><td className="px-3 py-2">{item.description||'—'}</td><td className="px-3 py-2 text-gray-500">{item.registration||'—'}</td><td className="px-3 py-2 text-gray-500">{item.make||'—'}</td><td className="px-3 py-2 text-gray-500">{item.colour||'—'}</td>
                        <td className="px-3 py-2"><span className={`font-medium ${item.vehicleStatus==='Non-Runner'?'text-red-600':'text-green-600'}`}>{item.vehicleStatus||'—'}</span></td>
                        <td className="px-3 py-2"><span className={`font-medium ${condCls[item.condition]||''}`}>{item.condition||'—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {viewing.notes&&<div><p className="text-gray-500 mb-1">Notes</p><p className="bg-gray-50 rounded p-3">{viewing.notes}</p></div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
