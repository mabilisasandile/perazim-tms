import { useCallback, useRef, useState } from 'react';
import { GoogleMap, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export interface RoutePosition {
  latitude: number;
  longitude: number;
  recordedAt: string;
}

interface Props {
  positions: RoutePosition[];
  height?: string;
}

const CONTAINER_STYLE = { width: '100%', height: '100%' };
const CENTER_SA = { lat: -29.0, lng: 25.0 };

export default function RouteMap({ positions, height = '320px' }: Props) {
  const { isLoaded } = useGoogleMaps();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      if (positions.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        positions.forEach(p => bounds.extend({ lat: p.latitude, lng: p.longitude }));
        map.fitBounds(bounds, 60);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!isLoaded) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-gray-100 rounded-xl">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-gray-100 rounded-xl">
        <p className="text-sm text-gray-400">No position data available yet</p>
      </div>
    );
  }

  const path = positions.map(p => ({ lat: p.latitude, lng: p.longitude }));

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden">
      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={CENTER_SA}
        zoom={6}
        onLoad={onLoad}
      >
        {positions.map((p, i) => (
          <Marker
            key={i}
            position={{ lat: p.latitude, lng: p.longitude }}
            icon={markerIcon(i, positions.length)}
            onClick={() => setActiveIdx(activeIdx === i ? null : i)}
          >
            {activeIdx === i && (
              <InfoWindow onCloseClick={() => setActiveIdx(null)}>
                <div className="text-xs space-y-0.5 min-w-[120px]">
                  <p className="font-semibold">
                    {i === 0 ? 'Start' : i === positions.length - 1 ? 'End' : `Stop ${i}`}
                  </p>
                  <p className="text-gray-500">{format(new Date(p.recordedAt), 'dd MMM HH:mm')}</p>
                  <p className="text-gray-400 font-mono text-[10px]">
                    {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                  </p>
                </div>
              </InfoWindow>
            )}
          </Marker>
        ))}
        {positions.length > 1 && (
          <Polyline
            path={path}
            options={{ strokeColor: '#2563eb', strokeOpacity: 0.8, strokeWeight: 3 }}
          />
        )}
      </GoogleMap>
    </div>
  );
}

function markerIcon(i: number, total: number): google.maps.Icon {
  if (i === 0) return { url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' };
  if (i === total - 1) return { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' };
  return {
    url: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
    scaledSize: new google.maps.Size(18, 18),
  };
}
