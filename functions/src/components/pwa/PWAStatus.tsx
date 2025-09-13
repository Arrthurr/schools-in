"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Wifi,
  WifiOff,
  Smartphone,
  Monitor,
  RefreshCw,
  Clock,
} from "lucide-react";
import { useOffline } from "@/lib/hooks/useOffline";

export function PWAStatus() {
  const [isPWA, setIsPWA] = useState(false);
  const [installStatus, setInstallStatus] = useState<
    "not-supported" | "installable" | "installed"
  >("not-supported");

  const { isOnline, syncInProgress, lastSyncTime } = useOffline();

  useEffect(() => {
    // Check if running as PWA
    const isPWAMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes("android-app://");

    setIsPWA(isPWAMode);

    // Check installation status
    if (isPWAMode) {
      setInstallStatus("installed");
    } else if ("beforeinstallprompt" in window) {
      setInstallStatus("installable");
    } else {
      setInstallStatus("not-supported");
    }
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Connection Status */}
      <Badge
        variant={isOnline ? "secondary" : "destructive"}
        className="flex items-center gap-1"
      >
        {isOnline ? (
          <Wifi className="h-3 w-3" />
        ) : (
          <WifiOff className="h-3 w-3" />
        )}
        {isOnline ? "Online" : "Offline"}
      </Badge>

      {/* Sync Status */}
      {syncInProgress && (
        <Badge variant="outline" className="flex items-center gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Syncing
        </Badge>
      )}

      {/* Last Sync Time */}
      {lastSyncTime && !syncInProgress && (
        <Badge variant="outline" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Synced {new Date(lastSyncTime).toLocaleTimeString()}
        </Badge>
      )}

      {/* PWA Status */}
      {isPWA && (
        <Badge variant="default" className="flex items-center gap-1">
          <Smartphone className="h-3 w-3" />
          App Mode
        </Badge>
      )}

      {/* Installation Status */}
      {installStatus === "installable" && (
        <Badge variant="outline" className="flex items-center gap-1">
          <Monitor className="h-3 w-3" />
          Installable
        </Badge>
      )}
    </div>
  );
}
