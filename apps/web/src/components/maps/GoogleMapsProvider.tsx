import { createContext, useContext } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import type { Libraries } from '@react-google-maps/api';

const LIBRARIES: Libraries = ['places', 'drawing'];

interface Ctx { isLoaded: boolean; }
const MapsCtx = createContext<Ctx>({ isLoaded: false });

export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
    libraries: LIBRARIES,
  });
  return <MapsCtx.Provider value={{ isLoaded }}>{children}</MapsCtx.Provider>;
}

export const useGoogleMaps = () => useContext(MapsCtx);
