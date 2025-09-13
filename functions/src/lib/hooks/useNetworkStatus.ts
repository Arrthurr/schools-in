// Network status hook for detecting connectivity changes
// Provides detailed network information and connection quality

import { useState, useEffect, useCallback } from "react";

export interface NetworkConnection {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
}

export interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean;
  connectionType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  lastOnlineAt?: number;
  lastOfflineAt?: number;
  connectivityScore: number; // 0-100 score based on connection quality
}

export interface UseNetworkStatusReturn extends NetworkStatus {
  // Connection quality assessment
  isHighQuality: boolean;
  isMediumQuality: boolean;
  isLowQuality: boolean;

  // Connection stability
  isStable: boolean;
  isUnstable: boolean;

  // Sync recommendations
  shouldSync: boolean;
  shouldDelaySync: boolean;

  // Event handlers
  onOnline: (callback: () => void) => void;
  onOffline: (callback: () => void) => void;
  onConnectionChange: (callback: (status: NetworkStatus) => void) => void;

  // Manual checks
  checkConnectivity: () => Promise<boolean>;
  ping: () => Promise<number>;
}

// Connection quality thresholds
const QUALITY_THRESHOLDS = {
  HIGH_DOWNLINK: 5, // Mbps
  MEDIUM_DOWNLINK: 1.5, // Mbps
  HIGH_RTT: 50, // ms
  MEDIUM_RTT: 150, // ms
  STABILITY_WINDOW: 30000, // 30 seconds
} as const;

