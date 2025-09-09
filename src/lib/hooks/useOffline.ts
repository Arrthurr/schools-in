"use client";

import { useState, useEffect, useCallback } from "react";
import { serviceManager } from "../offline/serviceManager";

interface OfflineState {
  isOnline: boolean;
  syncInProgress: boolean;
  pendingActions: number;
  lastSyncTime: Date | null;
}

interface UseOfflineReturn {
  isOnline: boolean;
  syncInProgress: boolean;
  lastSyncTime: Date | null;
  checkInOffline: (checkInData: {
    schoolId: string;
    userId: string;
    coordinates: { lat: number; lng: number };
    timestamp: number;
  }) => Promise<any>;
  checkOutOffline: (checkOutData: {
    sessionId: string;
    coordinates: { lat: number; lng: number };
    timestamp: number;
  }) => Promise<any>;
  syncOfflineActions: () => Promise<void>;
  getCachedSchools: (userId?: string) => Promise<any[]>;
  getCachedSessions: (userId?: string) => Promise<any[]>;
  clearOfflineData: () => Promise<void>;
}

export function useOffline(): UseOfflineReturn {
  const [state, setState] = useState<OfflineState>({
    isOnline: true,
    syncInProgress: false,
    pendingActions: 0,
    lastSyncTime: null,
  });

  useEffect(() => {
    // Initialize state
    const updateState = () => {
      const { isOnline, syncInProgress } = serviceManager.getSyncStatus();
      setState((prev) => ({
        ...prev,
        isOnline,
        syncInProgress,
      }));
    };

    updateState();

    // Listen for service manager status changes
    const handleStatusChange = (event: CustomEvent) => {
      const { status, isOnline } = event.detail;

      setState((prev) => ({
        ...prev,
        isOnline,
        syncInProgress: status === "sync-started",
        lastSyncTime:
          status === "sync-completed" ? new Date() : prev.lastSyncTime,
      }));
    };

    window.addEventListener(
      "service-manager-status",
      handleStatusChange as EventListener
    );

    // Check online status changes
    const handleOnline = () =>
      setState((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () =>
      setState((prev) => ({ ...prev, isOnline: false }));

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener(
        "service-manager-status",
        handleStatusChange as EventListener
      );
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const performOfflineCheckIn = useCallback(
    async (checkInData: {
      schoolId: string;
      userId: string;
      coordinates: { lat: number; lng: number };
      timestamp: number;
    }) => {
      try {
        setState((prev) => ({ ...prev, syncInProgress: true }));
        const result = await serviceManager.performOfflineCheckIn(checkInData);
        setState((prev) => ({ ...prev, syncInProgress: false }));
        return result;
      } catch (error) {
        setState((prev) => ({ ...prev, syncInProgress: false }));
        throw error;
      }
    },
    []
  );

  const performOfflineCheckOut = useCallback(
    async (checkOutData: {
      sessionId: string;
      coordinates: { lat: number; lng: number };
      timestamp: number;
    }) => {
      try {
        setState((prev) => ({ ...prev, syncInProgress: true }));
        const result = await serviceManager.performOfflineCheckOut(
          checkOutData
        );
        setState((prev) => ({ ...prev, syncInProgress: false }));
        return result;
      } catch (error) {
        setState((prev) => ({ ...prev, syncInProgress: false }));
        throw error;
      }
    },
    []
  );

  const getCachedSchools = useCallback(async (userId?: string) => {
    return await serviceManager.getOfflineSchools(userId);
  }, []);

  const getCachedSessions = useCallback(async (userId?: string) => {
    return await serviceManager.getOfflineSessions(userId);
  }, []);

  const triggerSync = useCallback(async () => {
    setState((prev) => ({ ...prev, syncInProgress: true }));
    try {
      await serviceManager.performBackgroundSync();
      setState((prev) => ({
        ...prev,
        syncInProgress: false,
        lastSyncTime: new Date(),
      }));
    } catch (error) {
      setState((prev) => ({ ...prev, syncInProgress: false }));
      throw error;
    }
  }, []);

  const clearOfflineData = useCallback(async () => {
    await serviceManager.clearAllOfflineData();
    setState((prev) => ({
      ...prev,
      pendingActions: 0,
      lastSyncTime: null,
    }));
  }, []);

  return {
    isOnline: state.isOnline,
    syncInProgress: state.syncInProgress,
    lastSyncTime: state.lastSyncTime,
    checkInOffline: performOfflineCheckIn,
    checkOutOffline: performOfflineCheckOut,
    syncOfflineActions: triggerSync,
    getCachedSchools,
    getCachedSessions,
    clearOfflineData,
  };
}
