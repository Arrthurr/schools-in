"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import {
  getAutoGeofencePreference,
  getAutoGeofencePreferenceFromStorage,
  setAutoGeofencePreference,
} from "@/lib/services/userPreferences";
import { appLogger } from "@/lib/logging/appLogger";

interface AutoGeofencePreferenceState {
  enabled: boolean;
  loading: boolean;
  error: string | null;
  setEnabled: (enabled: boolean) => Promise<void>;
}

export function useAutoGeofencePreference(): AutoGeofencePreferenceState {
  const { user } = useCachedAuth();
  const userId = user?.uid;
  const [enabled, setEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preference on mount / user change
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!userId) {
        setEnabledState(false);
        setLoading(false);
        return;
      }

      // Use localStorage mirror immediately for snappier UX
      const localPref = getAutoGeofencePreferenceFromStorage();
      if (localPref !== null) {
        setEnabledState(localPref);
      }

      try {
        const remotePref = await getAutoGeofencePreference(userId);
        if (!cancelled) {
          setEnabledState(remotePref);
        }
      } catch (err) {
        if (!cancelled) {
          appLogger.warn("Failed to load auto geofence preference", {
            error: err,
          });
          setError(
            err instanceof Error ? err.message : "Failed to load preference"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    setError(null);
    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (!userId) {
        setError("User not authenticated");
        return;
      }

      const previous = enabled;
      setEnabledState(next);
      setError(null);
      try {
        await setAutoGeofencePreference(userId, next);
        appLogger.info("Auto geofence preference updated", {
          enabled: next,
          userId,
        });
      } catch (err) {
        appLogger.warn("Failed to update auto geofence preference", {
          error: err,
        });
        setError(
          err instanceof Error ? err.message : "Failed to update preference"
        );
        // revert optimistic update
        setEnabledState(previous);
      }
    },
    [userId, enabled]
  );

  return useMemo(
    () => ({
      enabled,
      loading,
      error,
      setEnabled,
    }),
    [enabled, loading, error, setEnabled]
  );
}
