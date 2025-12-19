"use client";

import { useMemo } from "react";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";

interface AutoGeofencePreferenceState {
  /** Whether auto geofence check-in/out is enabled (role-derived: providers always on, admins off) */
  enabled: boolean;
  /** Loading state (always false since role is available immediately from auth) */
  loading: boolean;
  /** Error state (always null since this is now role-derived) */
  error: string | null;
}

/**
 * Hook to determine if auto geofence check-in/out is enabled.
 *
 * As of the role-based check-in/out update:
 * - Providers: auto check-in/out is ALWAYS enabled (no opt-out)
 * - Admins: auto check-in/out is ALWAYS disabled (admins use manual check-in/out)
 *
 * This is now derived purely from the user's role rather than a stored preference.
 */
export function useAutoGeofencePreference(): AutoGeofencePreferenceState {
  const { user, loading: authLoading } = useCachedAuth();

  // Role-based: providers always on, admins always off
  const enabled = user?.role === "provider";

  return useMemo(
    () => ({
      enabled,
      loading: authLoading,
      error: null,
    }),
    [enabled, authLoading]
  );
}
