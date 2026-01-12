"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COLLECTIONS,
  getCachedLocationsByProvider,
  subscribeToCachedCollection,
} from "@/lib/firebase/cachedFirestore";
import { Location } from "@/lib/firebase/types";
import { syncUserFromM365 } from "@/lib/firebase/auth";

type UseProviderLocationsOptions = {
  enabled?: boolean;
};

type ProviderLocationsState = {
  locations: Location[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refreshLocations: () => Promise<void>;
  refreshAssignments: () => Promise<void>;
};

/**
 * Cache-first + SWR hook for provider location assignments.
 *
 * - Reads cached locations immediately (memory/session/IDB via FirebaseCache)
 * - Subscribes to Firestore for live updates (keeps cache warm)
 * - Exposes manual refresh:
 *   - refreshLocations: force refresh Firestore/cache only
 *   - refreshAssignments: call M365 sync, then revalidate locations
 */
export function useProviderLocations(
  userId?: string,
  options: UseProviderLocationsOptions = {}
): ProviderLocationsState {
  const { enabled = true } = options;

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Force refresh locations (bypasses cache) and update state
  const refreshLocations = useCallback(
    async (
      options?: boolean | { skipRefreshingState?: boolean; manageLoadingState?: boolean }
    ) => {
      if (!userId || !enabled) return;

      const { skipRefreshingState, manageLoadingState } =
        typeof options === "boolean"
          ? { skipRefreshingState: options, manageLoadingState: !options }
          : {
              skipRefreshingState: options?.skipRefreshingState ?? false,
              manageLoadingState: options?.manageLoadingState ?? true,
            };

      if (!skipRefreshingState) {
        setRefreshing(true);
      }
      if (manageLoadingState) {
        setLoading(true);
      }

      setError(null);

      try {
        const fresh = await getCachedLocationsByProvider(userId, {
          forceRefresh: true,
        });
        setLocations(fresh);
      } catch (err: any) {
        setError(err?.message || "Failed to refresh locations");
        throw err;
      } finally {
        if (!skipRefreshingState) {
          setRefreshing(false);
        }
        if (manageLoadingState) {
          setLoading(false);
        }
      }
    },
    [userId, enabled]
  );

  // Refresh assignments via M365 sync, then force-refresh locations
  const refreshAssignments = useCallback(async () => {
    if (!userId || !enabled) return;
    setRefreshing(true);
    setError(null);
    try {
      await syncUserFromM365();
      // Pass true to skip refreshing state management since we're managing it here
      await refreshLocations({ skipRefreshingState: true, manageLoadingState: false });
    } catch (err: any) {
      setError(err?.message || "Failed to refresh assignments");
      throw err;
    } finally {
      setRefreshing(false);
    }
  }, [userId, enabled, refreshLocations]);

  useEffect(() => {
    if (!userId || !enabled) {
      setLocations([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const loadAndSubscribe = async () => {
      setLoading(true);
      setError(null);

      try {
        // Cache-first fetch
        const cached = await getCachedLocationsByProvider(userId);
        if (isMounted && cached) {
          setLocations(cached);
        }

        // Component may have unmounted while awaiting cache; avoid subscribing
        if (!isMounted) {
          return;
        }

        // Live subscription keeps cache warm + updates UI
        unsubscribe = subscribeToCachedCollection<Location>(
          COLLECTIONS.LOCATIONS,
          (data) => {
            if (!isMounted) return;
            setLocations(data as Location[]);
            setLoading(false);
          },
          {
            filters: [
              { field: "assignedProviders", operator: "array-contains", value: userId },
              { field: "active", operator: "==", value: true },
            ],
            orderByField: "name",
            orderDirection: "asc",
          },
          (err) => {
            if (!isMounted) return;
            setError(err.message || "Failed to subscribe to locations");
            setLoading(false);
          }
        );
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load locations");
        setLoading(false);
      }
    };

    loadAndSubscribe();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userId, enabled]);

  // Memoize return value to avoid re-renders for stable refs
  return useMemo(
    () => ({
      locations,
      loading,
      error,
      refreshing,
      refreshLocations,
      refreshAssignments,
    }),
    [locations, loading, error, refreshing, refreshLocations, refreshAssignments]
  );
}
