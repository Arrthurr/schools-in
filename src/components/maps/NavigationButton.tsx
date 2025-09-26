"use client";

import { Button } from '@/components/ui/button';
import { Navigation, ExternalLink } from 'lucide-react';

interface NavigationButtonProps {
  destination: {
    lat: number;
    lng: number;
    address?: string;
    name?: string;
  };
  className?: string;
}

export function NavigationButton({ destination, className }: NavigationButtonProps) {
  const handleNavigation = () => {
    const { lat, lng, address, name } = destination;
    
    // Create Google Maps navigation URL
    const destinationStr = address || `${lat},${lng}`;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationStr)}`;
    
    // Open in new tab
    window.open(mapsUrl, '_blank');
  };

  return (
    <Button
      onClick={handleNavigation}
      variant="outline"
      className={className}
    >
      <Navigation className="h-4 w-4 mr-2" />
      Get Directions
      <ExternalLink className="h-3 w-3 ml-2" />
    </Button>
  );
}
