"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Smartphone, Monitor } from "lucide-react";

export function PWAStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isPWA, setIsPWA] = useState(false);
  const [installStatus, setInstallStatus] = useState<'not-supported' | 'installable' | 'installed'>('not-supported');

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if running as PWA
    const isPWAMode = window.matchMedia('(display-mode: standalone)').matches || 
                     (window.navigator as any).standalone ||
                     document.referrer.includes('android-app://');
    
    setIsPWA(isPWAMode);

    // Check installation status
    if (isPWAMode) {
      setInstallStatus('installed');
    } else if ('beforeinstallprompt' in window) {
      setInstallStatus('installable');
    } else {
      setInstallStatus('not-supported');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Connection Status */}
      <Badge variant={isOnline ? "secondary" : "destructive"} className="flex items-center gap-1">
        {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        {isOnline ? 'Online' : 'Offline'}
      </Badge>

      {/* PWA Status */}
      {isPWA && (
        <Badge variant="default" className="flex items-center gap-1">
          <Smartphone className="h-3 w-3" />
          App Mode
        </Badge>
      )}

      {/* Installation Status */}
      {installStatus === 'installable' && (
        <Badge variant="outline" className="flex items-center gap-1">
          <Monitor className="h-3 w-3" />
          Installable
        </Badge>
      )}
    </div>
  );
}
