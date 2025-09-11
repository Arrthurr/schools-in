/**
 * Custom hook for application analytics and performance monitoring
 */

import { useCallback, useEffect } from "react";
import { useAuth } from "./useAuth";
import {
  ProductionMonitoring,
  ANALYTICS_EVENTS,
  PERFORMANCE_METRICS,
} from "../firebase/productionConfig";

export interface AnalyticsOptions {
  enableAutoTracking?: boolean;
  enablePerformanceTracking?: boolean;
  enableErrorTracking?: boolean;
}

export function useAnalytics(options: AnalyticsOptions = {}) {
  const { user } = useAuth();
  const {
    enableAutoTracking = true,
    enablePerformanceTracking = true,
    enableErrorTracking = true,
  } = options;

  // Set user context when user changes
  useEffect(() => {
    if (user && user.role && process.env.NODE_ENV === "production") {
      ProductionMonitoring.setUserContext({
        uid: user.uid,
        role: user.role,
        displayName: user.displayName || undefined,
        email: user.email || undefined,
      });
    }
  }, [user]);

  // Track page views automatically
  useEffect(() => {
    if (enableAutoTracking && process.env.NODE_ENV === "production") {
      const handleRouteChange = () => {
        ProductionMonitoring.trackEvent(ANALYTICS_EVENTS.PAGE_VIEW, {
          page_title: document.title,
          page_location: window.location.href,
          page_path: window.location.pathname,
          user_role: user?.role,
        });
      };

      // Track initial page load
      handleRouteChange();

      // Track route changes
      window.addEventListener("popstate", handleRouteChange);

      return () => {
        window.removeEventListener("popstate", handleRouteChange);
      };
    }
  }, [enableAutoTracking, user?.role]);

  // Track user events
  const trackEvent = useCallback(
    (
      eventName: string,
      parameters: Record<string, any> = {},
      userProperties: Record<string, any> = {}
    ) => {
      if (process.env.NODE_ENV === "production") {
        ProductionMonitoring.trackEvent(
          eventName,
          {
            ...parameters,
            user_role: user?.role,
          },
          userProperties
        );
      }
    },
    [user?.role]
  );

  // Track performance metrics
  const trackPerformance = useCallback(
    (
      metricName: string,
      value: number,
      attributes: Record<string, string> = {}
    ) => {
      if (enablePerformanceTracking && process.env.NODE_ENV === "production") {
        ProductionMonitoring.trackPerformance(metricName, value, {
          ...attributes,
          user_role: user?.role || "anonymous",
        });
      }
    },
    [enablePerformanceTracking, user?.role]
  );

  // Track user sessions
  const trackUserSession = useCallback(
    (
      action: "start" | "end" | "pause" | "resume",
      sessionData: Record<string, any> = {}
    ) => {
      if (user && process.env.NODE_ENV === "production") {
        ProductionMonitoring.trackUserSession(user.uid, action, {
          ...sessionData,
          userRole: user.role,
        });
      }
    },
    [user]
  );

  // Track location events
  const trackLocationEvent = useCallback(
    (
      action: "check_in" | "check_out" | "view",
      locationData: Record<string, any>,
      userContext: Record<string, any> = {}
    ) => {
      if (process.env.NODE_ENV === "production") {
        ProductionMonitoring.trackLocationEvent(action, locationData, {
          ...userContext,
          role: user?.role,
        });
      }
    },
    [user?.role]
  );

  // Track search operations
  const trackSearch = useCallback(
    (
      searchTerm: string,
      searchType: "users" | "locations" | "sessions",
      results: { count: number; loadTime: number; fromCache: boolean }
    ) => {
      if (process.env.NODE_ENV === "production") {
        ProductionMonitoring.trackSearch(searchTerm, searchType, results);
      }
    },
    []
  );

  // Track errors
  const trackError = useCallback(
    (
      error: Error,
      context: Record<string, any> = {},
      severity: "low" | "medium" | "high" | "critical" = "medium"
    ) => {
      if (enableErrorTracking && process.env.NODE_ENV === "production") {
        ProductionMonitoring.trackError(
          error,
          {
            ...context,
            user_role: user?.role,
            user_id: user?.uid,
          },
          severity
        );
      }
    },
    [enableErrorTracking, user?.role, user?.uid]
  );

  // Track cache performance
  const trackCachePerformance = useCallback(
    (
      operation: "hit" | "miss" | "write" | "invalidate",
      details: Record<string, any> = {}
    ) => {
      if (enablePerformanceTracking && process.env.NODE_ENV === "production") {
        ProductionMonitoring.trackCachePerformance(operation, details);
      }
    },
    [enablePerformanceTracking]
  );

  return {
    trackEvent,
    trackPerformance,
    trackUserSession,
    trackLocationEvent,
    trackSearch,
    trackError,
    trackCachePerformance,
    // Convenience methods for common events
    trackLogin: (method: string) =>
      trackEvent(ANALYTICS_EVENTS.LOGIN, { method }),
    trackLogout: () => trackEvent(ANALYTICS_EVENTS.LOGOUT),
    trackCheckIn: (locationData: any) =>
      trackLocationEvent("check_in", locationData),
    trackCheckOut: (locationData: any) =>
      trackLocationEvent("check_out", locationData),
    // Performance tracking shortcuts
    trackCheckInDuration: (duration: number) =>
      trackPerformance(PERFORMANCE_METRICS.CHECK_IN_DURATION, duration),
    trackLocationLoadTime: (duration: number) =>
      trackPerformance(PERFORMANCE_METRICS.LOCATION_LOAD_TIME, duration),
    trackSessionListLoad: (duration: number) =>
      trackPerformance(PERFORMANCE_METRICS.SESSION_LIST_LOAD, duration),
    trackUserSearchTime: (duration: number) =>
      trackPerformance(PERFORMANCE_METRICS.USER_SEARCH_TIME, duration),
    trackCacheResponseTime: (duration: number) =>
      trackPerformance(PERFORMANCE_METRICS.CACHE_RESPONSE_TIME, duration),
  };
}
