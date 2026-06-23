import { useState } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export interface VehiclePosition {
  vehicleId: number;
  vehicleName: string;
  registrationNo: string;
  latitude: number;
  longitude: number;
  speed?: number;
  bearing?: number;
  recordedAt: string;
}

interface Props {
  vehicles: VehiclePosition[];
  height?: string;
}

const CONTAINER_STYLE = { width: '100%', height: '100%' };
const CENTER_SA = { lat: -29.0, lng: 25.0 };

export default function FleetMap({ vehicles, height = '500px' }: Props) {
  const { isLoaded } = useGoogleMaps();
  const [activeId, setActiveId] = useState<number | null>(null);

  if (!isLoaded) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-gray-100 rounded-xl">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  const active = vehicles.find(v => v.vehicleId === activeId);

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden">
      <GoogleMap mapContainerStyle={CONTAINER_STYLE} center={CENTER_SA} zoom={6}>
        {vehicles.map(v => (
          <Marker
            key={v.vehicleId}
            position={{ lat: v.latitude, lng: v.longitude }}
            icon={{
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 5,
              fillColor: '#2563eb',
              fillOpacity: 1,
              strokeColor: '#1e3a8a',
              strokeWeight: 1.5,
              rotation: v.bearing ?? 0,
            }}
            title={`${v.vehicleName} (${v.registrationNo})`}
            onClick={() => setActiveId(activeId === v.vehicleId ? null : v.vehicleId)}
          />
        ))}

        {active && (
          <InfoWindow
            position={{ lat: active.latitude, lng: active.longitude }}
            onCloseClick={() => setActiveId(null)}
          >
            <div className="text-xs space-y-1 min-w-[150px]">
              <p className="font-semibold text-gray-900 text-sm">{active.vehicleName}</p>
              <p className="text-gray-500">{active.registrationNo}</p>
              {active.speed !== undefined && (
                <p className="text-gray-600 font-medium">{Math.round(active.speed)} km/h</p>
              )}
              <p className="text-gray-400">{format(new Date(active.recordedAt), 'dd MMM yyyy HH:mm')}</p>
              <p className="text-gray-400 font-mono text-[10px]">
                {active.latitude.toFixed(4)}, {active.longitude.toFixed(4)}
              </p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
