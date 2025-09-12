"use client";

import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";

export function NetworkStatusIndicator() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white p-4 text-center z-50 flex items-center justify-center">
      <WifiOff className="mr-2 h-5 w-5" />
      <p>You are currently offline. Some features may be unavailable.</p>
    </div>
  );
}
