/**
 * Tests for useAutoGeofencePreference hook
 * Verifies Firestore-backed preference persistence and toggle behavior
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAutoGeofencePreference } from "./useAutoGeofencePreference";
import * as useCachedAuthModule from "@/lib/hooks/useCachedAuth";
import { updateDoc } from "firebase/firestore";

jest.mock("@/lib/hooks/useCachedAuth");
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  doc: jest.fn(() => ({ id: "mock-doc-ref" })),
  updateDoc: jest.fn(),
}));
jest.mock("../../../firebase.config", () => ({ db: {} }));

const mockUseCachedAuth = useCachedAuthModule.useCachedAuth as jest.Mock;
const mockUpdateDoc = updateDoc as jest.Mock;

const makeProviderUser = (autoGeofenceCheckEnabled?: boolean) => ({
  uid: "provider-1",
  email: "provider@test.com",
  displayName: "Test Provider",
  role: "provider" as const,
  autoGeofenceCheckEnabled,
});

const makeAdminUser = () => ({
  uid: "admin-1",
  email: "admin@test.com",
  displayName: "Test Admin",
  role: "admin" as const,
});

describe("useAutoGeofencePreference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe("initial state", () => {
    it("defaults to disabled for providers with no stored preference", async () => {
      mockUseCachedAuth.mockReturnValue({
        user: makeProviderUser(undefined),
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.enabled).toBe(false);
    });

    it("reads stored true preference for providers", async () => {
      mockUseCachedAuth.mockReturnValue({
        user: makeProviderUser(true),
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.enabled).toBe(true);
    });

    it("reads stored false preference for providers", async () => {
      mockUseCachedAuth.mockReturnValue({
        user: makeProviderUser(false),
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.enabled).toBe(false);
    });

    it("is always disabled for admins regardless of stored preference", async () => {
      mockUseCachedAuth.mockReturnValue({
        user: makeAdminUser(),
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.enabled).toBe(false);
    });

    it("is disabled while auth is loading", () => {
      mockUseCachedAuth.mockReturnValue({ user: null, loading: true });

      const { result } = renderHook(() => useAutoGeofencePreference());

      expect(result.current.enabled).toBe(false);
    });

    it("returns null error initially", async () => {
      mockUseCachedAuth.mockReturnValue({
        user: makeProviderUser(false),
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeNull();
    });
  });

  describe("setEnabled toggle", () => {
    it("enables auto check-in and writes to Firestore", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      mockUseCachedAuth.mockReturnValue({
        user: makeProviderUser(false),
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.setEnabled(true);
      });

      expect(result.current.enabled).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { autoGeofenceCheckEnabled: true }
      );
    });

    it("disables auto check-in and writes to Firestore", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      mockUseCachedAuth.mockReturnValue({
        user: makeProviderUser(true),
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.setEnabled(false);
      });

      expect(result.current.enabled).toBe(false);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { autoGeofenceCheckEnabled: false }
      );
    });

    it("reverts optimistic update when Firestore write fails", async () => {
      mockUpdateDoc.mockRejectedValue(new Error("Permission denied"));
      mockUseCachedAuth.mockReturnValue({
        user: makeProviderUser(false),
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.setEnabled(true);
      });

      // Should revert to original value
      expect(result.current.enabled).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    it("does nothing for admins when setEnabled is called", async () => {
      mockUseCachedAuth.mockReturnValue({
        user: makeAdminUser(),
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.setEnabled(true);
      });

      // Admin should remain disabled and Firestore should not be called
      expect(result.current.enabled).toBe(false);
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("applies optimistic update immediately before Firestore resolves", async () => {
      let resolveUpdateDoc!: () => void;
      mockUpdateDoc.mockReturnValue(
        new Promise<void>((res) => {
          resolveUpdateDoc = res;
        })
      );

      mockUseCachedAuth.mockReturnValue({
        user: makeProviderUser(false),
        loading: false,
      });

      const { result } = renderHook(() => useAutoGeofencePreference());

      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setEnabled(true);
      });

      // Optimistically updated before Firestore resolves
      expect(result.current.enabled).toBe(true);

      resolveUpdateDoc();
    });
  });
});
