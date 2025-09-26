"use client";

import { useState, useCallback } from 'react';
import { GoogleMap } from './GoogleMap';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';

interface LocationPickerProps {
  initialLocation?: { lat: number; lng: number };
  onLocationSelect: (location: { lat: number; lng: number }) => void;
  className?: string;
}

export function LocationPicker({
  initialLocation = { lat: 41.8781, lng: -87.6298 }, // Chicago default
  onLocationSelect,
  className = "h-96 w-full"
}: LocationPickerProps) {
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);

  const handleMapClick = useCallback((event: any) => {
    const lat = event.detail.latLng.lat;
    const lng = event.detail.latLng.lng;
    const newLocation = { lat, lng };
    
    setSelectedLocation(newLocation);
    onLocationSelect(newLocation);
  }, [onLocationSelect]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MapPin className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">
            Click on the map to select location
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onLocationSelect(selectedLocation)}
        >
          <Navigation className="h-4 w-4 mr-2" />
          Use Selected Location
        </Button>
      </div>
      
      <GoogleMap
        center={selectedLocation}
        zoom={15}
        onMapClick={handleMapClick}
        markers={[{
          id: 'selected',
          position: selectedLocation,
          title: 'Selected Location'
        }]}
        className={className}
      />
      
      <div className="text-xs text-gray-500 font-mono">
        Lat: {selectedLocation.lat.toFixed(6)}, Lng: {selectedLocation.lng.toFixed(6)}
      </div>
    </div>
  );
}
