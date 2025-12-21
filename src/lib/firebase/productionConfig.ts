/**
 * Production-specific Firebase configuration and monitoring setup
 * Analytics functionality has been removed - this file is kept for future monitoring needs
 */

import { performance as firebasePerformance } from "../../../firebase.config";
import { trace as performanceTrace } from "firebase/performance";
import type { FirebasePerformance } from "firebase/performance";

// Custom performance metrics
export const PERFORMANCE_METRICS = {
  CHECK_IN_DURATION: "check_in_duration",
  LOCATION_LOAD_TIME: "location_load_time",
  SESSION_LIST_LOAD: "session_list_load",
  USER_SEARCH_TIME: "user_search_time",
  CACHE_RESPONSE_TIME: "cache_response_time",
} as const;

// Simplified monitoring class for performance only
export class ProductionMonitoring {
  // Track custom performance metrics (Firebase Performance only)
  static trackPerformance(
    metricName: string,
    value: number,
    attributes: Record<string, string> = {}
  ): void {
    const perf = firebasePerformance as FirebasePerformance | null;
    if (typeof window === "undefined" || !perf) return;

    try {
      const trace = performanceTrace(perf, metricName);

      // Add custom attributes
      Object.entries(attributes).forEach(([key, val]) => {
        trace.putAttribute(key, val);
      });

      // Record the metric value
      trace.putMetric(metricName, Math.round(value));
      trace.stop();
    } catch (error) {
      console.warn("Performance tracking failed:", error);
    }
  }

  // Initialize production monitoring (performance only)
  static initialize(): void {
    if (typeof window === "undefined") return;

    // Monitor performance
    this.setupPerformanceMonitoring();

    console.log("🔍 Performance monitoring initialized");
  }

  // Setup performance monitoring
  private static setupPerformanceMonitoring(): void {
    const perf = firebasePerformance as FirebasePerformance | null;
    if (typeof window === "undefined" || !perf) return;

    // Monitor page load performance
    window.addEventListener("load", () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType(
          "navigation"
        )[0] as PerformanceNavigationTiming;

        if (navigation) {
          this.trackPerformance(
            "page_load_time",
            navigation.loadEventEnd - navigation.fetchStart,
            {
              page: window.location.pathname,
            }
          );
        }
      }, 1000);
    });

    // Monitor web vitals if available
    if ("web-vitals" in window) {
      import("web-vitals").then(({ onLCP, onINP, onCLS }) => {
        onLCP((metric) => {
          this.trackPerformance("lcp", metric.value, {
            page: window.location.pathname,
            rating: metric.rating,
          });
        });

        onINP((metric) => {
          this.trackPerformance("inp", metric.value, {
            page: window.location.pathname,
            rating: metric.rating,
          });
        });

        onCLS((metric) => {
          this.trackPerformance("cls", metric.value * 1000, {
            // Convert to milliseconds
            page: window.location.pathname,
            rating: metric.rating,
          });
        });
      });
    }
  }
}
