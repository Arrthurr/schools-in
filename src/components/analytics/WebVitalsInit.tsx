"use client";

import { useEffect } from "react";
import { webVitalsMonitor } from "@/lib/performance/webVitals";
import { useAuth } from "@/lib/hooks/useAuth";

export function WebVitalsInit() {
  const { user } = useAuth();

  useEffect(() => {
    // Touch the monitor to ensure module side-effects run
    if (user?.uid) {
      webVitalsMonitor.setUserId(user.uid);
    }
  }, [user?.uid]);

  return null;
}

export default WebVitalsInit;
