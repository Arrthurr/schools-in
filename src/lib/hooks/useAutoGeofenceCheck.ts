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
const CHECK_IN_GRACE_PERIOD_MS = 60_000; // 60 seconds grace period after check-in
const SESSION_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 hours — matches cleanupStaleSessions timeout
const FEATURE_FLAG = process.env.NEXT_PUBLIC_FEATURE_AUTO_GEOFENCE !== "false";
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
    platform,
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
  const [activeCountdown, setActiveCountdown] =
    useState<AutoGeofenceState["activeCountdown"]>(null);
  const [locationPermission, setLocationPermission] =
    useState<LocationPermission>("unknown");
  const [adaptivePollIntervalMs, setAdaptivePollIntervalMs] = useState(
    strategyConfig.pollIntervalMs
  );
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const poorAccuracyCount = useRef(0);
  const insideStreak = useRef(0);
  const outsideStreak = useRef(0);
  const targetLocationId = useRef<string | null>(null);
  const lastCheckInTimeRef = useRef<number>(0);
  const cancelledCheckIn = useRef<Record<string, number>>({});
  const countdownCleanup = useRef<Record<string, () => void>>({});
  const activeCountdownRef = useRef<AutoGeofenceState["activeCountdown"]>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const swListenerCleanupRef = useRef<(() => void) | null>(null);
  const runPollRef = useRef<(() => void) | null>(null);
  const pollInFlightRef = useRef(false);
  const lastInsideUpdateRef = useRef(0);
  const lastGeofenceConfigRef = useRef<string | null>(null);
  const pendingGeofenceSaveRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastActiveSessionPersistedRef = useRef<{
    sessionId?: string;
    locationId?: string;
  }>({});

  // Ref that always holds the latest activeSession so long-lived closures
  // (e.g. toast onClick handlers) can read the current value without stale capture.
  const activeSessionRef = useRef(activeSession);
  activeSessionRef.current = activeSession;

  // Ref to the "still here?" / "Auto Check-out Alert" toast so it can be
  // reactively dismissed when the Firestore listener reports the session ended.
  const stillHereToastRef = useRef<ReturnType<typeof toast> | null>(null);

  // Dismiss the "Auto Check-out Alert" toast when the Firestore real-time
  // listener delivers an update showing the session is no longer active
  // (e.g. closed by cleanupStaleSessions while the app was backgrounded).
  useEffect(() => {
    if (!activeSession && stillHereToastRef.current) {
      stillHereToastRef.current.dismiss();
      stillHereToastRef.current = null;
    }
  }, [activeSession]);

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
    return 300;
  }, [activeSession, assignedLocations]);

  const computeAdaptivePollInterval = useCallback(() => {
    const baseInterval = strategyConfig.pollIntervalMs;

    if (activeCountdown) {
      // Countdown should remain responsive; do not exceed base interval
      return Math.min(baseInterval, GEOFENCE_TUNING.countdownPollIntervalMs);
    }

    if (!isDocumentVisible && strategy !== "periodic-sync") {
      // When hidden and not using background periodic sync, relax polling to save battery
      return Math.max(baseInterval, GEOFENCE_TUNING.farPollIntervalMs * 2);
    }

    const distance =
      typeof lastDistanceMeters === "number" ? lastDistanceMeters : null;
    const activeRadius = getActiveRadius();
    const nearBoundary = Math.max(
      GEOFENCE_TUNING.nearDistanceMeters,
      activeRadius * 2
    );

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
    const distance =
      typeof lastDistanceMeters === "number" ? lastDistanceMeters : Infinity;
    const activeRadius = getActiveRadius();
    const nearBoundary = Math.max(
      GEOFENCE_TUNING.nearDistanceMeters,
      activeRadius * 2
    );
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
        radiusMeters: loc.radiusMeters ?? 500,
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
          appLogger.warn(
            "Periodic sync registration failed, switching to fallback"
          );
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

  const clearCountdown = useCallback((key: string) => {
    const cleanup = countdownCleanup.current[key];
    if (cleanup) {
      cleanup();
      delete countdownCleanup.current[key];
    }
    setActiveCountdown((curr) =>
      curr && curr.locationId === key ? null : curr
    );
  }, []);

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
      if (countdownCleanup.current[id]) {
        // Already running this countdown; avoid duplicate toasts
        return;
      }

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
        const remaining = Math.max(0, durationMs - (Date.now() - startedAt));
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
        description: platform?.isIOS
          ? "GPS accuracy is low. Enable Precise Location for Safari/this app in Settings > Privacy & Security > Location Services, then retry."
          : "GPS accuracy is low. Try moving outside, enable Wi‑Fi, and wait a moment for location to stabilize.",
        duration: 6000,
      });
      appLogger.warn("Auto geofence paused due to poor accuracy", {
        consecutivePoorAccuracy: count,
      });
    }
  }, [platform?.isIOS]);

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
    Object.keys(countdownCleanup.current).forEach((key) => clearCountdown(key));
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

  // Track previous session ID to detect new check-ins
  // Initialize as null to distinguish "not yet initialized" from "no session"
  const prevSessionIdRef = useRef<string | null | undefined>(null);

  // Update grace period timer when ANY check-in occurs (auto or manual)
  // This ensures the grace period is reset for each new session
  useEffect(() => {
    const currentSessionId = activeSession?.id;
    const prevSessionId = prevSessionIdRef.current;

    // On first run (prevSessionId === null), just record the current state
    // without triggering grace period - we don't want to treat an existing
    // session on page load as a "new check-in"
    if (prevSessionId === null) {
      prevSessionIdRef.current = currentSessionId;
      return;
    }

    // Detect transition to a new session (actual check-in occurred)
    if (currentSessionId && currentSessionId !== prevSessionId) {
      lastCheckInTimeRef.current = Date.now();
      outsideStreak.current = 0;
      appLogger.debug("Grace period reset for new session", {
        sessionId: currentSessionId,
        wasManualCheckIn: prevSessionId !== undefined || !activeCountdownRef.current,
      });
    }

    prevSessionIdRef.current = currentSessionId;
  }, [activeSession?.id]);

  // ---------------------------------------------------------------------------
  // Bundle frequently-changing values into a single ref so the polling effect
  // can read the latest without listing them as dependencies (which would cause
  // the effect to tear-down / re-create on every reference change, firing
  // runPoll() each time and pumping outsideStreak during the grace period).
  // ---------------------------------------------------------------------------
  const pollContextRef = useRef({
    activeSession,
    assignedLocations,
    checkIn,
    checkOut,
    pausedReason,
    startCountdownToast,
    handleGoodAccuracy,
    handlePoorAccuracy,
    getLocationOptions,
    featureEnabled,
    debouncePolls: DEBOUNCE_POLLS,
  });
  pollContextRef.current = {
    activeSession,
    assignedLocations,
    checkIn,
    checkOut,
    pausedReason,
    startCountdownToast,
    handleGoodAccuracy,
    handlePoorAccuracy,
    getLocationOptions,
    featureEnabled,
    debouncePolls: DEBOUNCE_POLLS,
  };

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
      if (pollInFlightRef.current) {
        appLogger.debug("Skipping geofence poll because one is already running");
        return;
      }

      // Read latest values from ref — avoids stale closures and keeps the
      // dependency array of the enclosing effect small & stable.
      const ctx = pollContextRef.current;

      pollInFlightRef.current = true;
      if (!ctx.featureEnabled || document.visibilityState !== "visible") {
        pollInFlightRef.current = false;
        return;
      }

      const now = Date.now();
      setIsPolling(true);
      try {
        const baseOptions = ctx.getLocationOptions();
        const current = await locationService.getBestEffortLocation({
          mode: "decision",
          initialOptions: baseOptions,
          highAccuracyOptions: {
            ...baseOptions,
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: Math.max(baseOptions.timeout ?? 5_000, 15_000),
          },
          accuracyThresholdMeters: ACCURACY_THRESHOLD_METERS,
        });

        // Mark permission as granted on successful location fetch
        setLocationPermission("granted");

        const accuracyMeters =
          typeof current.accuracy === "number" ? current.accuracy : undefined;
        const actionableAccuracy =
          accuracyMeters === undefined ||
          accuracyMeters <= ACCURACY_THRESHOLD_METERS;

        if (!actionableAccuracy) {
          ctx.handlePoorAccuracy();
          setLastAccuracyMeters(accuracyMeters);
          // Still update last known location for visibility but skip decisions
          updateGeofenceUserLocation(current.latitude, current.longitude).catch(
            () => undefined
          );
          setIsPolling(false);
          return;
        } else {
          ctx.handleGoodAccuracy();
          setLastAccuracyMeters(accuracyMeters);
        }

        // Update user location in IndexedDB for SW access
        updateGeofenceUserLocation(current.latitude, current.longitude).catch(
          () => undefined
        );

        // If previously paused but accuracy is now good, clear the pause.
        // Only bail out when still poor accuracy.
        if (ctx.pausedReason) {
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

        // Read session & locations from context ref (latest values)
        const session = ctx.activeSession;
        const locations = ctx.assignedLocations;

        if (session) {
          const activeLoc = locations.find(
            (loc) => loc.id === session.locationId
          );
          if (activeLoc) {
            const { distance, isWithinGeofence } = validateGeofence(
              current.latitude,
              current.longitude,
              activeLoc.geo,
              activeLoc.radiusMeters ?? 500
            );

            setLastDistanceMeters(distance);

            closestDistance = distance;

            if (isWithinGeofence) {
              outsideStreak.current = 0;
              setGeofenceState("inside");
            } else {
              outsideStreak.current += 1;
              setGeofenceState(
                outsideStreak.current >= ctx.debouncePolls ? "exiting" : "inside"
              );
            }

            if (outsideStreak.current >= ctx.debouncePolls) {
              // Skip checkout if within grace period after check-in
              // This prevents immediate auto-checkout due to GPS fluctuations
              const withinGracePeriod =
                Date.now() - lastCheckInTimeRef.current < CHECK_IN_GRACE_PERIOD_MS;

              if (withinGracePeriod) {
                appLogger.debug(
                  "Skipping auto checkout - within grace period after check-in",
                  { gracePeriodMs: CHECK_IN_GRACE_PERIOD_MS }
                );
                // Reset streak so it doesn't survive the grace period.
                // Without this, the streak accumulated during the grace window
                // would immediately trigger checkout once the window expires.
                outsideStreak.current = 0;
                setIsPolling(false);
                pollInFlightRef.current = false;
                return;
              }

              const countdownKey = `checkout-${activeLoc.id}`;

              // Atomic check-and-set to prevent race condition with overlapping polls
              if (activeCountdownRef.current) {
                appLogger.debug("Check-out countdown already active, skipping", {
                  countdownKey,
                });
                setIsPolling(false);
                pollInFlightRef.current = false;
                return;
              }
              activeCountdownRef.current = {
                type: "checkout",
                locationId: activeLoc.id,
              };

              setActiveCountdown({
                type: "checkout",
                locationId: activeLoc.id,
              });

              // Calculate session duration
              const startTime =
                session.startTime instanceof Date
                  ? session.startTime
                  : session.startTime.toDate();
              const checkInTime = session.checkInTime
                ? session.checkInTime instanceof Date
                  ? session.checkInTime
                  : session.checkInTime.toDate()
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
              ctx.startCountdownToast({
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
                  try {
                    // Read checkOut from ref so this closure is never stale
                    await pollContextRef.current.checkOut(session.id, {
                      latitude: current.latitude,
                      longitude: current.longitude,
                      accuracy: current.accuracy,
                    });
                    appLogger.info("Auto checkout completed", {
                      locationId: activeLoc.id,
                    });
                  } finally {
                    // Clear countdown AFTER check-out completes (success or failure)
                    // to prevent duplicate countdowns during the async operation
                    clearCountdown(countdownKey);
                    setActiveCountdown(null);
                    activeCountdownRef.current = null;
                  }
                },
              });
            }
          }
        } else {
          for (const loc of locations) {
            const { distance, isWithinGeofence } = validateGeofence(
              current.latitude,
              current.longitude,
              loc.geo,
              loc.radiusMeters ?? 500
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
        if (!session && firstInside) {
          const withinCooldown =
            cancelledCheckIn.current[firstInside.id] &&
            Date.now() - cancelledCheckIn.current[firstInside.id] <
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
              insideStreak.current >= ctx.debouncePolls ? "inside" : "entering"
            );

            if (insideStreak.current >= ctx.debouncePolls) {
              const countdownKey = `checkin-${firstInside.id}`;

              // Atomic check-and-set to prevent race condition with overlapping polls
              if (activeCountdownRef.current) {
                appLogger.debug("Check-in countdown already active, skipping", {
                  countdownKey,
                });
                setIsPolling(false);
                pollInFlightRef.current = false;
                return;
              }
              activeCountdownRef.current = {
                type: "checkin",
                locationId: firstInside.id,
              };

              setActiveCountdown({
                type: "checkin",
                locationId: firstInside.id,
              });
              const distanceMeters =
                firstInsideDistance ?? lastDistanceMeters ?? 0;
              const distanceText =
                distanceMeters < 1000
                  ? `${Math.round(distanceMeters)}m`
                  : `${(distanceMeters / 1000).toFixed(1)}km`;

              appLogger.info("Auto check-in countdown started", {
                locationId: firstInside.id,
                distance: distanceMeters,
              });

              ctx.startCountdownToast({
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
                  try {
                    // Read checkIn from ref so this closure is never stale
                    await pollContextRef.current.checkIn(firstInside!.id, {
                      latitude: current.latitude,
                      longitude: current.longitude,
                      accuracy: current.accuracy,
                    }, firstInsideDistance ?? undefined);
                    // Record check-in time for grace period and reset outsideStreak
                    // to prevent immediate auto-checkout due to GPS fluctuations
                    lastCheckInTimeRef.current = Date.now();
                    outsideStreak.current = 0;
                    appLogger.info("Auto check-in completed", {
                      locationId: firstInside?.id,
                    });
                  } finally {
                    // Clear countdown AFTER check-in completes (success or failure)
                    // to prevent duplicate countdowns during the async operation
                    clearCountdown(countdownKey);
                    setActiveCountdown(null);
                    activeCountdownRef.current = null;
                  }
                },
              });
            }
          }
        }

        if (!firstInside && !session) {
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
        } else if (
          error?.code === 0 ||
          error?.message?.includes("not supported")
        ) {
          // Geolocation not available
          setLocationPermission("unavailable");
        }
      } finally {
        setIsPolling(false);
        pollInFlightRef.current = false;
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

    let visibilityHandler: (() => void) | null = null;

    if (typeof document !== "undefined") {
      setIsDocumentVisible(document.visibilityState === "visible");

      visibilityHandler = () => {
        const nowVisible = document.visibilityState === "visible";
        setIsDocumentVisible(nowVisible);

        if (nowVisible) {
          // "Still here?" prompt for long-running sessions when app regains visibility
          // Always read from ref — the visibility handler outlives the effect
          // closure when only the interval changes.
          const visSession = activeSessionRef.current;
          if (visSession && !activeCountdownRef.current) {
            const startTime =
              visSession.startTime instanceof Date
                ? visSession.startTime
                : visSession.startTime?.toDate?.();
            const checkInTime = visSession.checkInTime
              ? visSession.checkInTime instanceof Date
                ? visSession.checkInTime
                : visSession.checkInTime?.toDate?.()
              : null;
            const sessionStart = checkInTime || startTime;
            const STILL_HERE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

            const elapsedMs = sessionStart
              ? Date.now() - sessionStart.getTime()
              : 0;

            // Skip the toast entirely if the session is past the cleanup
            // threshold — it has either already been auto-closed or will be
            // imminently.  Showing a stale duration would be misleading.
            if (
              sessionStart &&
              elapsedMs >= STILL_HERE_THRESHOLD_MS &&
              elapsedMs < SESSION_LIMIT_MS
            ) {
              const elapsedMin = Math.floor(elapsedMs / 60000);
              const durationText = formatDuration(elapsedMin);
              const visLocations = pollContextRef.current.assignedLocations;
              const activeLoc = visLocations.find(
                (loc) => loc.id === visSession.locationId
              );
              const locationName = activeLoc?.name || "your school";

              // Capture session ID at toast creation time for the onClick handler
              const capturedSessionId = visSession.id;

              const stillHereToast = toast({
                title: "Auto Check-out Alert",
                description: `You've been checked in at ${locationName} for ${durationText}. If you've left, the app will check you out automatically.`,
                duration: 30000,
              });

              // Store ref so the reactive effect can dismiss it if the
              // Firestore listener reports the session ended while the
              // toast is still visible.
              stillHereToastRef.current = stillHereToast;

              // Attach action after creation so the onClick can reference
              // the toast instance for dismissal (same pattern as countdown toast).
              stillHereToast.update({
                id: stillHereToast.id,
                action: React.createElement(
                  ToastAction,
                  {
                    altText: "Dismiss",
                    onClick: () => {
                      stillHereToast.dismiss();
                      stillHereToastRef.current = null;
                      appLogger.info(
                        "Provider confirmed still here via still-here prompt",
                        { sessionId: capturedSessionId }
                      );
                    },
                  },
                  "Dismiss"
                ) as unknown as ToastActionElement,
              });
            }
          }

          runPoll();
        }
      };

      document.addEventListener("visibilitychange", visibilityHandler);
    }

    return () => {
      clearPollTimer();
      runPollRef.current = null;
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
    };
    // IMPORTANT: activeSession, checkIn, checkOut, and callback deps are
    // intentionally read from pollContextRef inside runPoll so they do NOT
    // appear here.  This prevents the effect from tearing-down / re-creating
    // (and firing an immediate runPoll) every time a Firestore snapshot
    // delivers a new activeSession object reference.
    //
    // assignedLocations is kept here because it only changes when locations
    // are first loaded or actually change (guarded by setLocationsIfChanged).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    prefEnabled,
    featureEnabled,
    assignedLocations,
    clearPollTimer,
    clearCountdowns,
    adaptivePollIntervalMs,
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
