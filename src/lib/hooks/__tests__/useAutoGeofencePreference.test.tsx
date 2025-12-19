import { renderHook } from "@testing-library/react";
import { useAutoGeofencePreference } from "../useAutoGeofencePreference";

// Mock useCachedAuth with different user roles
const mockUseCachedAuth = jest.fn();
jest.mock("@/lib/hooks/useCachedAuth", () => ({
  useCachedAuth: () => mockUseCachedAuth(),
}));

describe("useAutoGeofencePreference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Role-based auto geofence enablement", () => {
    it("should enable auto geofence for provider users", () => {
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "user-1", role: "provider" },
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      expect(result.current.enabled).toBe(true);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should disable auto geofence for admin users", () => {
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "admin-1", role: "admin" },
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      expect(result.current.enabled).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should disable auto geofence when user is not authenticated", () => {
      mockUseCachedAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      expect(result.current.enabled).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should reflect loading state from auth hook", () => {
      mockUseCachedAuth.mockReturnValue({
        user: null,
        loading: true,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      expect(result.current.loading).toBe(true);
    });

    it("should update enabled state when user role changes", () => {
      // Start as provider
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "user-1", role: "provider" },
        loading: false,
      });

      const { result, rerender } = renderHook(() => useAutoGeofencePreference());
      expect(result.current.enabled).toBe(true);

      // Change to admin
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "user-1", role: "admin" },
        loading: false,
      });

      rerender();
      expect(result.current.enabled).toBe(false);
    });

    it("should handle undefined role as disabled", () => {
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "user-1" }, // No role specified
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      expect(result.current.enabled).toBe(false);
    });
  });

  describe("Hook return value shape", () => {
    it("should return expected interface shape", () => {
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "user-1", role: "provider" },
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      expect(result.current).toEqual({
        enabled: true,
        loading: false,
        error: null,
      });
    });

    it("should not have setEnabled method (role-based, not configurable)", () => {
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "user-1", role: "provider" },
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      expect(result.current).not.toHaveProperty("setEnabled");
    });
  });
});
