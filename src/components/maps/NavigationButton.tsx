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
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

function getPlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  
  const userAgent = navigator.userAgent || navigator.vendor || '';
  
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return 'ios';
  }
  
  if (/Android/.test(userAgent)) {
    return 'android';
  }
  
  return 'desktop';
}

function buildNavigationUrl(
  lat: number,
  lng: number,
  address?: string,
  name?: string
): string {
  const platform = getPlatform();
  const label = name || address || `${lat},${lng}`;
  
  switch (platform) {
    case 'ios':
      // Apple Maps URL scheme - works on iOS Safari
      // Using http:// version as it has better fallback support
      const iosDestination = address 
        ? encodeURIComponent(address)
        : `${lat},${lng}`;
      return `https://maps.apple.com/?daddr=${iosDestination}&dirflg=d`;
    
    case 'android':
      // geo: URI opens the default map app on Android
      // The q parameter adds a label to the destination
      return `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`;
    
    default:
      // Desktop/fallback: Google Maps web
      const destinationStr = address || `${lat},${lng}`;
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationStr)}`;
  }
}

export function NavigationButton({ 
  destination, 
  className,
  variant = "outline",
  size = "default"
}: NavigationButtonProps) {
  const handleNavigation = () => {
    const { lat, lng, address, name } = destination;
    const url = buildNavigationUrl(lat, lng, address, name);
    window.open(url, '_blank');
  };

  return (
    <Button
      onClick={handleNavigation}
      variant={variant}
      size={size}
      className={className}
    >
      <Navigation className="h-4 w-4 mr-2" />
      Get Directions
      <ExternalLink className="h-3 w-3 ml-2" />
    </Button>
  );
}

export { buildNavigationUrl, getPlatform };