export function useNetworkStatus(): UseNetworkStatusReturn {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isOnline: navigator.onLine,
    isConnected: navigator.onLine,
    connectionType: "unknown",
    effectiveType: "unknown",
    downlink: 0,
    rtt: 0,
    saveData: false,
    connectivityScore: navigator.onLine ? 50 : 0,
  }));

  const [listeners, setListeners] = useState<{
    online: Set<() => void>;
    offline: Set<() => void>;
    change: Set<(status: NetworkStatus) => void>;
  }>({
    online: new Set(),
    offline: new Set(),
    change: new Set(),
  });

  const [stabilityHistory, setStabilityHistory] = useState<
    {
      timestamp: number;
      isOnline: boolean;
    }[]
  >([]);

  // Calculate connectivity score based on network metrics
  const calculateConnectivityScore = useCallback(
    (
      isOnline: boolean,
      downlink: number,
      rtt: number,
      effectiveType: string
    ): number => {
      if (!isOnline) return 0;

      let score = 40; // Base score for being online

      // Downlink speed contribution (0-30 points)
      if (downlink >= QUALITY_THRESHOLDS.HIGH_DOWNLINK) {
        score += 30;
      } else if (downlink >= QUALITY_THRESHOLDS.MEDIUM_DOWNLINK) {
        score += 20;
      } else if (downlink > 0) {
        score += 10;
      }

      // RTT contribution (0-20 points)
      if (rtt <= QUALITY_THRESHOLDS.HIGH_RTT) {
        score += 20;
      } else if (rtt <= QUALITY_THRESHOLDS.MEDIUM_RTT) {
        score += 15;
      } else if (rtt > 0) {
        score += 5;
      }

      // Effective type contribution (0-10 points)
      switch (effectiveType) {
        case "4g":
          score += 10;
          break;
        case "3g":
          score += 7;
          break;
        case "2g":
          score += 3;
          break;
        case "slow-2g":
          score += 1;
          break;
      }

      return Math.min(100, Math.max(0, score));
    },
    []
  );

  // Update network status from Navigator APIs
  const updateNetworkStatus = useCallback(() => {
    const navigator = window.navigator as any;
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    const isOnline = navigator.onLine;
    const connectionType = connection?.type || "unknown";
    const effectiveType = connection?.effectiveType || "unknown";
    const downlink = connection?.downlink || 0;
    const rtt = connection?.rtt || 0;
    const saveData = connection?.saveData || false;

    const connectivityScore = calculateConnectivityScore(
      isOnline,
      downlink,
      rtt,
      effectiveType
    );

    const newStatus: NetworkStatus = {
      isOnline,
      isConnected: isOnline && connectivityScore > 20,
      connectionType,
      effectiveType,
      downlink,
      rtt,
      saveData,
      connectivityScore,
    };

    // Track connection timing
    setStatus((prevStatus) => {
      const now = Date.now();
      const updated = { ...newStatus };

      if (isOnline && !prevStatus.isOnline) {
        updated.lastOnlineAt = now;
      } else if (!isOnline && prevStatus.isOnline) {
        updated.lastOfflineAt = now;
      } else {
        updated.lastOnlineAt = prevStatus.lastOnlineAt;
        updated.lastOfflineAt = prevStatus.lastOfflineAt;
      }

      return updated;
    });

    // Update stability history
    setStabilityHistory((prev) => {
      const now = Date.now();
      const cutoff = now - QUALITY_THRESHOLDS.STABILITY_WINDOW;

      return [
        ...prev.filter((entry) => entry.timestamp > cutoff),
        { timestamp: now, isOnline },
      ];
    });
  }, [calculateConnectivityScore]);

  // Manual connectivity check via ping
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      const start = Date.now();
      const response = await fetch("/api/health", {
        method: "HEAD",
        cache: "no-cache",
        signal: AbortSignal.timeout(5000),
      });
      const end = Date.now();

      const isConnected = response.ok;
      const rtt = end - start;

      // Update status with real connectivity check
      setStatus((prev) => ({
        ...prev,
        isConnected,
        rtt: Math.min(prev.rtt || Infinity, rtt),
        connectivityScore: calculateConnectivityScore(
          isConnected,
          prev.downlink,
          rtt,
          prev.effectiveType
        ),
      }));

      return isConnected;
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        isConnected: false,
        connectivityScore: 0,
      }));
      return false;
    }
  }, [calculateConnectivityScore]);

  // Ping test for latency measurement
  const ping = useCallback(async (): Promise<number> => {
    try {
      const start = performance.now();
      await fetch("/api/health", {
        method: "HEAD",
        cache: "no-cache",
        signal: AbortSignal.timeout(3000),
      });
      const end = performance.now();
      return Math.round(end - start);
    } catch (error) {
      return -1; // Error indicator
    }
  }, []);

  // Event listener management
  const onOnline = useCallback((callback: () => void) => {
    setListeners((prev) => {
      const newOnline = new Set(prev.online);
      newOnline.add(callback);
      return {
        ...prev,
        online: newOnline,
      };
    });

    return () => {
      setListeners((prev) => {
        const newOnline = new Set(prev.online);
        newOnline.delete(callback);
        return {
          ...prev,
          online: newOnline,
        };
      });
    };
  }, []);

  const onOffline = useCallback((callback: () => void) => {
    setListeners((prev) => {
      const newOffline = new Set(prev.offline);
      newOffline.add(callback);
      return {
        ...prev,
        offline: newOffline,
      };
    });

    return () => {
      setListeners((prev) => {
        const newOffline = new Set(prev.offline);
        newOffline.delete(callback);
        return {
          ...prev,
          offline: newOffline,
        };
      });
    };
  }, []);

  const onConnectionChange = useCallback(
    (callback: (status: NetworkStatus) => void) => {
      setListeners((prev) => {
        const newChange = new Set(prev.change);
        newChange.add(callback);
        return {
          ...prev,
          change: newChange,
        };
      });

      return () => {
        setListeners((prev) => {
          const newChange = new Set(prev.change);
          newChange.delete(callback);
          return {
            ...prev,
            change: newChange,
          };
        });
      };
    },
    []
  );

  // Setup event listeners
  useEffect(() => {
    const handleOnline = () => {
      updateNetworkStatus();
      listeners.online.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error("Error in online callback:", error);
        }
      });
    };

    const handleOffline = () => {
      updateNetworkStatus();
      listeners.offline.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error("Error in offline callback:", error);
        }
      });
    };

    const handleConnectionChange = () => {
      updateNetworkStatus();
    };

    // Add native event listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Add connection change listeners if supported
    const navigator = window.navigator as any;
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (connection) {
      connection.addEventListener("change", handleConnectionChange);
    }

    // Initial status check
    updateNetworkStatus();

    // Periodic connectivity verification
    const verificationInterval = setInterval(async () => {
      if (status.isOnline) {
        await checkConnectivity();
      }
    }, 30000); // Every 30 seconds

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);

      if (connection) {
        connection.removeEventListener("change", handleConnectionChange);
      }

      clearInterval(verificationInterval);
    };
  }, [updateNetworkStatus, checkConnectivity, status.isOnline, listeners]);

  // Notify change listeners when status changes
  useEffect(() => {
    listeners.change.forEach((callback) => {
      try {
        callback(status);
      } catch (error) {
        console.error("Error in change callback:", error);
      }
    });
  }, [status, listeners.change]);

  // Calculate derived properties
  const isHighQuality = status.connectivityScore >= 80;
  const isMediumQuality =
    status.connectivityScore >= 50 && status.connectivityScore < 80;
  const isLowQuality =
    status.connectivityScore >= 20 && status.connectivityScore < 50;

  // Calculate stability
  const isStable =
    stabilityHistory.length >= 3 &&
    stabilityHistory
      .slice(-3)
      .every((entry) => entry.isOnline === status.isOnline);
  const isUnstable = !isStable && stabilityHistory.length >= 2;

  // Sync recommendations
  const shouldSync =
    status.isConnected && status.connectivityScore >= 30 && isStable;
  const shouldDelaySync =
    status.isOnline && (status.connectivityScore < 30 || isUnstable);

  return {
    ...status,
    isHighQuality,
    isMediumQuality,
    isLowQuality,
    isStable,
    isUnstable,
    shouldSync,
    shouldDelaySync,
    onOnline,
    onOffline,
    onConnectionChange,
    checkConnectivity,
    ping,
  };
}
