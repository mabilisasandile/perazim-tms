import { useCallback, useRef } from 'react';
import { GoogleMap, DrawingManager, Polygon } from '@react-google-maps/api';
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

  const onPolygonComplete = useCallback(
    (polygon: google.maps.Polygon) => {
      const path = polygon.getPath();
      const coords: LatLng[] = [];
      for (let i = 0; i < path.getLength(); i++) {
        const pt = path.getAt(i);
        coords.push({ lat: pt.lat(), lng: pt.lng() });
      }
      onAreaDrawn?.(coords);
      polygon.setMap(null);
    },
    [onAreaDrawn],
  );

  if (!isLoaded) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-gray-100 rounded-xl">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden">
      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={CENTER_SA}
        zoom={6}
        onLoad={onLoad}
      >
        {!readOnly && onAreaDrawn && (
          <DrawingManager
            drawingMode={google.maps.drawing.OverlayType.POLYGON}
            onPolygonComplete={onPolygonComplete}
            options={{
              drawingControl: true,
              drawingControlOptions: {
                position: google.maps.ControlPosition.TOP_CENTER,
                drawingModes: [google.maps.drawing.OverlayType.POLYGON],
              },
              polygonOptions: {
                fillColor: '#3b82f6',
                fillOpacity: 0.25,
                strokeColor: '#1d4ed8',
                strokeWeight: 2,
                editable: true,
              },
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
