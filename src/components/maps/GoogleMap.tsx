"use client";

import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { useState, useEffect } from 'react';

interface GoogleMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: Array<{
    id: string;
    position: { lat: number; lng: number };
    title?: string;
    info?: string;
  }>;
  onMarkerClick?: (marker: any) => void;
  onMapClick?: (event: any) => void;
  className?: string;
}

export function GoogleMap({
  center,
  zoom = 10,
  markers = [],
  onMarkerClick,
  onMapClick,
  className = "h-96 w-full"
}: GoogleMapProps) {
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMarkerClick = (marker: any) => {
    setSelectedMarker(marker.id);
    onMarkerClick?.(marker);
  };

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <div className={`${className} ${isMobile ? 'touch-pan-x touch-pan-y' : ''}`}>
        <Map
          center={center}
          zoom={zoom}
          onClick={onMapClick}
          gestureHandling={isMobile ? "greedy" : "auto"}
          disableDefaultUI={isMobile}
          fullscreenControl={!isMobile}
          zoomControl={!isMobile}
          mapTypeControl={!isMobile}
          streetViewControl={!isMobile}
        >
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              position={marker.position}
              title={marker.title}
              onClick={() => handleMarkerClick(marker)}
            />
          ))}
          
          {selectedMarker && (
            <InfoWindow
              position={markers.find(m => m.id === selectedMarker)?.position}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-2">
                <h3 className="font-semibold">
                  {markers.find(m => m.id === selectedMarker)?.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {markers.find(m => m.id === selectedMarker)?.info}
                </p>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </APIProvider>
  );
}
