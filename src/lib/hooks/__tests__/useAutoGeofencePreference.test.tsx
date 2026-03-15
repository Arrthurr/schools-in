import { renderHook, waitFor } from "@testing-library/react";
import { useAutoGeofencePreference } from "../useAutoGeofencePreference";

// Mock useCachedAuth with different user roles
const mockUseCachedAuth = jest.fn();
jest.mock("@/lib/hooks/useCachedAuth", () => ({
  useCachedAuth: () => mockUseCachedAuth(),
}));

// Mock Firestore
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  doc: jest.fn(() => ({ id: "mock-doc" })),
  updateDoc: jest.fn(),
}));
jest.mock("../../../../firebase.config", () => ({ db: {} }));

describe("useAutoGeofencePreference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Role-based auto geofence enablement", () => {
    it("defaults to disabled (manual mode) for providers with no stored preference", async () => {
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "user-1", role: "provider" },
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.enabled).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("reads stored true preference for providers", async () => {
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "user-1", role: "provider", autoGeofenceCheckEnabled: true },
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.enabled).toBe(true);
    });

    it("disables auto geofence for admin users regardless of stored preference", async () => {
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "admin-1", role: "admin", autoGeofenceCheckEnabled: true },
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.enabled).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("disables auto geofence when user is not authenticated", async () => {
      mockUseCachedAuth.mockReturnValue({
        user: null,
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.enabled).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("reflects loading state from auth hook", () => {
      mockUseCachedAuth.mockReturnValue({
        user: null,
        loading: true,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      expect(result.current.loading).toBe(true);
    });

    it("updates enabled state when user role changes from provider to admin", async () => {
      // Start as provider with auto enabled
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "user-1", role: "provider", autoGeofenceCheckEnabled: true },
        loading: false,
      });

      const { result, rerender } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.enabled).toBe(true);

      // Change to admin
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "user-1", role: "admin" },
        loading: false,
      });

      rerender();
      await waitFor(() => expect(result.current.enabled).toBe(false));
    });

    it("handles undefined role as disabled", async () => {
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "user-1" }, // No role specified
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.enabled).toBe(false);
    });
  });

  describe("Hook return value shape", () => {
    it("returns expected interface including setEnabled", async () => {
      mockUseCachedAuth.mockReturnValue({
        user: { uid: "user-1", role: "provider" },
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current).toMatchObject({
        enabled: false,
        loading: false,
        error: null,
      });
      expect(typeof result.current.setEnabled).toBe("function");
    });
  });
});
