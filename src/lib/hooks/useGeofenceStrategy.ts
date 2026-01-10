"use client";

/**
 * useGeofenceStrategy Hook
 *
 * Selects the optimal geofencing strategy based on detected platform capabilities.
 * This hook bridges the capability detection module with the geofence check system.
 *
 * Strategies:
 * - periodic-sync: Best for Chrome/Edge Android - background checks every 15-60min
 * - visibility-wakelock: Good for iOS Safari - foreground with wake lock during countdown
 * - visibility-polling: Fallback for Firefox - basic foreground polling
 * - manual-only: Last resort - no automatic geofencing
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  detectCapabilities,
  detectPlatform,
  determineGeofenceStrategy,
  determineFallbackStrategy,
  getCapabilityLimitations,
  getStrategyConfig,
  type PWACapabilities,
  type PlatformInfo,
  type GeofenceStrategy,
} from "@/lib/pwa/capabilities";
import { appLogger } from "@/lib/logging/appLogger";

export interface GeofenceStrategyState {
  isLoading: boolean;
  capabilities: PWACapabilities | null;
  platform: PlatformInfo | null;
  strategy: GeofenceStrategy;
  fallbackStrategy: GeofenceStrategy | null;
  limitations: string[];
  config: ReturnType<typeof getStrategyConfig>;
}

export interface UseGeofenceStrategyResult extends GeofenceStrategyState {
  refresh: () => Promise<void>;
  switchToFallback: () => void;
  isUsingFallback: boolean;
}

export function useGeofenceStrategy(): UseGeofenceStrategyResult {
  const [isLoading, setIsLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<PWACapabilities | null>(null);
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [_primaryStrategy, setPrimaryStrategy] = useState<GeofenceStrategy>("manual-only");
  const [fallbackStrategy, setFallbackStrategy] = useState<GeofenceStrategy | null>(null);
  const [currentStrategy, setCurrentStrategy] = useState<GeofenceStrategy>("manual-only");
  const [limitations, setLimitations] = useState<string[]>([]);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const detectAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const caps = await detectCapabilities();
      const plat = detectPlatform();
      const strategy = determineGeofenceStrategy(caps, plat);
      const fallback = determineFallbackStrategy(strategy, caps, plat);
      const limits = getCapabilityLimitations(caps, plat);

      setCapabilities(caps);
      setPlatform(plat);
      setPrimaryStrategy(strategy);
      setFallbackStrategy(fallback);
      setCurrentStrategy(strategy);
      setLimitations(limits);
      setIsUsingFallback(false);

      appLogger.info("Geofence strategy determined", {
        strategy,
        fallback,
        platform: plat.isIOS
          ? "iOS"
          : plat.isAndroid
            ? "Android"
            : "Desktop",
        capabilities: {
          periodicSync: caps.periodicBackgroundSync,
          backgroundSync: caps.backgroundSync,
          wakeLock: caps.wakeLock,
          push: caps.pushNotifications,
        },
      });
    } catch (error) {
      appLogger.error("Failed to detect geofence capabilities", { error });
      setCurrentStrategy("manual-only");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    detectAll();
  }, [detectAll]);

  const switchToFallback = useCallback(() => {
    if (fallbackStrategy && !isUsingFallback) {
      appLogger.info("Switching to fallback geofence strategy", {
        from: currentStrategy,
        to: fallbackStrategy,
      });
      setCurrentStrategy(fallbackStrategy);
      setIsUsingFallback(true);
    }
  }, [fallbackStrategy, currentStrategy, isUsingFallback]);

  const config = useMemo(
    () => getStrategyConfig(currentStrategy),
    [currentStrategy]
  );

  return useMemo(
    () => ({
      isLoading,
      capabilities,
      platform,
      strategy: currentStrategy,
      fallbackStrategy,
      limitations,
      config,
      refresh: detectAll,
      switchToFallback,
      isUsingFallback,
    }),
    [
      isLoading,
      capabilities,
      platform,
      currentStrategy,
      fallbackStrategy,
      limitations,
      config,
      detectAll,
      switchToFallback,
      isUsingFallback,
    ]
  );
}

/**
 * Hook to get strategy-specific behavior flags
 */
export function useStrategyBehavior(strategy: GeofenceStrategy) {
  return useMemo(() => {
    const config = getStrategyConfig(strategy);

    return {
      shouldPoll: config.pollIntervalMs > 0,
      pollIntervalMs: config.pollIntervalMs,
      shouldUseWakeLock: config.useWakeLock,
      shouldUsePushReminders: config.usePushReminders,
      debouncePolls: config.debouncePolls,
      strategyDescription: getStrategyDescription(strategy),
    };
  }, [strategy]);
}

function getStrategyDescription(strategy: GeofenceStrategy): string {
  switch (strategy) {
    case "periodic-sync":
      return "Background location checks (best experience)";
    case "visibility-wakelock":
      return "Foreground checks with screen wake lock";
    case "visibility-polling":
      return "Foreground checks when app is open";
    case "manual-only":
      return "Manual check-in/out only";
  }
}

/**
 * Hook to determine if push reminders should be initialized
 */
export function useShouldUsePushReminders(): boolean {
  const { strategy, capabilities } = useGeofenceStrategy();

  return useMemo(() => {
    if (!capabilities?.pushNotifications) return false;

    // Use push reminders for strategies that don't have background sync
    return strategy === "visibility-wakelock" || strategy === "visibility-polling";
  }, [strategy, capabilities]);
}
