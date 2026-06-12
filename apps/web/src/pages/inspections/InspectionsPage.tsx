import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2, AlertCircle, Eye, Trash2, Settings, CheckCircle2, XCircle, MinusCircle, PlusCircle } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { format } from 'date-fns';

interface InspItem { id:number; name:string; isActive:boolean; order:number; }
interface InspCategory { id:number; name:string; isActive:boolean; order:number; items:InspItem[]; }
interface Inspection {
  id:number; tripId:number; driverId:number; data:Record<string,string>; remarks:string|null; createdAt:string;
  driver:{id:number;name:string}; trip:{id:number;trackingCode:string;fromLocation:string;toLocation:string};
}

const inspSchema = z.object({
  tripId:   z.coerce.number().int().positive('Trip is required'),
  driverId: z.coerce.number().int().positive('Driver is required'),
  remarks:  z.string().optional(),
});
type InspForm = z.infer<typeof inspSchema>;

const catSchema = z.object({ name:z.string().min(1,'Name required') });
const itemSchema = z.object({ name:z.string().min(1,'Name required') });

const resultMeta:{[k:string]:{label:string;cls:string;icon:React.ElementType}} = {
  pass: {label:'Pass',cls:'text-green-600',icon:CheckCircle2},
  fail: {label:'Fail',cls:'text-red-600',icon:XCircle},
  na:   {label:'N/A', cls:'text-gray-400',icon:MinusCircle},
};

