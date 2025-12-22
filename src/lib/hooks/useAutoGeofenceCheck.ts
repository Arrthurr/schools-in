"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Location } from "@/lib/firebase/types";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useCachedSession } from "@/lib/hooks/useCachedSession";
import { useSession } from "@/lib/hooks/useSession";
import { useAutoGeofencePreference } from "@/lib/hooks/useAutoGeofencePreference";
import { locationService } from "@/lib/utils/location";
import { validateGeofence } from "@/lib/utils/geo";
import { getAssignedLocations } from "@/lib/services/locationService";
import { appLogger } from "@/lib/logging/appLogger";
import { toast } from "@/components/ui/use-toast";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { formatDuration } from "@/lib/utils/session";
import {
  saveGeofenceConfig,
  updateGeofenceActiveSession,
  updateGeofenceUserLocation,
  type GeofenceLocation,
} from "@/lib/offline/offlineDB";
import {
  registerPeriodicGeofenceSync,
  unregisterPeriodicGeofenceSync,
  setupGeofenceCheckListener,
} from "@/lib/pwa/periodicBackgroundSync";

type GeofenceState = "idle" | "outside" | "entering" | "inside" | "exiting";
type LocationPermission = "unknown" | "granted" | "denied" | "unavailable";

interface AutoGeofenceState {
  enabled: boolean;
  featureEnabled: boolean;
  geofenceState: GeofenceState;
  isPolling: boolean;
  lastDistanceMeters?: number;
  lastAccuracyMeters?: number;
  pausedReason?: "poor-accuracy" | null;
  activeCountdown?: {
    type: "checkin" | "checkout";
    locationId: string;
  } | null;
  /** Geolocation permission status: unknown until first attempt, then granted/denied/unavailable */
  locationPermission: LocationPermission;
}

interface CountdownConfig {
  id: string;
  title: string;
  initialDescription: string;
  ctaLabel: string;
  durationMs?: number;
  onConfirm: () => Promise<void> | void;
  onCancel?: () => void;
}

const POLL_INTERVAL_MS = 60_000;
const ACCURACY_THRESHOLD_METERS = 50;
const POOR_ACCURACY_LIMIT = 3;
const DEBOUNCE_POLLS = 2;
const COUNTDOWN_MS = 15_000;
const CANCEL_COOLDOWN_MS = 5 * 60_000;
const FEATURE_FLAG =
  process.env.NEXT_PUBLIC_FEATURE_AUTO_GEOFENCE !== "false";

