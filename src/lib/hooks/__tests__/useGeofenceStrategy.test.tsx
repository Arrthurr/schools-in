import { act, renderHook, waitFor } from "@testing-library/react";
import { useGeofenceStrategy } from "../useGeofenceStrategy";
import type {
  GeofenceStrategy,
  PlatformInfo,
  PWACapabilities,
} from "@/lib/pwa/capabilities";

jest.mock("@/lib/pwa/capabilities", () => ({
  detectCapabilities: jest.fn(),
  detectPlatform: jest.fn(),
  determineGeofenceStrategy: jest.fn(),
  determineFallbackStrategy: jest.fn(),
  getCapabilityLimitations: jest.fn(),
  getStrategyConfig: jest.fn(),
}));

jest.mock("@/lib/logging/appLogger", () => ({
  appLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const capabilities = jest.requireMock("@/lib/pwa/capabilities") as {
  detectCapabilities: jest.Mock;
  detectPlatform: jest.Mock;
  determineGeofenceStrategy: jest.Mock;
  determineFallbackStrategy: jest.Mock;
  getCapabilityLimitations: jest.Mock;
  getStrategyConfig: jest.Mock;
};

describe("useGeofenceStrategy", () => {
  const mockCaps: PWACapabilities = {
    periodicBackgroundSync: false,
    backgroundSync: false,
    wakeLock: false,
    pushNotifications: true,
    serviceWorkerActive: true,
    geolocation: true,
    notifications: true,
  };

  const mockPlatform: PlatformInfo = {
    isIOS: false,
    isAndroid: false,
    isChrome: true,
    isFirefox: false,
    isSafari: false,
    isEdge: false,
    isSamsungInternet: false,
    isPWA: false,
  };

  const configFor = (strategy: GeofenceStrategy) => {
    switch (strategy) {
      case "periodic-sync":
        return { pollIntervalMs: 60_000, useWakeLock: true, debouncePolls: 2 };
      case "visibility-wakelock":
        return { pollIntervalMs: 30_000, useWakeLock: true, debouncePolls: 2 };
      case "visibility-polling":
        return { pollIntervalMs: 60_000, useWakeLock: false, debouncePolls: 2 };
      case "manual-only":
        return { pollIntervalMs: 0, useWakeLock: false, debouncePolls: 1 };
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capabilities.detectCapabilities.mockResolvedValue(mockCaps);
    capabilities.detectPlatform.mockReturnValue(mockPlatform);
    capabilities.determineGeofenceStrategy.mockReturnValue(
      "visibility-polling" satisfies GeofenceStrategy
    );
    capabilities.determineFallbackStrategy.mockReturnValue(
      "manual-only" satisfies GeofenceStrategy
    );
    capabilities.getCapabilityLimitations.mockReturnValue([
      "Some limitation text",
    ]);
    capabilities.getStrategyConfig.mockImplementation((s: GeofenceStrategy) =>
      configFor(s)
    );
  });

  it("detects capabilities/platform on mount and exposes derived strategy state", async () => {
    const { result } = renderHook(() => useGeofenceStrategy());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(capabilities.detectCapabilities).toHaveBeenCalledTimes(1);
    expect(capabilities.detectPlatform).toHaveBeenCalledTimes(1);
    expect(capabilities.determineGeofenceStrategy).toHaveBeenCalledWith(
      mockCaps,
      mockPlatform
    );
    expect(capabilities.determineFallbackStrategy).toHaveBeenCalledWith(
      "visibility-polling",
      mockCaps
    );
    expect(capabilities.getCapabilityLimitations).toHaveBeenCalledWith(
      mockCaps,
      mockPlatform
    );

    expect(result.current.strategy).toBe("visibility-polling");
    expect(result.current.fallbackStrategy).toBe("manual-only");
    expect(result.current.isUsingFallback).toBe(false);
    expect(result.current.limitations).toEqual(["Some limitation text"]);
    expect(result.current.config).toEqual(configFor("visibility-polling"));
  });

  it("switchToFallback moves to fallback strategy and marks isUsingFallback", async () => {
    const { result } = renderHook(() => useGeofenceStrategy());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.switchToFallback();
    });

    expect(result.current.strategy).toBe("manual-only");
    expect(result.current.isUsingFallback).toBe(true);
    expect(result.current.config).toEqual(configFor("manual-only"));
  });

  it("refresh re-runs detection and updates current strategy", async () => {
    const { result } = renderHook(() => useGeofenceStrategy());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    capabilities.determineGeofenceStrategy.mockReturnValueOnce(
      "periodic-sync" satisfies GeofenceStrategy
    );
    capabilities.determineFallbackStrategy.mockReturnValueOnce(
      "visibility-wakelock" satisfies GeofenceStrategy
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(capabilities.detectCapabilities).toHaveBeenCalledTimes(2);
    expect(result.current.strategy).toBe("periodic-sync");
    expect(result.current.fallbackStrategy).toBe("visibility-wakelock");
    expect(result.current.isUsingFallback).toBe(false);
    expect(result.current.config).toEqual(configFor("periodic-sync"));
  });

  it("falls back to manual-only strategy when detection throws", async () => {
    capabilities.detectCapabilities.mockRejectedValueOnce(
      new Error("capabilities failed")
    );

    const { result } = renderHook(() => useGeofenceStrategy());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.strategy).toBe("manual-only");
  });
});

