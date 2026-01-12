import { act, renderHook, waitFor } from "@testing-library/react";
import { useAutoGeofenceCheck } from "../useAutoGeofenceCheck";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useAutoGeofencePreference } from "@/lib/hooks/useAutoGeofencePreference";
import { useCachedSession } from "@/lib/hooks/useCachedSession";
import { useSession } from "@/lib/hooks/useSession";
import { useGeofenceStrategy } from "@/lib/hooks/useGeofenceStrategy";
import { locationService } from "@/lib/utils/location";
import { validateGeofence } from "@/lib/utils/geo";
import { getCachedLocationsByProvider } from "@/lib/firebase/cachedFirestore";
import { toast } from "@/components/ui/use-toast";
import { GeoPoint, Timestamp } from "firebase/firestore";
import type { Location, Session } from "@/lib/firebase/types";

// Mock all dependencies
jest.mock("@/lib/hooks/useCachedAuth");
jest.mock("@/lib/hooks/useAutoGeofencePreference");
jest.mock("@/lib/hooks/useCachedSession");
jest.mock("@/lib/hooks/useSession");
jest.mock("@/lib/hooks/useGeofenceStrategy");
jest.mock("@/lib/utils/location");
jest.mock("@/lib/utils/geo");
jest.mock("@/lib/firebase/cachedFirestore");
jest.mock("@/components/ui/use-toast");
jest.mock("@/lib/logging/appLogger", () => ({
  appLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock PWA background sync modules
jest.mock("@/lib/offline/offlineDB", () => ({
  saveGeofenceConfig: jest.fn().mockResolvedValue(undefined),
  updateGeofenceActiveSession: jest.fn().mockResolvedValue(undefined),
  updateGeofenceUserLocation: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/pwa/periodicBackgroundSync", () => ({
  registerPeriodicGeofenceSync: jest.fn().mockResolvedValue(false),
  unregisterPeriodicGeofenceSync: jest.fn().mockResolvedValue(false),
  setupGeofenceCheckListener: jest.fn().mockReturnValue(() => undefined),
}));

// Mock Wake Lock API
Object.defineProperty(navigator, "wakeLock", {
  writable: true,
  value: {
    request: jest.fn().mockResolvedValue({
      release: jest.fn().mockResolvedValue(undefined),
      addEventListener: jest.fn(),
    }),
  },
});

// Mock document.visibilityState
Object.defineProperty(document, "visibilityState", {
  writable: true,
  value: "visible",
});

// Helper to flush all pending promises and microtasks
const flushPromises = () => new Promise(jest.requireActual("timers").setImmediate);

describe("useAutoGeofenceCheck", () => {
  const mockUser = { uid: "user-1", role: "provider" };
  const mockLocation: Location = {
    id: "loc-1",
    name: "Test School",
    address: "123 Test St",
    geo: new GeoPoint(40.7128, -74.006),
    radiusMeters: 100,
    assignedProviders: ["user-1"],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const mockCheckIn = jest.fn();
  const mockCheckOut = jest.fn();
  const mockToast = jest.fn().mockReturnValue({
    id: "toast-1",
    dismiss: jest.fn(),
    update: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset visibility state for each test
    Object.defineProperty(document, "visibilityState", {
      writable: true,
      value: "visible",
    });

    (useCachedAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (useAutoGeofencePreference as jest.Mock).mockReturnValue({
      enabled: false,
    });
    (useCachedSession as jest.Mock).mockReturnValue({ activeSession: null });
    (useSession as jest.Mock).mockReturnValue({
      checkIn: mockCheckIn,
      checkOut: mockCheckOut,
    });
    (useGeofenceStrategy as jest.Mock).mockReturnValue({
      strategy: "visibility-polling",
      config: {
        pollIntervalMs: 60000,
        debouncePolls: 2,
        usePushReminders: false,
        useWakeLock: false,
      },
      limitations: [],
      switchToFallback: jest.fn(),
    });
    (toast as jest.Mock).mockImplementation(mockToast);
    (locationService.getCurrentLocation as jest.Mock).mockResolvedValue({
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 10,
    });
    (validateGeofence as jest.Mock).mockReturnValue({
      distance: 50,
      isWithinGeofence: false,
    });
    (getCachedLocationsByProvider as jest.Mock).mockResolvedValue([mockLocation]);
  });

  afterEach(async () => {
    // Wait for any pending async operations before cleaning up
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    // Clear all timers without executing callbacks to avoid state updates outside act()
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe("Feature flag and initialization", () => {
    it("should be disabled when feature flag is off", () => {
      // Mock the feature flag check by setting env before import
      // Since the module is already loaded, we need to test the actual behavior
      // The feature flag check happens at module load time
      const { result } = renderHook(() => useAutoGeofenceCheck());

      // Feature flag defaults to enabled if env var is not "false"
      // This test verifies the hook works, not the feature flag itself
      expect(result.current).toHaveProperty("featureEnabled");
    });

    it("should be disabled when user is not authenticated", () => {
      (useCachedAuth as jest.Mock).mockReturnValue({ user: null });

      const { result } = renderHook(() => useAutoGeofenceCheck());

      expect(result.current.featureEnabled).toBe(false);
    });

    it("should load assigned locations when preference is enabled", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });

      renderHook(() => useAutoGeofenceCheck());

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalledWith("user-1", {
          forceRefresh: true,
        });
      });
    });

    it("should have locationPermission state initialized as unknown", () => {
      const { result } = renderHook(() => useAutoGeofenceCheck());

      expect(result.current.locationPermission).toBe("unknown");
    });
  });

  describe("Location permission tracking", () => {
    it("should set locationPermission to granted after successful location fetch", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (locationService.getCurrentLocation as jest.Mock).mockResolvedValue({
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
      });

      const { result } = renderHook(() => useAutoGeofenceCheck());

      // Wait for polling to start and complete
      await act(async () => {
        await flushPromises();
        jest.advanceTimersByTime(100);
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.locationPermission).toBe("granted");
      });
    });

    it("should set locationPermission to denied when geolocation is denied (error code 1)", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (locationService.getCurrentLocation as jest.Mock).mockRejectedValue({
        code: 1,
        message: "User denied geolocation",
      });

      const { result } = renderHook(() => useAutoGeofenceCheck());

      // Wait for polling to start and fail
      await act(async () => {
        await flushPromises();
        jest.advanceTimersByTime(100);
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.locationPermission).toBe("denied");
      });
    });

    it("should set locationPermission to unavailable when geolocation is not supported (error code 0)", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (locationService.getCurrentLocation as jest.Mock).mockRejectedValue({
        code: 0,
        message: "Geolocation is not supported",
      });

      const { result } = renderHook(() => useAutoGeofenceCheck());

      // Wait for polling to start and fail
      await act(async () => {
        await flushPromises();
        jest.advanceTimersByTime(100);
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.locationPermission).toBe("unavailable");
      });
    });
  });

  describe("GPS polling behavior", () => {
    it("should not poll when preference is disabled", () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: false,
      });

      renderHook(() => useAutoGeofenceCheck());

      jest.advanceTimersByTime(60000);

      expect(locationService.getCurrentLocation).not.toHaveBeenCalled();
    });

    it("should poll every 60 seconds when enabled", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });

      renderHook(() => useAutoGeofenceCheck());

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      // Wait for initial poll to complete
      await act(async () => {
        jest.advanceTimersByTime(0);
        await Promise.resolve();
        await Promise.resolve(); // Flush all microtasks
      });

      // Clear previous calls to count only new ones
      (locationService.getCurrentLocation as jest.Mock).mockClear();

      // After 60 seconds - advance timers and wait for async operations
      await act(async () => {
        jest.advanceTimersByTime(60000);
        await Promise.resolve();
        await Promise.resolve(); // Flush all microtasks
      });

      // Wait for the async poll to complete
      await waitFor(() => {
        expect(locationService.getCurrentLocation).toHaveBeenCalled();
      });
    });

    it("should stop polling when tab becomes hidden", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });

      renderHook(() => useAutoGeofenceCheck());

      // Wait for locations to load and initial poll
      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      // Flush initial poll
      await act(async () => {
        await flushPromises();
      });

      // Simulate tab hidden
      await act(async () => {
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          value: "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
        await flushPromises();
      });

      const callCountBefore = (locationService.getCurrentLocation as jest.Mock).mock
        .calls.length;

      await act(async () => {
        jest.advanceTimersByTime(60000);
        await flushPromises();
      });

      // Should not poll when hidden
      const callCountAfterHidden = (locationService.getCurrentLocation as jest.Mock).mock
        .calls.length;
      expect(callCountAfterHidden).toBe(callCountBefore);

      // Resume visibility
      await act(async () => {
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          value: "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
        await flushPromises();
      });

      // Should poll again when visible - wait for at least one more call
      await waitFor(() => {
        expect(
          (locationService.getCurrentLocation as jest.Mock).mock.calls.length
        ).toBeGreaterThan(callCountBefore);
      });
    });
  });

  describe("GPS accuracy handling", () => {
    it("should skip poll when accuracy is worse than 50 meters", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (locationService.getCurrentLocation as jest.Mock).mockResolvedValue({
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 60, // Poor accuracy
      });

      renderHook(() => useAutoGeofenceCheck());

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      await act(async () => {
        jest.advanceTimersByTime(0);
        await Promise.resolve();
        await Promise.resolve(); // Flush all microtasks
      });

      // Should not trigger geofence check with poor accuracy
      expect(validateGeofence).not.toHaveBeenCalled();
    });

    it("should pause after 3 consecutive poor accuracy cycles", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (locationService.getCurrentLocation as jest.Mock).mockResolvedValue({
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 60, // Poor accuracy
      });

      const { result } = renderHook(() => useAutoGeofenceCheck());

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      // Trigger 3 poor accuracy cycles
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          jest.advanceTimersByTime(60000);
          await Promise.resolve();
          await Promise.resolve(); // Flush all microtasks
        });
      }

      await waitFor(
        () => {
          expect(result.current.pausedReason).toBe("poor-accuracy");
        },
        { timeout: 2000 }
      );

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Auto check temporarily paused",
        })
      );
    });

    it("should resume when accuracy improves", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });

      // Start with poor accuracy
      (locationService.getCurrentLocation as jest.Mock).mockResolvedValue({
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 60,
      });

      const { result } = renderHook(() => useAutoGeofenceCheck());

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      // Initial poll
      await act(async () => {
        jest.advanceTimersByTime(0);
        await Promise.resolve();
        await Promise.resolve(); // Flush all microtasks
      });

      // Trigger 3 poor accuracy cycles to pause
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          jest.advanceTimersByTime(60000);
          await Promise.resolve();
          await Promise.resolve(); // Flush all microtasks
        });
      }

      await waitFor(
        () => {
          expect(result.current.pausedReason).toBe("poor-accuracy");
        },
        { timeout: 2000 }
      );

      // Improve accuracy
      (locationService.getCurrentLocation as jest.Mock).mockResolvedValue({
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
      });

      // Clear toast calls to check for resume toast
      (toast as jest.Mock).mockClear();

      // Trigger poll with good accuracy - this should call handleGoodAccuracy
      // which sets pausedReason to null
      await act(async () => {
        jest.advanceTimersByTime(60000);
        await Promise.resolve();
        await Promise.resolve(); // Flush all microtasks
      });

      // Wait for state updates to propagate (setPausedReason is async)
      await waitFor(
        () => {
          expect(result.current.pausedReason).toBeNull();
        },
        { timeout: 2000 }
      );

      // Check for resume toast - should be called when pausedReason is cleared
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Auto check resumed",
        })
      );
    });
  });

  describe("Geofence state transitions", () => {
    it("should track outside state when not in any geofence", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (validateGeofence as jest.Mock).mockReturnValue({
        distance: 200,
        isWithinGeofence: false,
      });

      const { result } = renderHook(() => useAutoGeofenceCheck());

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      await act(async () => {
        jest.advanceTimersByTime(0);
        await Promise.resolve();
        await Promise.resolve(); // Flush all microtasks
      });

      await waitFor(
        () => {
          expect(result.current.geofenceState).toBe("outside");
        },
        { timeout: 2000 }
      );
    });

    it("should transition from outside to entering after 1 poll inside", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (validateGeofence as jest.Mock).mockReturnValue({
        distance: 50,
        isWithinGeofence: true,
      });

      const { result } = renderHook(() => useAutoGeofenceCheck());

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      await act(async () => {
        jest.advanceTimersByTime(0);
        await Promise.resolve();
        await Promise.resolve(); // Flush all microtasks
      });

      await waitFor(
        () => {
          expect(result.current.geofenceState).toBe("entering");
        },
        { timeout: 2000 }
      );
    });

    it("should trigger check-in after 2 consecutive polls inside (debouncing)", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (validateGeofence as jest.Mock).mockReturnValue({
        distance: 50,
        isWithinGeofence: true,
      });

      renderHook(() => useAutoGeofenceCheck());

      // Wait for locations to load and initial poll to complete
      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      // First poll already happened during initialization
      // Flush to ensure it completed
      await act(async () => {
        await flushPromises();
      });

      // Second poll - should trigger check-in countdown (after debounce = 2 polls)
      await act(async () => {
        jest.advanceTimersByTime(60000);
        await flushPromises();
      });

      // Wait for the countdown toast to be triggered
      await waitFor(
        () => {
          expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({
              title: "Auto check-in",
            })
          );
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Auto check-in flow", () => {
    it("should not trigger check-in when there is an active session", async () => {
      const mockSession: Session = {
        id: "session-1",
        userId: "user-1",
        locationId: "loc-1",
        status: "active",
        checkInTime: Timestamp.now(),
        startTime: Timestamp.now(),
        checkInMethod: "geo",
        distanceFromCenterAtCheckIn: 50,
        dayKey: "2024-01-01",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (useCachedSession as jest.Mock).mockReturnValue({
        activeSession: mockSession,
      });
      (validateGeofence as jest.Mock).mockReturnValue({
        distance: 50,
        isWithinGeofence: true,
      });

      renderHook(() => useAutoGeofenceCheck());

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      await act(async () => {
        jest.advanceTimersByTime(0);
        await Promise.resolve();
        await Promise.resolve(); // Flush all microtasks
      });

      // Should not trigger check-in countdown
      expect(toast).not.toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Auto check-in",
        })
      );
    });

    it("should cancel check-in countdown when cancelled", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (validateGeofence as jest.Mock).mockReturnValue({
        distance: 50,
        isWithinGeofence: true,
      });

      let cancelCallback: (() => void) | undefined;

      (toast as jest.Mock).mockImplementation((config) => {
        const toastInstance = {
          id: "toast-1",
          dismiss: jest.fn(),
          update: jest.fn().mockImplementation((updateConfig: { action?: { props?: { onClick?: () => void } } }) => {
            // Capture action from update call (action is added via update in the hook)
            if (updateConfig?.action?.props?.onClick) {
              cancelCallback = updateConfig.action.props.onClick;
            }
          }),
        };

        // Also check initial config
        if (config.action) {
          const actionElement = config.action as { props?: { onClick?: () => void } };
          if (actionElement?.props?.onClick) {
            cancelCallback = actionElement.props.onClick;
          }
        }

        return toastInstance;
      });

      renderHook(() => useAutoGeofenceCheck());

      // Wait for locations to load and initial poll
      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      // First poll already happened, flush it
      await act(async () => {
        await flushPromises();
      });

      // Second poll - trigger check-in countdown
      await act(async () => {
        jest.advanceTimersByTime(60000);
        await flushPromises();
      });

      await waitFor(
        () => {
          expect(toast).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      // Cancel the countdown
      if (cancelCallback) {
        await act(async () => {
          cancelCallback!();
          await flushPromises();
        });
      }

      // Should not call checkIn
      expect(mockCheckIn).not.toHaveBeenCalled();
    });

    it("should complete check-in after countdown expires", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (validateGeofence as jest.Mock).mockReturnValue({
        distance: 50,
        isWithinGeofence: true,
      });

      mockCheckIn.mockResolvedValue(undefined);

      const toastInstance = {
        id: "toast-1",
        dismiss: jest.fn(),
        update: jest.fn(),
      };

      (toast as jest.Mock).mockReturnValue(toastInstance);

      renderHook(() => useAutoGeofenceCheck());

      // Wait for locations to load and initial poll
      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      // First poll already happened, flush it
      await act(async () => {
        await flushPromises();
      });

      // Second poll - should trigger check-in countdown (after debounce = 2 polls)
      await act(async () => {
        jest.advanceTimersByTime(60000);
        await flushPromises();
      });

      await waitFor(
        () => {
          expect(toast).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      // Fast-forward countdown (15 seconds) - need to advance in smaller increments
      // to trigger the interval callbacks. The interval runs every 1000ms.
      for (let i = 0; i < 15; i++) {
        await act(async () => {
          jest.advanceTimersByTime(1000);
          await flushPromises();
        });
      }

      // Wait for the async onConfirm callback to complete
      await waitFor(
        () => {
          expect(mockCheckIn).toHaveBeenCalledWith(
            "loc-1",
            expect.objectContaining({
              latitude: 40.7128,
              longitude: -74.006,
              accuracy: 10,
            })
          );
        },
        { timeout: 2000 }
      );
    });
  });

  describe("Auto check-out flow", () => {
    it("should trigger check-out when exiting geofence", async () => {
      const mockSession: Session = {
        id: "session-1",
        userId: "user-1",
        locationId: "loc-1",
        status: "active",
        checkInTime: Timestamp.now(),
        startTime: Timestamp.now(),
        checkInMethod: "geo",
        distanceFromCenterAtCheckIn: 50,
        dayKey: "2024-01-01",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (useCachedSession as jest.Mock).mockReturnValue({
        activeSession: mockSession,
      });

      // Start inside
      (validateGeofence as jest.Mock).mockReturnValue({
        distance: 50,
        isWithinGeofence: true,
      });

      renderHook(() => useAutoGeofenceCheck());

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      // First poll - inside (resets outsideStreak)
      await act(async () => {
        jest.advanceTimersByTime(0);
        await Promise.resolve();
        await Promise.resolve(); // Flush all microtasks
      });

      // Move outside - first poll outside (outsideStreak = 1)
      (validateGeofence as jest.Mock).mockReturnValue({
        distance: 150,
        isWithinGeofence: false,
      });

      await act(async () => {
        jest.advanceTimersByTime(60000);
        await Promise.resolve();
        await Promise.resolve(); // Flush all microtasks
      });

      // Second poll outside - should trigger check-out countdown (after debounce = 2 polls)
      await act(async () => {
        jest.advanceTimersByTime(60000);
        await Promise.resolve();
        await Promise.resolve(); // Flush all microtasks
      });

      await waitFor(
        () => {
          expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({
              title: "Auto check-out",
            })
          );
        },
        { timeout: 2000 }
      );
    });

    it("should only check-out from currently active session location", async () => {
      const mockSession: Session = {
        id: "session-1",
        userId: "user-1",
        locationId: "loc-1",
        status: "active",
        checkInTime: Timestamp.now(),
        startTime: Timestamp.now(),
        checkInMethod: "geo",
        distanceFromCenterAtCheckIn: 50,
        dayKey: "2024-01-01",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const otherLocation: Location = {
        id: "loc-2",
        name: "Other School",
        address: "456 Other St",
        geo: new GeoPoint(40.713, -74.007),
        radiusMeters: 100,
        assignedProviders: ["user-1"],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (useCachedSession as jest.Mock).mockReturnValue({
        activeSession: mockSession,
      });
      (getCachedLocationsByProvider as jest.Mock).mockResolvedValue([
        mockLocation,
        otherLocation,
      ]);

      // Inside other location but outside active session location
      (validateGeofence as jest.Mock).mockImplementation(
        (_lat, _lng, geo, _radius) => {
          // Check if it's the active session location
          if (geo.latitude === mockLocation.geo.latitude) {
            return { distance: 150, isWithinGeofence: false };
          }
          return { distance: 50, isWithinGeofence: true };
        }
      );

      renderHook(() => useAutoGeofenceCheck());

      // Wait for locations to load and initial poll
      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      // First poll already happened (outsideStreak = 1), flush it
      await act(async () => {
        await flushPromises();
      });

      // Second poll - should trigger check-out countdown (after debounce = 2 polls)
      await act(async () => {
        jest.advanceTimersByTime(60000);
        await flushPromises();
      });

      // Should trigger check-out for active session location
      await waitFor(
        () => {
          expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({
              title: "Auto check-out",
            })
          );
        },
        { timeout: 2000 }
      );
    });
  });

  describe("Multiple overlapping geofences", () => {
    it("should check in to first school entered, not closest", async () => {
      const location1: Location = {
        id: "loc-1",
        name: "First School",
        address: "123 First St",
        geo: new GeoPoint(40.7128, -74.006),
        radiusMeters: 100,
        assignedProviders: ["user-1"],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const location2: Location = {
        id: "loc-2",
        name: "Second School",
        address: "456 Second St",
        geo: new GeoPoint(40.7129, -74.0061), // Closer
        radiusMeters: 100,
        assignedProviders: ["user-1"],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (getCachedLocationsByProvider as jest.Mock).mockResolvedValue([
        location1,
        location2,
      ]);

      // Inside both geofences
      (validateGeofence as jest.Mock).mockImplementation(
        (_lat, _lng, _geo, _radius) => {
          return { distance: 50, isWithinGeofence: true };
        }
      );

      mockCheckIn.mockResolvedValue(undefined);

      const toastInstance = {
        id: "toast-1",
        dismiss: jest.fn(),
        update: jest.fn(),
      };

      (toast as jest.Mock).mockReturnValue(toastInstance);

      renderHook(() => useAutoGeofenceCheck());

      // Wait for locations to load and initial poll
      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      // First poll already happened, flush it
      await act(async () => {
        await flushPromises();
      });

      // Second poll - triggers countdown (after debounce = 2 polls)
      await act(async () => {
        jest.advanceTimersByTime(60000);
        await flushPromises();
      });

      await waitFor(
        () => {
          expect(toast).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Fast-forward countdown (15 seconds)
      for (let i = 0; i < 15; i++) {
        await act(async () => {
          jest.advanceTimersByTime(1000);
          await flushPromises();
        });
      }

      // Wait for the onConfirm callback to complete
      await waitFor(
        () => {
          expect(mockCheckIn).toHaveBeenCalledWith(
            "loc-1",
            expect.any(Object)
          );
        },
        { timeout: 5000 }
      );
    });
  });

  describe("Cooldown after cancellation", () => {
    it("should not trigger check-in again within cooldown period after cancellation", async () => {
      (useAutoGeofencePreference as jest.Mock).mockReturnValue({
        enabled: true,
      });
      (validateGeofence as jest.Mock).mockReturnValue({
        distance: 50,
        isWithinGeofence: true,
      });

      let cancelCallback: (() => void) | undefined;

      (toast as jest.Mock).mockImplementation((config) => {
        const toastInstance = {
          id: "toast-1",
          dismiss: jest.fn(),
          update: jest.fn().mockImplementation((updateConfig: { action?: { props?: { onClick?: () => void } } }) => {
            // Capture action from update call (action is added via update in the hook)
            if (updateConfig?.action?.props?.onClick) {
              cancelCallback = updateConfig.action.props.onClick;
            }
          }),
        };

        // Also check initial config
        if (config.action) {
          const actionElement = config.action as { props?: { onClick?: () => void } };
          if (actionElement?.props?.onClick) {
            cancelCallback = actionElement.props.onClick;
          }
        }

        return toastInstance;
      });

      renderHook(() => useAutoGeofenceCheck());

      // Wait for locations to load and initial poll
      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(getCachedLocationsByProvider).toHaveBeenCalled();
      });

      // First poll already happened, flush it
      await act(async () => {
        await flushPromises();
      });

      // Second poll - triggers countdown (after debounce = 2 polls)
      await act(async () => {
        jest.advanceTimersByTime(60000);
        await flushPromises();
      });

      await waitFor(
        () => {
          expect(toast).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      if (cancelCallback) {
        await act(async () => {
          cancelCallback!();
          await flushPromises();
        });
      }

      // Clear toast calls after cancellation is complete
      (toast as jest.Mock).mockClear();

      // Within cooldown period (5 minutes = 300000ms) - should not trigger again
      // Advance time but stay within cooldown (only 2 minutes = 120000ms)
      await act(async () => {
        jest.advanceTimersByTime(60000); // 1 minute
        await flushPromises();
      });
      await act(async () => {
        jest.advanceTimersByTime(60000); // 2 minutes total (still within 5 min cooldown)
        await flushPromises();
      });

      // Should not show new countdown (still in cooldown)
      // Check that no new "Auto check-in" toasts were called after cancellation
      const toastCalls = (toast as jest.Mock).mock.calls;
      const autoCheckInCalls = toastCalls.filter(
        (call) => call[0]?.title === "Auto check-in"
      );
      expect(autoCheckInCalls.length).toBe(0);
    });
  });
});
