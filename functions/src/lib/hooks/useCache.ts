"use client";

import { useState, useEffect, useCallback } from "react";
import { cacheManager } from "../offline/cacheManager";
import { useOffline } from "./useOffline";

interface CacheState {
  isLoading: boolean;
  lastUpdate: Date | null;
  cacheSize: number;
  needsRefresh: boolean;
  error: string | null;
}

interface UseCacheReturn extends CacheState {
  // Schools
  cachedSchools: any[];
  schoolsStale: boolean;
  refreshSchools: () => Promise<void>;

  // Sessions
  cachedSessions: any[];
  sessionsStale: boolean;
  refreshSessions: () => Promise<void>;

  // User data
  cachedUserData: any | null;
  refreshUserData: () => Promise<void>;

  // Cache management
  getCacheStats: () => Promise<any>;
  clearCache: () => Promise<void>;
  preloadData: (userId: string) => Promise<void>;
}

export function useCache(userId?: string): UseCacheReturn {
  const [state, setState] = useState<CacheState>({
    isLoading: false,
    lastUpdate: null,
    cacheSize: 0,
    needsRefresh: false,
    error: null,
  });

  const [cachedSchools, setCachedSchools] = useState<any[]>([]);
  const [schoolsStale, setSchoolsStale] = useState(false);
  const [cachedSessions, setCachedSessions] = useState<any[]>([]);
  const [sessionsStale, setSessionsStale] = useState(false);
  const [cachedUserData, setCachedUserData] = useState<any | null>(null);

  const { isOnline } = useOffline();

  // Load cached data on mount and when online status changes
  useEffect(() => {
    loadCachedData();
  }, [userId, isOnline]);

  const loadCachedData = useCallback(async () => {
    if (!userId) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Load schools
      const schoolsResult = await cacheManager.getCachedSchools(userId);
      setCachedSchools(schoolsResult.schools);
      setSchoolsStale(schoolsResult.isStale);

      // Load sessions
      const sessionsResult = await cacheManager.getCachedSessions(userId);
      setCachedSessions(sessionsResult.sessions);
      setSessionsStale(sessionsResult.isStale);

      // Load user data
      const userData = await cacheManager.getCachedUserData();
      setCachedUserData(userData);

      // Get cache stats
      const stats = await cacheManager.getCacheStatistics();

      setState((prev) => ({
        ...prev,
        isLoading: false,
        lastUpdate: new Date(),
        cacheSize: stats.overview.totalItems,
        needsRefresh: schoolsResult.needsRefresh || sessionsResult.needsRefresh,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error ? error.message : "Failed to load cached data",
      }));
    }
  }, [userId]);

  const refreshSchools = useCallback(async () => {
    if (!userId || !isOnline) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // In a real implementation, this would fetch from API
      const mockSchools = [
        {
          id: "school-1",
          name: "Central High School",
          address: "123 Main St",
          coordinates: { lat: 40.7128, lng: -74.006 },
          region: "downtown",
          assignedProviders: [userId],
        },
        {
          id: "school-2",
          name: "Westside Elementary",
          address: "456 Oak Ave",
          coordinates: { lat: 40.7589, lng: -73.9851 },
          region: "westside",
          assignedProviders: [userId],
        },
      ];

      await cacheManager.cacheSchools(mockSchools, userId);

      // Reload cached data
      const result = await cacheManager.getCachedSchools(userId);
      setCachedSchools(result.schools);
      setSchoolsStale(result.isStale);

      setState((prev) => ({
        ...prev,
        isLoading: false,
        lastUpdate: new Date(),
        needsRefresh: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error ? error.message : "Failed to refresh schools",
      }));
    }
  }, [userId, isOnline]);

  const refreshSessions = useCallback(async () => {
    if (!userId || !isOnline) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Mock session data
      const mockSessions = [
        {
          id: "session-1",
          userId,
          schoolId: "school-1",
          startTime: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
          status: "active",
        },
        {
          id: "session-2",
          userId,
          schoolId: "school-2",
          startTime: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
          endTime: Date.now() - 20 * 60 * 60 * 1000, // 20 hours ago
          status: "completed",
        },
      ];

      await cacheManager.cacheSessions(mockSessions, userId);

      // Reload cached data
      const result = await cacheManager.getCachedSessions(userId);
      setCachedSessions(result.sessions);
      setSessionsStale(result.isStale);

      setState((prev) => ({
        ...prev,
        isLoading: false,
        lastUpdate: new Date(),
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error ? error.message : "Failed to refresh sessions",
      }));
    }
  }, [userId, isOnline]);

  const refreshUserData = useCallback(async () => {
    if (!userId || !isOnline) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Mock user data
      const mockUserData = {
        id: userId,
        name: "John Doe",
        email: "john@example.com",
        role: "provider",
        lastActive: Date.now(),
        preferences: {
          notifications: true,
          darkMode: false,
        },
      };

      await cacheManager.cacheUserData(mockUserData);

      // Reload cached data
      const userData = await cacheManager.getCachedUserData();
      setCachedUserData(userData);

      setState((prev) => ({
        ...prev,
        isLoading: false,
        lastUpdate: new Date(),
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to refresh user data",
      }));
    }
  }, [userId, isOnline]);

  const getCacheStats = useCallback(async () => {
    try {
      return await cacheManager.getCacheStatistics();
    } catch (error) {
      console.error("Failed to get cache stats:", error);
      return null;
    }
  }, []);

  const clearCache = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      await cacheManager.clearAllCaches();

      // Reset state
      setCachedSchools([]);
      setCachedSessions([]);
      setCachedUserData(null);
      setSchoolsStale(false);
      setSessionsStale(false);

      setState((prev) => ({
        ...prev,
        isLoading: false,
        lastUpdate: new Date(),
        cacheSize: 0,
        needsRefresh: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to clear cache",
      }));
    }
  }, []);

  const preloadData = useCallback(
    async (preloadUserId: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        await cacheManager.preloadOfflineData(preloadUserId);

        // Reload cached data for current user
        if (preloadUserId === userId) {
          await loadCachedData();
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          lastUpdate: new Date(),
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to preload data",
        }));
      }
    },
    [userId, loadCachedData]
  );

  return {
    ...state,
    cachedSchools,
    schoolsStale,
    refreshSchools,
    cachedSessions,
    sessionsStale,
    refreshSessions,
    cachedUserData,
    refreshUserData,
    getCacheStats,
    clearCache,
    preloadData,
  };
}
