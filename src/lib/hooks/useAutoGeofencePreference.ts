"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../firebase.config";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";

interface AutoGeofencePreferenceState {
  /** Whether auto geofence check-in/out is enabled. Providers default to false (manual). */
  enabled: boolean;
  /** Loading state while reading preference from Firestore */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Toggle the preference and persist to Firestore */
  setEnabled: (value: boolean) => Promise<void>;
}

/**
 * Hook to manage the auto geofence check-in/out preference.
 *
 * - Providers: defaults to false (manual check-in). Can be toggled on for auto.
 * - Admins: always false (admins use manual check-in only, no toggle exposed).
 *
 * Preference is persisted to `users/{uid}.autoGeofenceCheckEnabled` in Firestore.
 */
export function useAutoGeofencePreference(): AutoGeofencePreferenceState {
  const { user, loading: authLoading } = useCachedAuth();
  const [enabled, setEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive the enabled state from the user document once auth is loaded
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setEnabledState(false);
      setLoading(false);
      return;
    }

    // Admins never use auto check-in
    if (user.role === "admin") {
      setEnabledState(false);
      setLoading(false);
      return;
    }

    // Providers: read persisted preference, defaulting to false (manual mode)
    const persisted = user.autoGeofenceCheckEnabled;
    setEnabledState(persisted === true);
    setLoading(false);
  }, [user, authLoading]);

  const setEnabled = useCallback(
    async (value: boolean) => {
      if (!user || user.role === "admin") return;

      setEnabledState(value);
      setError(null);

      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { autoGeofenceCheckEnabled: value });
      } catch (err) {
        // Revert optimistic update on failure
        setEnabledState(!value);
        const message =
          err instanceof Error ? err.message : "Failed to save preference";
        setError(message);
      }
    },
    [user]
  );

  return { enabled, loading, error, setEnabled };
}
