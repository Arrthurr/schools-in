/**
 * Analytics Provider component that integrates performance monitoring
 * and analytics tracking throughout the application
 */

"use client";

import { useEffect } from "react";
import { useAnalytics } from "../hooks/useAnalytics";
import { ProductionMonitoring } from "../firebase/productionConfig";
import { webVitalsMonitor } from "../performance/webVitals";
import { PerformanceMonitor } from "../../components/dev/PerformanceMonitor";

interface AnalyticsProviderProps {
  children: React.ReactNode;
  showPerformanceMonitor?: boolean;
}

export function AnalyticsProvider({
  children,
  showPerformanceMonitor = process.env.NODE_ENV === "development",
}: AnalyticsProviderProps) {
  const analytics = useAnalytics();

  useEffect(() => {
    // Initialize production monitoring in production environment
    if (process.env.NODE_ENV === "production") {
      ProductionMonitoring.initialize();
    }

    // Set up global error handlers for production analytics
    const handleGlobalError = (event: ErrorEvent) => {
      analytics.trackError(
        new Error(event.message),
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          source: "global_error_handler",
        },
        "high"
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      analytics.trackError(
        new Error(String(event.reason)),
        {
          source: "unhandled_promise_rejection",
          promise: String(event.promise).substring(0, 100),
        },
        "high"
      );
    };

    // Add event listeners
    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Track initial page load
    if (performance && performance.timing) {
      const loadTime =
        performance.timing.loadEventEnd - performance.timing.navigationStart;
      if (loadTime > 0) {
        analytics.trackPerformance("initial_page_load", loadTime, {
          page: window.location.pathname,
        });
      }
    }

    // Set up visibility change tracking for session analytics
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Track session pause
        analytics.trackEvent("session_pause", {
          page: window.location.pathname,
          timestamp: Date.now(),
        });
      } else {
        // Track session resume
        analytics.trackEvent("session_resume", {
          page: window.location.pathname,
          timestamp: Date.now(),
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [analytics]);

  // Track route changes (for client-side navigation)
  useEffect(() => {
    const trackRouteChange = () => {
      analytics.trackEvent("page_view", {
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname,
      });
    };

    // Track initial route
    trackRouteChange();

    // Listen for browser navigation
    window.addEventListener("popstate", trackRouteChange);

    return () => {
      window.removeEventListener("popstate", trackRouteChange);
    };
  }, [analytics]);

  return (
    <>
      {children}

      {/* Performance Monitor for development and optional production use */}
      {showPerformanceMonitor && (
        <PerformanceMonitor
          showDetails={process.env.NODE_ENV === "development"}
          autoRefresh={true}
          refreshInterval={5000}
        />
      )}
    </>
  );
}
