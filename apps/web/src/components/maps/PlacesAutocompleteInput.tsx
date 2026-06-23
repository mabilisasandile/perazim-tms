import { useRef, useEffect } from 'react';
import { useGoogleMaps } from './GoogleMapsProvider';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (name: string, lat: number, lng: number) => void;
  placeholder?: string;
  className?: string;
}

export default function PlacesAutocompleteInput({
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  className,
}: Props) {
  const { isLoaded } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  // Keep callback refs stable so the effect closure is always fresh
  const cbRef = useRef({ onChange, onPlaceSelect });
  cbRef.current = { onChange, onPlaceSelect };

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    const ac = new google.maps.places.Autocomplete(inputRef.current);

    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place?.geometry?.location) {
        const name = place.formatted_address ?? place.name ?? '';
        cbRef.current.onChange(name);
        cbRef.current.onPlaceSelect?.(name, place.geometry.location.lat(), place.geometry.location.lng());
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
      google.maps.event.clearInstanceListeners(ac);
    };
  }, [isLoaded]);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}
