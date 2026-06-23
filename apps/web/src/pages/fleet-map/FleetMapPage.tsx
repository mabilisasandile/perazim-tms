import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import FleetMap, { type VehiclePosition } from '../../components/maps/FleetMap';
import { Loader2, AlertCircle, RefreshCw, Truck } from 'lucide-react';
import { format } from 'date-fns';

interface LatestEntry {
  vehicle: { id: number; name: string; registrationNo: string };
  position: {
    latitude: number;
    longitude: number;
    speed: number | null;
    bearing: number | null;
    recordedAt: string;
  } | null;
}

export default function FleetMapPage() {
  const { data = [], isLoading, isError, dataUpdatedAt, refetch, isFetching } =
    useQuery<LatestEntry[]>({
      queryKey: ['positions-latest'],
      queryFn: () => api.get('/positions/latest').then(r => r.data),
      refetchInterval: 15_000,
    });

  const vehicles: VehiclePosition[] = data
    .filter(e => e.position !== null)
    .map(e => ({
      vehicleId:    e.vehicle.id,
      vehicleName:  e.vehicle.name,
      registrationNo: e.vehicle.registrationNo,
      latitude:     e.position!.latitude,
      longitude:    e.position!.longitude,
      speed:        e.position!.speed ?? undefined,
      bearing:      e.position!.bearing ?? undefined,
      recordedAt:   e.position!.recordedAt,
    }));

  const offlineCount = data.filter(e => e.position === null).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fleet Live Tracking</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {dataUpdatedAt > 0
              ? `Last updated ${format(new Date(dataUpdatedAt), 'HH:mm:ss')} · auto-refreshes every 15 s`
              : 'Loading…'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{vehicles.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">No GPS Signal</p>
          <p className="text-2xl font-bold text-gray-400 mt-1">{offlineCount}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Fleet</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">{data.length}</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-brand-600" size={32} />
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
          <AlertCircle size={20} /> Failed to load fleet positions.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
          <FleetMap vehicles={vehicles} height="560px" />
        </div>
      )}

      {/* Vehicle list */}
      {data.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
            <Truck size={15} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">Fleet Status</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {data.map(e => (
              <div key={e.vehicle.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{e.vehicle.name}</p>
                  <p className="text-xs text-gray-400">{e.vehicle.registrationNo}</p>
                </div>
                {e.position ? (
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-600">
                      {e.position.speed !== null ? `${Math.round(e.position.speed)} km/h` : 'Stationary'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(e.position.recordedAt), 'dd MMM HH:mm')}
                    </p>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">No signal</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