export function useAutoGeofenceCheck(): AutoGeofenceState {
  const { user } = useCachedAuth();
  const { enabled: prefEnabled } = useAutoGeofencePreference();
  const { activeSession } = useCachedSession(user?.uid);
  const { checkIn, checkOut } = useSession();

  const [assignedLocations, setAssignedLocations] = useState<Location[]>([]);
  const [geofenceState, setGeofenceState] = useState<GeofenceState>("idle");
  const [isPolling, setIsPolling] = useState(false);
  const [lastDistanceMeters, setLastDistanceMeters] = useState<
    number | undefined
  >(undefined);
  const [lastAccuracyMeters, setLastAccuracyMeters] = useState<
    number | undefined
  >(undefined);
  const [pausedReason, setPausedReason] = useState<"poor-accuracy" | null>(
    null
  );
  const [activeCountdown, setActiveCountdown] = useState<
    AutoGeofenceState["activeCountdown"]
  >(null);
  const [locationPermission, setLocationPermission] = useState<LocationPermission>("unknown");

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const poorAccuracyCount = useRef(0);
  const insideStreak = useRef(0);
  const outsideStreak = useRef(0);
  const targetLocationId = useRef<string | null>(null);
  const cancelledCheckIn = useRef<Record<string, number>>({});
  const countdownCleanup = useRef<Record<string, () => void>>({});
  const activeCountdownRef = useRef<AutoGeofenceState["activeCountdown"]>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const swListenerCleanupRef = useRef<(() => void) | null>(null);
  const runPollRef = useRef<(() => void) | null>(null);

  const featureEnabled = FEATURE_FLAG && !!user?.uid;

  // ============================================
  // Wake Lock Management
  // ============================================
  const requestWakeLock = useCallback(async () => {
    if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        appLogger.info("Wake Lock acquired for countdown");

        wakeLockRef.current.addEventListener("release", () => {
          appLogger.info("Wake Lock released");
        });
      } catch (err) {
        appLogger.warn("Wake Lock request failed", { error: err });
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  const refreshAssignedLocations = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const locations = await getAssignedLocations(user.uid);
      setAssignedLocations(locations);
    } catch (error) {
      appLogger.warn("Failed to load assigned locations for geofence", {
        error,
      });
    }
  }, [user?.uid]);

  // Load assignments when enabled
  useEffect(() => {
    if (!prefEnabled || !featureEnabled) return;
    refreshAssignedLocations();
  }, [prefEnabled, featureEnabled, refreshAssignedLocations]);

  // ============================================
  // Sync geofence config to IndexedDB for SW access
  // ============================================
  useEffect(() => {
    if (!user?.uid || !prefEnabled || !featureEnabled) return;

    const syncConfig = async () => {
      try {
        // Convert locations to GeofenceLocation format
        const geofenceLocations: GeofenceLocation[] = assignedLocations.map(
          (loc) => ({
            id: loc.id,
            name: loc.name,
            latitude: loc.geo.latitude,
            longitude: loc.geo.longitude,
            radiusMeters: loc.radiusMeters ?? 100,
          })
        );

        await saveGeofenceConfig({
          userId: user.uid,
          assignedLocations: geofenceLocations,
          activeSessionId: activeSession?.id,
          activeSessionLocationId: activeSession?.locationId,
          autoGeofenceEnabled: prefEnabled,
        });
      } catch (error) {
        appLogger.warn("Failed to sync geofence config to IndexedDB", {
          error,
        });
      }
    };

    syncConfig();
  }, [user?.uid, prefEnabled, featureEnabled, assignedLocations, activeSession]);

  // ============================================
  // Register/unregister periodic background sync
  // ============================================
  useEffect(() => {
    if (!prefEnabled || !featureEnabled) {
      unregisterPeriodicGeofenceSync();
      return;
    }

    registerPeriodicGeofenceSync().then((registered) => {
      if (registered) {
        appLogger.info("Periodic background sync registered");
      }
    });

    return () => {
      unregisterPeriodicGeofenceSync();
    };
  }, [prefEnabled, featureEnabled]);

  // ============================================
  // Listen for SW geofence check requests
  // ============================================
  useEffect(() => {
    if (!prefEnabled || !featureEnabled) return;

    // Define the callback that will run a geofence poll
    const handleSWRequest = () => {
      appLogger.info("Running geofence check requested by service worker");
      // Actually run the poll function - this ensures SW periodic sync
      // triggers a real geolocation read
      runPollRef.current?.();
    };

    swListenerCleanupRef.current = setupGeofenceCheckListener(handleSWRequest);

    return () => {
      if (swListenerCleanupRef.current) {
        swListenerCleanupRef.current();
        swListenerCleanupRef.current = null;
      }
    };
  }, [prefEnabled, featureEnabled]);

  // ============================================
  // Update active session in IndexedDB when it changes
  // ============================================
  useEffect(() => {
    if (!user?.uid) return;

    updateGeofenceActiveSession(activeSession?.id, activeSession?.locationId);
  }, [user?.uid, activeSession?.id, activeSession?.locationId]);

  const clearCountdown = useCallback(
    (key: string) => {
      const cleanup = countdownCleanup.current[key];
      if (cleanup) {
        cleanup();
        delete countdownCleanup.current[key];
      }
      setActiveCountdown((curr) =>
        curr && curr.locationId === key ? null : curr
      );
    },
    []
  );

  const startCountdownToast = useCallback(
    ({
      id,
      title,
      initialDescription,
      ctaLabel,
      durationMs = COUNTDOWN_MS,
      onConfirm,
      onCancel,
    }: CountdownConfig) => {
      const startedAt = Date.now();

      // Request Wake Lock to prevent device sleep during countdown
      requestWakeLock();

      const toastInstance = toast({
        title,
        description: initialDescription,
        duration: durationMs + 1000, // keep toast visible through countdown
      });

      // Add action after toast exists (avoids self-reference in initializer)
      const actionEl = React.createElement(
        ToastAction,
        {
          altText: ctaLabel,
          onClick: () => {
            toastInstance.dismiss();
            releaseWakeLock();
            onCancel?.();
          },
        },
        ctaLabel
      ) as unknown as ToastActionElement;

      toastInstance.update({
        id: toastInstance.id,
        action: actionEl,
      });

      const interval = setInterval(() => {
        const remaining = Math.max(
          0,
          durationMs - (Date.now() - startedAt)
        );
        const secondsLeft = Math.ceil(remaining / 1000);
        toastInstance.update({
          id: toastInstance.id,
          title,
          description: `${initialDescription} • Auto in ${secondsLeft}s`,
        });

        if (remaining <= 0) {
          clearInterval(interval);
          (async () => {
            try {
              await onConfirm();
            } catch (error) {
              appLogger.error("Auto geofence countdown action failed", { error });
              toast({
                title: "Auto action failed",
                description: "Please try again manually.",
                variant: "destructive",
              });
            } finally {
              releaseWakeLock();
              toastInstance.dismiss();
              delete countdownCleanup.current[id];
            }
          })();
        }
      }, 1000);

      countdownCleanup.current[id] = () => {
        clearInterval(interval);
        releaseWakeLock();
        toastInstance.dismiss();
      };
    },
    [requestWakeLock, releaseWakeLock]
  );

  const handlePoorAccuracy = useCallback(() => {
    const count = poorAccuracyCount.current + 1;
    poorAccuracyCount.current = count;
    if (count >= POOR_ACCURACY_LIMIT) {
      setPausedReason("poor-accuracy");
      toast({
        title: "Auto check temporarily paused",
        description:
          "GPS accuracy is low. We'll resume auto check when location stabilizes.",
        duration: 6000,
      });
      appLogger.warn("Auto geofence paused due to poor accuracy", {
        consecutivePoorAccuracy: count,
      });
    }
  }, []);

  const handleGoodAccuracy = useCallback(() => {
    if (poorAccuracyCount.current > 0) {
      poorAccuracyCount.current = 0;
    }
    if (pausedReason === "poor-accuracy") {
      setPausedReason(null);
      toast({
        title: "Auto check resumed",
        description: "GPS accuracy looks good again.",
        duration: 4000,
      });
    }
  }, [pausedReason]);

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    Object.keys(countdownCleanup.current).forEach((key) =>
      clearCountdown(key)
    );
  }, [clearCountdown]);

  // Keep ref in sync with state
  useEffect(() => {
    activeCountdownRef.current = activeCountdown;
  }, [activeCountdown]);

  // Cancel any active countdowns when session state changes externally
  useEffect(() => {
    if (activeSession && activeCountdown?.type === "checkin") {
      clearCountdown(`checkin-${activeCountdown.locationId}`);
      setActiveCountdown(null);
    }

    if (!activeSession && activeCountdown?.type === "checkout") {
      clearCountdown(`checkout-${activeCountdown.locationId}`);
      setActiveCountdown(null);
    }
  }, [activeSession, activeCountdown, clearCountdown]);

  // Core polling loop
  useEffect(() => {
    if (!prefEnabled || !featureEnabled) {
      clearTimers();
      runPollRef.current = null;
      setGeofenceState("idle");
      return;
    }

    const runPoll = async () => {
      if (!featureEnabled || document.visibilityState !== "visible") {
        return;
      }

      setIsPolling(true);
      try {
        const current = await locationService.getCurrentLocation();
        
        // Mark permission as granted on successful location fetch
        setLocationPermission("granted");
        
        if (
          typeof current.accuracy === "number" &&
          current.accuracy > ACCURACY_THRESHOLD_METERS
        ) {
          handlePoorAccuracy();
          setIsPolling(false);
          return;
        }

        handleGoodAccuracy();
        setLastAccuracyMeters(current.accuracy);

        // Update user location in IndexedDB for SW access
        updateGeofenceUserLocation(current.latitude, current.longitude).catch(
          () => undefined
        );

        // If paused, only check accuracy and return early
        if (pausedReason) {
          setIsPolling(false);
          return;
        }

        // Determine geofence state
        let firstInside: Location | null = null;
        let firstInsideDistance: number | null = null;

        if (activeSession) {
          const activeLoc = assignedLocations.find(
            (loc) => loc.id === activeSession.locationId
          );
          if (activeLoc) {
            const { distance, isWithinGeofence } = validateGeofence(
              current.latitude,
              current.longitude,
              activeLoc.geo,
              activeLoc.radiusMeters ?? 100
            );

            setLastDistanceMeters(distance);

            if (isWithinGeofence) {
              outsideStreak.current = 0;
              setGeofenceState("inside");
            } else {
              outsideStreak.current += 1;
              setGeofenceState(
                outsideStreak.current >= DEBOUNCE_POLLS ? "exiting" : "inside"
              );
            }

            if (outsideStreak.current >= DEBOUNCE_POLLS && !activeCountdownRef.current) {
              const countdownKey = `checkout-${activeLoc.id}`;
              setActiveCountdown({
                type: "checkout",
                locationId: activeLoc.id,
              });

              // Calculate session duration
              const startTime =
                activeSession.startTime instanceof Date
                  ? activeSession.startTime
                  : activeSession.startTime.toDate();
              const checkInTime = activeSession.checkInTime
                ? activeSession.checkInTime instanceof Date
                  ? activeSession.checkInTime
                  : activeSession.checkInTime.toDate()
                : null;
              const sessionStart = checkInTime || startTime;
              const now = new Date();
              const durationMinutes = Math.floor(
                (now.getTime() - sessionStart.getTime()) / (1000 * 60)
              );
              const durationText = formatDuration(durationMinutes);

              appLogger.info("Auto checkout countdown started", {
                locationId: activeLoc.id,
                distance,
                durationMinutes,
              });
              startCountdownToast({
                id: countdownKey,
                title: "Auto check-out",
                initialDescription: `Leaving ${activeLoc.name} • Session: ${durationText}`,
                ctaLabel: "Stay Checked In",
                onCancel: () => {
                  outsideStreak.current = 0;
                  clearCountdown(countdownKey);
                  setActiveCountdown(null);
                  // Note: Checkout cancellations do not affect check-in cooldown
                  // Only cancelled check-ins should block future auto check-ins
                  appLogger.info("Auto checkout cancelled", {
                    locationId: activeLoc.id,
                  });
                },
                onConfirm: async () => {
                  clearCountdown(countdownKey);
                  setActiveCountdown(null);
                  await checkOut(activeSession.id, {
                    latitude: current.latitude,
                    longitude: current.longitude,
                    accuracy: current.accuracy,
                  });
                  appLogger.info("Auto checkout completed", {
                    locationId: activeLoc.id,
                  });
                },
              });
            }
          }
        } else {
          for (const loc of assignedLocations) {
            const { distance, isWithinGeofence } = validateGeofence(
              current.latitude,
              current.longitude,
              loc.geo,
              loc.radiusMeters ?? 100
            );

            if (isWithinGeofence) {
              firstInside = loc;
              firstInsideDistance = distance;
              setLastDistanceMeters(distance);
              break;
            }
          }
        }

        // Handle check-in logic only when no active session
        if (!activeSession && firstInside) {
          const withinCooldown =
            cancelledCheckIn.current[firstInside.id] &&
            Date.now() -
              cancelledCheckIn.current[firstInside.id] <
              CANCEL_COOLDOWN_MS;

          if (!withinCooldown) {
            // Stick to first location detected
            if (targetLocationId.current === firstInside.id) {
              insideStreak.current += 1;
            } else {
              targetLocationId.current = firstInside.id;
              insideStreak.current = 1;
            }

            setGeofenceState(
              insideStreak.current >= DEBOUNCE_POLLS ? "inside" : "entering"
            );

            if (
              insideStreak.current >= DEBOUNCE_POLLS &&
              !activeCountdownRef.current
            ) {
              const countdownKey = `checkin-${firstInside.id}`;
              setActiveCountdown({
                type: "checkin",
                locationId: firstInside.id,
              });
              const distanceMeters = firstInsideDistance ?? lastDistanceMeters ?? 0;
              const distanceText =
                distanceMeters < 1000
                  ? `${Math.round(distanceMeters)}m`
                  : `${(distanceMeters / 1000).toFixed(1)}km`;

              appLogger.info("Auto check-in countdown started", {
                locationId: firstInside.id,
                distance: distanceMeters,
              });

              startCountdownToast({
                id: countdownKey,
                title: "Auto check-in",
                initialDescription: `Arrived at ${firstInside.name} • ${distanceText} away`,
                ctaLabel: "Cancel",
                onCancel: () => {
                  insideStreak.current = 0;
                  targetLocationId.current = null;
                  cancelledCheckIn.current[firstInside!.id] = Date.now();
                  clearCountdown(countdownKey);
                  setActiveCountdown(null);
                  appLogger.info("Auto check-in cancelled", {
                    locationId: firstInside?.id,
                  });
                },
                onConfirm: async () => {
                  clearCountdown(countdownKey);
                  setActiveCountdown(null);
                  await checkIn(firstInside!.id, {
                    latitude: current.latitude,
                    longitude: current.longitude,
                    accuracy: current.accuracy,
                  });
                  appLogger.info("Auto check-in completed", {
                    locationId: firstInside?.id,
                  });
                },
              });
            }
          }
        }

        if (!firstInside && !activeSession) {
          insideStreak.current = 0;
          targetLocationId.current = null;
          setGeofenceState("outside");
        }
      } catch (error: any) {
        appLogger.warn("Auto geofence polling error", { error });
        
        // Track permission state based on error
        if (error?.code === 1) {
          // Permission denied
          setLocationPermission("denied");
        } else if (error?.code === 0 || error?.message?.includes("not supported")) {
          // Geolocation not available
          setLocationPermission("unavailable");
        }
      } finally {
        setIsPolling(false);
      }
    };

    // Expose runPoll via ref so SW listener can trigger it
    runPollRef.current = runPoll;

    runPoll(); // immediate
    pollTimerRef.current = setInterval(runPoll, POLL_INTERVAL_MS);

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        runPoll();
      }
    };

    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      clearTimers();
      runPollRef.current = null;
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [
    prefEnabled,
    featureEnabled,
    assignedLocations,
    activeSession,
    checkIn,
    checkOut,
    pausedReason,
    clearTimers,
    startCountdownToast,
  ]);

  return useMemo(
    () => ({
      enabled: prefEnabled,
      featureEnabled,
      geofenceState,
      isPolling,
      lastDistanceMeters,
      lastAccuracyMeters,
      pausedReason,
      activeCountdown,
      locationPermission,
    }),
    [
      prefEnabled,
      featureEnabled,
      geofenceState,
      isPolling,
      lastDistanceMeters,
      lastAccuracyMeters,
      pausedReason,
      activeCountdown,
      locationPermission,
    ]
  );
}
