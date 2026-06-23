import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import GeofenceDrawer, { type LatLng } from '../../components/maps/GeofenceDrawer';
import { Plus, Trash2, Eye, Loader2, AlertCircle, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface Geofence {
  id: number;
  name: string;
  description: string | null;
  area: unknown;
  createdAt: string;
  _count: { events: number };
  vehicles: { vehicle: { id: number; name: string; registrationNo: string } }[];
}

export default function GeofencesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewGeo, setViewGeo] = useState<Geofence | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [drawnCoords, setDrawnCoords] = useState<LatLng[] | null>(null);

  const { data: geofences = [], isLoading, isError } = useQuery<Geofence[]>({
    queryKey: ['geofences'],
    queryFn: () => api.get('/geofences').then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (payload: { name: string; description?: string; area: LatLng[] }) =>
      api.post('/geofences', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['geofences'] });
      setCreateOpen(false);
      setName(''); setDesc(''); setDrawnCoords(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/geofences/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geofences'] }),
  });

  const openCreate = () => {
    setName(''); setDesc(''); setDrawnCoords(null);
    setCreateOpen(true);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-brand-600" size={32} />
    </div>
  );
  if (isError) return (
    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
      <AlertCircle size={20} /> Failed to load geofences.
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Geofences</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> New Geofence
        </button>
      </div>

      {geofences.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <MapPin size={44} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">No geofences defined yet</p>
          <p className="text-sm mt-1">Create zones to monitor vehicle entry and exit events.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Events</th>
                <th className="px-4 py-3 text-left">Vehicles</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {geofences.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{g.name}</td>
                  <td className="px-4 py-3 text-gray-500">{g.description ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{g._count.events}</td>
                  <td className="px-4 py-3 text-gray-500">{g.vehicles.length}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {format(new Date(g.createdAt), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setViewGeo(g)}
                        className="p-1.5 text-gray-400 hover:text-brand-600"
                        title="View on map"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete geofence "${g.name}"?`)) deleteMut.mutate(g.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create modal ── */}
      <Modal title="New Geofence" open={createOpen} onClose={() => setCreateOpen(false)} width="max-w-3xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="e.g. Johannesburg Depot"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                value={desc}
                onChange={e => setDesc(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Optional description"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Draw Zone *</label>
            <p className="text-xs text-gray-400 mb-2">
              Use the polygon tool at the top of the map to draw your geofence boundary. Existing zones are shown in green.
            </p>
            <GeofenceDrawer
              geofences={geofences}
              onAreaDrawn={coords => setDrawnCoords(coords)}
              height="380px"
            />
            {drawnCoords ? (
              <p className="text-xs text-green-600 mt-2">
                ✓ Zone drawn — {drawnCoords.length} vertices captured
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-2">No zone drawn yet</p>
            )}
          </div>

          {createMut.isError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={12} /> Failed to create geofence. Please try again.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!name.trim() || !drawnCoords) return;
                createMut.mutate({ name: name.trim(), description: desc.trim() || undefined, area: drawnCoords });
              }}
              disabled={!name.trim() || !drawnCoords || createMut.isPending}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60"
            >
              {createMut.isPending ? 'Creating…' : 'Create Geofence'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── View modal ── */}
      {viewGeo && (
        <Modal
          title={viewGeo.name}
          open={!!viewGeo}
          onClose={() => setViewGeo(null)}
          width="max-w-2xl"
        >
          <div className="space-y-3">
            {viewGeo.description && (
              <p className="text-sm text-gray-600">{viewGeo.description}</p>
            )}
            <div className="flex gap-4 text-xs text-gray-500">
              <span>{viewGeo._count.events} event{viewGeo._count.events !== 1 ? 's' : ''}</span>
              <span>{viewGeo.vehicles.length} vehicle{viewGeo.vehicles.length !== 1 ? 's' : ''} assigned</span>
            </div>
            <GeofenceDrawer
              geofences={[viewGeo]}
              focusGeofence={viewGeo}
              readOnly
              height="420px"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
