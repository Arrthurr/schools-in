"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Location } from "@/lib/firebase/types";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useCachedSession } from "@/lib/hooks/useCachedSession";
import { useSession } from "@/lib/hooks/useSession";
import { useAutoGeofencePreference } from "@/lib/hooks/useAutoGeofencePreference";
import { useGeofenceStrategy } from "@/lib/hooks/useGeofenceStrategy";
import { locationService } from "@/lib/utils/location";
import { validateGeofence } from "@/lib/utils/geo";
import { appLogger } from "@/lib/logging/appLogger";
import { toast } from "@/components/ui/use-toast";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { formatDuration } from "@/lib/utils/session";
import { getCachedLocationsByProvider } from "@/lib/firebase/cachedFirestore";
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
import {
  initializePushReminders,
  cleanupPushReminders,
  showCheckInReminder,
  showCheckOutReminder,
  isReminderTime,
} from "@/lib/pwa/pushReminders";
import type { GeofenceStrategy } from "@/lib/pwa/capabilities";

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
  /** Current geofence strategy being used */
  strategy: GeofenceStrategy;
  /** Limitations of the current platform */
  limitations: string[];
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

const GEOFENCE_TUNING = {
  accuracyThresholdMeters: 50,
  nearDistanceMeters: 250,
  farDistanceMeters: 500,
  countdownPollIntervalMs: 12_000,
  nearPollIntervalMs: 30_000,
  farPollIntervalMs: 90_000,
} as const;

