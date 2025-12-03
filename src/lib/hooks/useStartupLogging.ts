"use client";

import { useEffect } from "react";

import { logStartupStage, logStartupWarning } from "@/lib/logging/startupLogger";

type ExtendedNavigator = Navigator & {
  deviceMemory?: number;
  standalone?: boolean;
};

type PartialNetworkInformation = {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
};

const getDisplayMode = () => {
  if (typeof window === "undefined") {
    return "unknown";
  }

  if (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) {
    return "standalone";
  }

  const nav = navigator as ExtendedNavigator;
  if (nav.standalone) {
    return "ios-standalone";
  }

  return "browser";
};

const getConnectionMeta = () => {
  if (typeof navigator === "undefined" || !("connection" in navigator)) {
    return undefined;
  }

  const connection = (navigator as ExtendedNavigator & {
    connection?: PartialNetworkInformation;
  }).connection;
  if (!connection) {
    return undefined;
  }

  return {
    downlink: connection.downlink,
    effectiveType: connection.effectiveType,
    rtt: connection.rtt,
    saveData: connection.saveData,
  };
};

const getNavigationTimings = () => {
  if (typeof performance === "undefined") {
    return undefined;
  }

  const [navEntry] = performance.getEntriesByType("navigation") as
    | PerformanceNavigationTiming[]
    | [];

  if (!navEntry) {
    return undefined;
  }

  return {
    domContentLoaded: navEntry.domContentLoadedEventEnd,
    loadEventEnd: navEntry.loadEventEnd,
    responseTime: navEntry.responseEnd - navEntry.responseStart,
    transferSize: navEntry.transferSize,
  };
};

export const useStartupLogging = () => {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const nav = navigator as ExtendedNavigator;
      const screenMeta = window.screen;

      logStartupStage("client:hydration-complete", {
        userAgent: nav.userAgent,
        language: nav.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        online: nav.onLine,
        displayMode: getDisplayMode(),
        prefersReducedMotion:
          typeof window.matchMedia === "function"
            ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
            : undefined,
        deviceMemory: nav.deviceMemory,
        screen: {
          width: screenMeta.width,
          height: screenMeta.height,
          pixelRatio: window.devicePixelRatio,
        },
        connection: getConnectionMeta(),
        navigation: getNavigationTimings(),
        serviceWorkerStatus: navigator.serviceWorker?.controller ? "controlled" : "uncontrolled",
      });

      const timeoutId = window.setTimeout(() => {
        logStartupStage("client:post-hydration-ready", {
          visibility: document.visibilityState,
          hidden: document.hidden,
        });
      }, 1200);

      return () => {
        window.clearTimeout(timeoutId);
      };
    } catch (error) {
      logStartupWarning("client:startup-logging-failed", { error });
    }
  }, []);
};