export default function InspectionsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'inspections'|'checklist'>('inspections');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<Inspection|null>(null);
  const [results, setResults] = useState<Record<number,string>>({});
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addItemCat, setAddItemCat] = useState<number|null>(null);

  const { data:categories=[] } = useQuery<InspCategory[]>({ queryKey:['inspection-categories'], queryFn:()=>api.get('/inspections/categories').then(r=>r.data) });
  const { data:inspections=[], isLoading, isError } = useQuery<Inspection[]>({ queryKey:['inspections'], queryFn:()=>api.get('/inspections').then(r=>Array.isArray(r.data)?r.data:r.data?.data??[]) });
  const { data:trips=[] } = useQuery<{id:number;trackingCode:string;fromLocation:string;toLocation:string}[]>({ queryKey:['trips-select'], queryFn:()=>api.get('/trips').then(r=>(Array.isArray(r.data)?r.data:r.data?.data??[]).filter((t:any)=>t.status!=='CANCELLED')) });
  const { data:drivers=[] } = useQuery<{id:number;name:string}[]>({ queryKey:['drivers-select'], queryFn:()=>api.get('/drivers').then(r=>(Array.isArray(r.data)?r.data:r.data?.data??[]).filter((d:any)=>d.isActive)) });

  const { register:rInsp, handleSubmit:hInsp, reset:resetInsp, formState:{errors:eInsp,isSubmitting:subInsp} } = useForm<InspForm>({resolver:zodResolver(inspSchema)});
  const { register:rCat, handleSubmit:hCat, reset:resetCat } = useForm<{name:string}>({resolver:zodResolver(catSchema)});
  const { register:rItem, handleSubmit:hItem, reset:resetItem } = useForm<{name:string}>({resolver:zodResolver(itemSchema)});

  const allItems = categories.flatMap(c=>c.items);

  const createMut = useMutation({
    mutationFn:(d:InspForm)=>api.post('/inspections',{...d,data:results}),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['inspections']}); setModalOpen(false); resetInsp(); setResults({}); },
  });
  const deleteMut = useMutation({ mutationFn:(id:number)=>api.delete(`/inspections/${id}`), onSuccess:()=>qc.invalidateQueries({queryKey:['inspections']}) });
  const addCatMut = useMutation({ mutationFn:(d:{name:string})=>api.post('/inspections/categories',d), onSuccess:()=>{ qc.invalidateQueries({queryKey:['inspection-categories']}); setAddCatOpen(false); resetCat(); } });
  const addItemMut = useMutation({ mutationFn:({catId,name}:{catId:number;name:string})=>api.post(`/inspections/categories/${catId}/items`,{name}), onSuccess:()=>{ qc.invalidateQueries({queryKey:['inspection-categories']}); setAddItemCat(null); resetItem(); } });
  const delCatMut = useMutation({ mutationFn:(id:number)=>api.delete(`/inspections/categories/${id}`), onSuccess:()=>qc.invalidateQueries({queryKey:['inspection-categories']}) });
  const delItemMut = useMutation({ mutationFn:(id:number)=>api.delete(`/inspections/items/${id}`), onSuccess:()=>qc.invalidateQueries({queryKey:['inspection-categories']}) });

  const openNew = () => {
    resetInsp(); setResults(Object.fromEntries(allItems.map(i=>[i.id,'pass']))); setModalOpen(true);
  };

  if(isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-600" size={32}/></div>;
  if(isError) return <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl"><AlertCircle size={20}/><span>Failed to load inspections.</span></div>;

  const inp='w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
        <div className="flex items-center gap-3">
          <button onClick={()=>setTab(tab==='inspections'?'checklist':'inspections')}
            className="flex items-center gap-2 px-4 py-2 border text-sm font-medium rounded-lg hover:bg-gray-50">
            <Settings size={16}/> {tab==='inspections'?'Manage Checklist':'View Inspections'}
          </button>
          {tab==='inspections'&&<button onClick={openNew} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"><Plus size={16}/> New Inspection</button>}
        </div>
      </div>

      {tab==='inspections' ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Trip</th><th className="px-4 py-3 text-left">Driver</th><th className="px-4 py-3 text-left">Route</th><th className="px-4 py-3 text-left">Items</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inspections.length===0
                ? <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No inspections yet.</td></tr>
                : inspections.map(i=>{
                const data=i.data||{};
                const fails=Object.values(data).filter(v=>v==='fail').length;
                return (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(i.createdAt),'dd MMM yyyy')}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{i.trip?.trackingCode?.slice(0,8)??'—'}…</td>
                    <td className="px-4 py-3 font-medium">{i.driver?.name??'—'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{i.trip?.fromLocation??'—'} → {i.trip?.toLocation??'—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${fails>0?'text-red-600':'text-green-600'}`}>
                        {fails>0?`${fails} fail${fails!==1?'s':''}`:'All pass'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={()=>setViewing(i)} className="p-1.5 text-gray-400 hover:text-brand-600"><Eye size={16}/></button>
                        <button onClick={()=>confirm('Delete this inspection?')&&deleteMut.mutate(i.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={()=>setAddCatOpen(true)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"><Plus size={16}/> Add Category</button>
          </div>
          {categories.map(cat=>(
            <div key={cat.id} className="bg-white rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b">
                <p className="font-semibold text-gray-900">{cat.name}</p>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setAddItemCat(cat.id)} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"><PlusCircle size={13}/> Add item</button>
                  <button onClick={()=>confirm(`Delete category "${cat.name}"?`)&&delCatMut.mutate(cat.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14}/></button>
                </div>
              </div>
              <div className="divide-y">
                {cat.items.length===0
                  ? <p className="px-5 py-3 text-sm text-gray-400 italic">No items yet.</p>
                  : cat.items.map(item=>(
                  <div key={item.id} className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-sm text-gray-700">{item.name}</span>
                    <button onClick={()=>confirm(`Delete item "${item.name}"?`)&&delItemMut.mutate(item.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {categories.length===0&&<div className="bg-white rounded-xl border p-10 text-center text-gray-400">No inspection categories yet. Add one to get started.</div>}
        </div>
      )}

      {/* New Inspection Modal */}
      <Modal title="New Inspection" open={modalOpen} onClose={()=>setModalOpen(false)} width="max-w-3xl">
        <form onSubmit={hInsp(d=>createMut.mutate(d))} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Trip *</label>
              <select {...rInsp('tripId')} className={`${inp} bg-white`}>
                <option value="">Select trip</option>
                {trips.map(t=><option key={t.id} value={t.id}>{t.trackingCode.slice(0,8)} — {t.fromLocation} → {t.toLocation}</option>)}
              </select>{eInsp.tripId&&<p className="text-red-500 text-xs mt-1">{eInsp.tripId.message}</p>}</div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Driver *</label>
              <select {...rInsp('driverId')} className={`${inp} bg-white`}>
                <option value="">Select driver</option>
                {drivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
              </select>{eInsp.driverId&&<p className="text-red-500 text-xs mt-1">{eInsp.driverId.message}</p>}</div>
          </div>

          {categories.map(cat=>(
            <div key={cat.id}>
              <p className="text-sm font-semibold text-gray-700 mb-2">{cat.name}</p>
              <div className="grid grid-cols-1 gap-2">
                {cat.items.map(item=>(
                  <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">{item.name}</span>
                    <div className="flex gap-2">
                      {['pass','fail','na'].map(r=>{
                        const m=resultMeta[r]; const active=results[item.id]===r;
                        return (
                          <button type="button" key={r} onClick={()=>setResults(p=>({...p,[item.id]:r}))}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors border ${active?`${m.cls} bg-white border-current`:'text-gray-400 border-transparent hover:border-gray-300'}`}>
                            <m.icon size={13}/>{m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div><label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label><textarea {...rInsp('remarks')} rows={3} className={inp} placeholder="Optional remarks or notes..."/></div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={()=>setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={subInsp||createMut.isPending} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">
              {createMut.isPending&&<Loader2 className="animate-spin" size={16}/>} Save Inspection
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Category Modal */}
      <Modal title="Add Category" open={addCatOpen} onClose={()=>setAddCatOpen(false)}>
        <form onSubmit={hCat(d=>addCatMut.mutate(d))} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label><input {...rCat('name')} className={inp} placeholder="e.g. Engine"/></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={()=>setAddCatOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={addCatMut.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">{addCatMut.isPending?'Adding...':'Add Category'}</button>
          </div>
        </form>
      </Modal>

      {/* Add Item Modal */}
      <Modal title="Add Inspection Item" open={addItemCat!==null} onClose={()=>setAddItemCat(null)}>
        <form onSubmit={hItem(d=>addItemMut.mutate({catId:addItemCat!,name:d.name}))} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label><input {...rItem('name')} className={inp} placeholder="e.g. Oil level"/></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={()=>setAddItemCat(null)} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={addItemMut.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60">{addItemMut.isPending?'Adding...':'Add Item'}</button>
          </div>
        </form>
      </Modal>

      {/* View Inspection Modal */}
      {viewing&&(
        <Modal title={`Inspection — ${viewing.driver?.name??'Unknown'}`} open={!!viewing} onClose={()=>setViewing(null)} width="max-w-2xl">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-gray-500">Trip</p><p className="font-mono font-medium">{viewing.trip?.trackingCode??'—'}</p></div>
              <div><p className="text-gray-500">Route</p><p className="font-medium">{viewing.trip?.fromLocation??'—'} → {viewing.trip?.toLocation??'—'}</p></div>
              <div><p className="text-gray-500">Driver</p><p className="font-medium">{viewing.driver?.name??'—'}</p></div>
              <div><p className="text-gray-500">Date</p><p className="font-medium">{format(new Date(viewing.createdAt),'dd MMM yyyy HH:mm')}</p></div>
            </div>
            {categories.map(cat=>{
              const catItems=cat.items.filter(i=>viewing.data[i.id]);
              if(!catItems.length) return null;
              return (
                <div key={cat.id}>
                  <p className="font-semibold text-gray-700 mb-2">{cat.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {catItems.map(item=>{
                      const r=viewing.data[item.id]||'pass'; const m=resultMeta[r]||resultMeta.pass;
                      return <div key={item.id} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded">
                        <span className="text-gray-700">{item.name}</span>
                        <span className={`flex items-center gap-1 text-xs font-medium ${m.cls}`}><m.icon size={12}/>{m.label}</span>
                      </div>;
                    })}
                  </div>
                </div>
              );
            })}
            {viewing.remarks&&<div><p className="text-gray-500 mb-1">Remarks</p><p className="text-gray-700 bg-gray-50 rounded p-3">{viewing.remarks}</p></div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