const ACCURACY_THRESHOLD_METERS = GEOFENCE_TUNING.accuracyThresholdMeters;
const POOR_ACCURACY_LIMIT = 3;
const COUNTDOWN_MS = 15_000;
const CANCEL_COOLDOWN_MS = 5 * 60_000;
const FEATURE_FLAG =
  process.env.NEXT_PUBLIC_FEATURE_AUTO_GEOFENCE !== "false";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function useAutoGeofenceCheck(): AutoGeofenceState {
  const { user } = useCachedAuth();
  const { enabled: prefEnabled } = useAutoGeofencePreference();
  const { activeSession } = useCachedSession(user?.uid);
  const { checkIn, checkOut } = useSession();
  
  // Get strategy based on platform capabilities
  const {
    strategy,
    config: strategyConfig,
    limitations,
    switchToFallback,
  } = useGeofenceStrategy();

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
  const [pushRemindersInitialized, setPushRemindersInitialized] = useState(false);
  const [adaptivePollIntervalMs, setAdaptivePollIntervalMs] = useState(
    strategyConfig.pollIntervalMs
  );
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);

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
  const lastInsideUpdateRef = useRef(0);
  const lastGeofenceConfigRef = useRef<string | null>(null);
  const pendingGeofenceSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActiveSessionPersistedRef = useRef<{
    sessionId?: string;
    locationId?: string;
  }>({});

  const setLocationsIfChanged = useCallback(
    (next: Location[]) =>
      setAssignedLocations((prev) => {
        if (
          prev.length === next.length &&
          prev.every(
            (loc, idx) =>
              loc.id === next[idx]?.id &&
              loc.radiusMeters === next[idx]?.radiusMeters &&
              loc.name === next[idx]?.name
          )
        ) {
          return prev;
        }
        return next;
      }),
    []
  );

  const getActiveRadius = useCallback(() => {
    if (activeSession) {
      const activeLoc = assignedLocations.find(
        (loc) => loc.id === activeSession.locationId
      );
      if (activeLoc?.radiusMeters) {
        return activeLoc.radiusMeters;
      }
    }
    return 100;
  }, [activeSession, assignedLocations]);

  const computeAdaptivePollInterval = useCallback(() => {
    const baseInterval = strategyConfig.pollIntervalMs;

    if (activeCountdown) {
      // Countdown should remain responsive; do not exceed base interval
      return Math.min(baseInterval, GEOFENCE_TUNING.countdownPollIntervalMs);
    }

    if (!isDocumentVisible && strategy !== "periodic-sync") {
      // When hidden and not using background periodic sync, relax polling to save battery
      return Math.max(
        baseInterval,
        GEOFENCE_TUNING.farPollIntervalMs * 2
      );
    }

    const distance =
      typeof lastDistanceMeters === "number" ? lastDistanceMeters : null;
    const activeRadius = getActiveRadius();
    const nearBoundary = Math.max(GEOFENCE_TUNING.nearDistanceMeters, activeRadius * 2);

    if (
      geofenceState === "entering" ||
      geofenceState === "exiting" ||
      (distance !== null && distance <= nearBoundary)
    ) {
      // Allow faster polling near boundaries/active transitions (cap by strategy baseline)
      return Math.min(baseInterval, GEOFENCE_TUNING.nearPollIntervalMs);
    }

    if (
      distance !== null &&
      distance >= Math.max(GEOFENCE_TUNING.farDistanceMeters, activeRadius * 4)
    ) {
      // Extend interval when far away to save battery; keep baseline if already slower
      return Math.max(baseInterval, GEOFENCE_TUNING.farPollIntervalMs);
    }

    return baseInterval;
  }, [
    activeCountdown,
    geofenceState,
    getActiveRadius,
    lastDistanceMeters,
    isDocumentVisible,
    strategy,
    strategyConfig.pollIntervalMs,
  ]);

  const getLocationOptions = useCallback((): PositionOptions => {
    const distance = typeof lastDistanceMeters === "number" ? lastDistanceMeters : Infinity;
    const activeRadius = getActiveRadius();
    const nearBoundary = Math.max(GEOFENCE_TUNING.nearDistanceMeters, activeRadius * 2);
    const hasDistance = Number.isFinite(distance);
    const isNearBoundary =
      geofenceState === "entering" ||
      geofenceState === "exiting" ||
      !hasDistance ||
      distance <= nearBoundary ||
      !!activeCountdown;
    const isFar =
      hasDistance &&
      distance >= Math.max(GEOFENCE_TUNING.farDistanceMeters, activeRadius * 4);

    const hiddenRelaxed =
      !isDocumentVisible && strategy !== "periodic-sync" && !activeCountdown;

    return {
      enableHighAccuracy: hiddenRelaxed ? false : isNearBoundary,
      maximumAge: hiddenRelaxed
        ? 180_000
        : isNearBoundary
          ? 15_000
          : isFar
            ? 120_000
            : 60_000,
      timeout: hiddenRelaxed ? 5_000 : isNearBoundary ? 10_000 : 5_000,
    };
  }, [
    activeCountdown,
    geofenceState,
    getActiveRadius,
    isDocumentVisible,
    lastDistanceMeters,
    strategy,
  ]);

  const featureEnabled = FEATURE_FLAG && !!user?.uid;
  
  // Derive debounce from strategy config
  const DEBOUNCE_POLLS = strategyConfig.debouncePolls;

  // Update adaptive poll interval when key signals change
  useEffect(() => {
    const nextInterval = computeAdaptivePollInterval();
    setAdaptivePollIntervalMs((prev) => {
      if (prev !== nextInterval) {
        appLogger.info("Adaptive geofence poll interval updated", {
          from: prev,
          to: nextInterval,
        });
      }
      return nextInterval;
    });
  }, [computeAdaptivePollInterval]);

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
      const cached = await getCachedLocationsByProvider(user.uid);
      if (cached) {
        setLocationsIfChanged(cached);
      }

      // Background revalidate
      getCachedLocationsByProvider(user.uid, { forceRefresh: true })
        .then((fresh) => {
          if (fresh) {
            setLocationsIfChanged(fresh);
          }
        })
        .catch((error) => {
          appLogger.warn("Failed to refresh provider locations from network", {
            error,
          });
        });
    } catch (error) {
      appLogger.warn("Failed to load assigned locations for geofence", {
        error,
      });
    }
  }, [setLocationsIfChanged, user?.uid]);

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

    const geofenceLocations: GeofenceLocation[] = assignedLocations.map(
      (loc) => ({
        id: loc.id,
        name: loc.name,
        latitude: loc.geo.latitude,
        longitude: loc.geo.longitude,
        radiusMeters: loc.radiusMeters ?? 100,
      })
    );

    const payload = {
      userId: user.uid,
      assignedLocations: geofenceLocations,
      activeSessionId: activeSession?.id,
      activeSessionLocationId: activeSession?.locationId,
      autoGeofenceEnabled: prefEnabled,
    };

    const serialized = JSON.stringify(payload);
    if (lastGeofenceConfigRef.current === serialized) {
      return;
    }

    if (pendingGeofenceSaveRef.current) {
      clearTimeout(pendingGeofenceSaveRef.current);
    }

    pendingGeofenceSaveRef.current = setTimeout(() => {
      saveGeofenceConfig(payload)
        .then(() => {
          lastGeofenceConfigRef.current = serialized;
        })
        .catch((error) => {
          appLogger.warn("Failed to sync geofence config to IndexedDB", {
            error,
          });
        })
        .finally(() => {
          pendingGeofenceSaveRef.current = null;
        });
    }, 1000);

    return () => {
      if (pendingGeofenceSaveRef.current) {
        clearTimeout(pendingGeofenceSaveRef.current);
        pendingGeofenceSaveRef.current = null;
      }
    };
  }, [
    activeSession?.id,
    activeSession?.locationId,
    assignedLocations,
    featureEnabled,
    prefEnabled,
    user?.uid,
  ]);

  // ============================================
  // Register/unregister periodic background sync (strategy-aware)
  // ============================================
  useEffect(() => {
    if (!prefEnabled || !featureEnabled) {
      unregisterPeriodicGeofenceSync();
      return;
    }

    // Only register periodic sync for the periodic-sync strategy
    if (strategy === "periodic-sync") {
      registerPeriodicGeofenceSync().then((registered) => {
        if (registered) {
          appLogger.info("Periodic background sync registered", { strategy });
        } else {
          // Registration failed, switch to fallback strategy
          appLogger.warn("Periodic sync registration failed, switching to fallback");
          switchToFallback();
        }
      });
    } else {
      // Unregister if we're using a different strategy
      unregisterPeriodicGeofenceSync();
    }

    return () => {
      unregisterPeriodicGeofenceSync();
    };
  }, [prefEnabled, featureEnabled, strategy, switchToFallback]);

  // ============================================
  // Initialize push reminders for fallback strategies
  // ============================================
  useEffect(() => {
    if (!prefEnabled || !featureEnabled || !user?.uid) {
      return;
    }

    // Only initialize push reminders for strategies that need them
    if (!strategyConfig.usePushReminders || !VAPID_PUBLIC_KEY) {
      return;
    }

    if (pushRemindersInitialized) {
      return;
    }

    initializePushReminders({
      userId: user.uid,
      vapidPublicKey: VAPID_PUBLIC_KEY,
      onPermissionDenied: () => {
        appLogger.warn("Push permission denied for geofence reminders");
      },
      onSubscriptionFailed: (error) => {
        appLogger.error("Push subscription failed", { error });
      },
    }).then((success) => {
      if (success) {
        setPushRemindersInitialized(true);
        appLogger.info("Push reminders initialized for geofence", { strategy });
      }
    });

    return () => {
      // Only cleanup if we're disabling the feature
      if (!prefEnabled && user?.uid) {
        cleanupPushReminders(user.uid);
        setPushRemindersInitialized(false);
      }
    };
  }, [prefEnabled, featureEnabled, user?.uid, strategy, strategyConfig.usePushReminders, pushRemindersInitialized]);

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

    const last = lastActiveSessionPersistedRef.current;
    const nextSessionId = activeSession?.id;
    const nextLocationId = activeSession?.locationId;

    if (
      last.sessionId === nextSessionId &&
      last.locationId === nextLocationId
    ) {
      return;
    }

    lastActiveSessionPersistedRef.current = {
      sessionId: nextSessionId,
      locationId: nextLocationId,
    };

    updateGeofenceActiveSession(nextSessionId, nextLocationId).catch((error) =>
      appLogger.warn("Failed to sync active session to IndexedDB", { error })
    );
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

      let finished = false;
      let interval: ReturnType<typeof setInterval> | undefined;

      const finishCountdown = async () => {
        if (finished) return;
        finished = true;
        if (interval) {
          clearInterval(interval);
        }
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
      };

      const timeout = setTimeout(() => {
        if (interval) {
          clearInterval(interval);
          interval = undefined;
        }
        finishCountdown();
      }, durationMs);

      interval = setInterval(() => {
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
          clearTimeout(timeout);
          finishCountdown();
        }
      }, 1000);

      countdownCleanup.current[id] = () => {
        if (interval) {
          clearInterval(interval);
        }
        clearTimeout(timeout);
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

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const clearCountdowns = useCallback(() => {
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
      clearPollTimer();
      clearCountdowns();
      runPollRef.current = null;
      setGeofenceState("idle");
      return;
    }

    const runPoll = async () => {
      if (!featureEnabled || document.visibilityState !== "visible") {
        return;
      }

      const now = Date.now();
      setIsPolling(true);
      try {
        const current = await locationService.getCurrentLocation(
          getLocationOptions()
        );
        
        // Mark permission as granted on successful location fetch
        setLocationPermission("granted");
        
        const accuracyMeters =
          typeof current.accuracy === "number" ? current.accuracy : undefined;
        const actionableAccuracy =
          accuracyMeters === undefined ||
          accuracyMeters <= ACCURACY_THRESHOLD_METERS;

        if (!actionableAccuracy) {
          handlePoorAccuracy();
          setLastAccuracyMeters(accuracyMeters);
          // Still update last known location for visibility but skip decisions
          updateGeofenceUserLocation(current.latitude, current.longitude).catch(
            () => undefined
          );
          setIsPolling(false);
          return;
        } else {
          handleGoodAccuracy();
          setLastAccuracyMeters(accuracyMeters);
        }

        // Update user location in IndexedDB for SW access
        updateGeofenceUserLocation(current.latitude, current.longitude).catch(
          () => undefined
        );

        // If previously paused but accuracy is now good, clear the pause.
        // Only bail out when still poor accuracy.
        if (pausedReason) {
          if (actionableAccuracy) {
            setPausedReason(null);
          } else {
            setIsPolling(false);
            return;
          }
        }

        // Determine geofence state
        let firstInside: Location | null = null;
        let firstInsideDistance: number | null = null;

        let closestDistance: number | null = null;

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

            closestDistance = distance;

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

            if (closestDistance === null || distance < closestDistance) {
              closestDistance = distance;
            }

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
              const justEnteredRecently =
                geofenceState === "entering" &&
                insideStreak.current === 1 &&
                now - lastInsideUpdateRef.current < 1000;

              if (justEnteredRecently) {
                setIsPolling(false);
                return;
              }

              insideStreak.current += 1;
            } else {
              targetLocationId.current = firstInside.id;
              insideStreak.current = 1;
            }

            lastInsideUpdateRef.current = now;

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
          if (closestDistance !== null) {
            setLastDistanceMeters(closestDistance);
          }
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
    runPoll();

    // Set up interval polling using adaptive interval
    const pollInterval = adaptivePollIntervalMs;
    if (pollInterval > 0) {
      pollTimerRef.current = setInterval(runPoll, pollInterval);
    }

    if (typeof document !== "undefined") {
      setIsDocumentVisible(document.visibilityState === "visible");
    }

    const visibilityHandler = () => {
      const nowVisible = document.visibilityState === "visible";
      setIsDocumentVisible(nowVisible);

      if (nowVisible) {
        runPoll();
        
        // For strategies with push reminders, show reminder on return if appropriate
        if (strategyConfig.usePushReminders && isReminderTime()) {
          if (activeSession) {
            const activeLoc = assignedLocations.find(
              (loc) => loc.id === activeSession.locationId
            );

            const startTime =
              activeSession.startTime?.toDate?.() ??
              activeSession.checkInTime?.toDate?.();

            const durationMinutes =
              startTime instanceof Date
                ? Math.max(
                    1,
                    Math.round((Date.now() - startTime.getTime()) / 60_000)
                  )
                : undefined;

            void showCheckOutReminder(
              activeLoc?.name,
              durationMinutes ? formatDuration(durationMinutes) : undefined
            );
          } else if (assignedLocations.length > 0) {
            const nextLocation = assignedLocations[0];
            void showCheckInReminder(nextLocation.name);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      clearPollTimer();
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
    startCountdownToast,
    handleGoodAccuracy,
    handlePoorAccuracy,
    getLocationOptions,
    clearPollTimer,
    clearCountdowns,
    adaptivePollIntervalMs,
    strategyConfig.usePushReminders,
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
      strategy,
      limitations,
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
      strategy,
      limitations,
    ]
  );
}
