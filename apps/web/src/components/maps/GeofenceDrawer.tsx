import { useCallback, useRef, useState } from 'react';
import { GoogleMap, Polygon } from '@react-google-maps/api';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Loader2 } from 'lucide-react';

export interface LatLng { lat: number; lng: number; }

export interface GeofenceShape {
  id: number;
  name: string;
  area: unknown;
}

interface Props {
  geofences?: GeofenceShape[];
  onAreaDrawn?: (coords: LatLng[]) => void;
  height?: string;
  readOnly?: boolean;
  /** When set, the map auto-fits to this geofence on load */
  focusGeofence?: GeofenceShape;
}

const CONTAINER_STYLE = { width: '100%', height: '100%' };
const CENTER_SA = { lat: -29.0, lng: 25.0 };

export default function GeofenceDrawer({
  geofences = [],
  onAreaDrawn,
  height = '400px',
  readOnly = false,
  focusGeofence,
}: Props) {
  const { isLoaded } = useGoogleMaps();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState<LatLng[]>([]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      const target = focusGeofence ?? geofences[0];
      if (target) {
        const coords = extractCoords(target.area);
        if (coords.length) {
          const bounds = new google.maps.LatLngBounds();
          coords.forEach(c => bounds.extend(c));
          map.fitBounds(bounds, 60);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!isDrawing || !e.latLng) return;
      setDraftPoints(prev => [...prev, { lat: e.latLng!.lat(), lng: e.latLng!.lng() }]);
    },
    [isDrawing],
  );

  const startDrawing = useCallback(() => {
    setDraftPoints([]);
    setIsDrawing(true);
  }, []);

  const cancelDrawing = useCallback(() => {
    setDraftPoints([]);
    setIsDrawing(false);
  }, []);

  const finishDrawing = useCallback(() => {
    if (draftPoints.length >= 3) {
      onAreaDrawn?.(draftPoints);
    }
    setDraftPoints([]);
    setIsDrawing(false);
  }, [draftPoints, onAreaDrawn]);

  if (!isLoaded) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-gray-100 rounded-xl">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden relative">
      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={CENTER_SA}
        zoom={6}
        onLoad={onLoad}
        onClick={handleMapClick}
        options={{ disableDoubleClickZoom: isDrawing, cursor: isDrawing ? 'crosshair' : undefined }}
      >
        {isDrawing && draftPoints.length >= 2 && (
          <Polygon
            paths={draftPoints}
            options={{
              fillColor: '#3b82f6',
              fillOpacity: 0.2,
              strokeColor: '#1d4ed8',
              strokeWeight: 2,
              editable: false,
            }}
          />
        )}

        {geofences.map(g => {
          const coords = extractCoords(g.area);
          if (!coords.length) return null;
          return (
            <Polygon
              key={g.id}
              paths={coords}
              options={{
                fillColor: '#10b981',
                fillOpacity: 0.2,
                strokeColor: '#059669',
                strokeWeight: 2,
              }}
            />
          );
        })}
      </GoogleMap>

      {!readOnly && onAreaDrawn && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white rounded-lg shadow-md px-3 py-2 text-sm">
          {!isDrawing ? (
            <button
              onClick={startDrawing}
              className="font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              </svg>
              Draw Geofence
            </button>
          ) : (
            <>
              <span className="text-gray-500 text-xs">
                {draftPoints.length === 0
                  ? 'Click on the map to place points'
                  : `${draftPoints.length} point${draftPoints.length !== 1 ? 's' : ''} — keep clicking to add more`}
              </span>
              <button
                onClick={finishDrawing}
                disabled={draftPoints.length < 3}
                className="text-xs font-medium bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Finish
              </button>
              <button
                onClick={cancelDrawing}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function extractCoords(area: unknown): LatLng[] {
  if (!area) return [];
  if (Array.isArray(area) && (area as LatLng[])[0]?.lat !== undefined) return area as LatLng[];
  const a = area as Record<string, unknown>;
  if (a.type === 'Feature' && (a.geometry as Record<string, unknown>)?.type === 'Polygon') {
    const coords = ((a.geometry as Record<string, unknown>).coordinates as number[][][])[0];
    return coords.map(([lng, lat]) => ({ lat, lng }));
  }
  if (a.type === 'Polygon') {
    const coords = (a.coordinates as number[][][])[0];
    return coords.map(([lng, lat]) => ({ lat, lng }));
  }
  return [];
}
