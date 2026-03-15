import { renderHook, act, waitFor } from "@testing-library/react";
import { useCachedAuth, useUserPreferences } from "./useCachedAuth";

const mockOnAuthStateChanged = jest.fn();

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
}));

jest.mock("../../../firebase.config", () => ({
  auth: {},
}));

jest.mock("@/lib/cache/CacheManager", () => ({
  cacheManager: {
    getMultiLayer: jest.fn().mockResolvedValue(null),
    setMultiLayer: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/lib/cache/FirebaseCache", () => ({
  FIREBASE_CACHE_CONFIGS: {
    AUTH: { memory: "auth-memory", session: "auth-session" },
    USER: { memory: "user-memory" },
  },
}));

const mockGetCachedDocument = jest.fn().mockResolvedValue({ role: "provider" });

jest.mock("@/lib/firebase/cachedFirestore", () => ({
  getCachedDocument: (...args: any[]) => mockGetCachedDocument(...args),
  getCachedLocationsByProvider: jest.fn().mockResolvedValue([]),
  getCachedUserSessions: jest.fn().mockResolvedValue([]),
  getCachedActiveSessions: jest.fn().mockResolvedValue([]),
  getCachedCollection: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/firebase/firestore", () => ({
  COLLECTIONS: {
    USERS: "users",
    SESSIONS: "sessions",
    LOCATIONS: "locations",
  },
  updateDocument: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/firebase/authBypass", () => ({
  isAuthBypassEnabled: jest.fn(),
  createMockAuthState: jest.fn(),
}));

// Helper to get the mocked cacheManager
function getCacheManager() {
  return require("@/lib/cache/CacheManager").cacheManager;
}

// Helper to create a mock firebase user
function createMockFirebaseUser(overrides: Record<string, any> = {}) {
  return {
    uid: "user-1",
    displayName: "Test User",
    photoURL: null,
    phoneNumber: null,
    email: "test@test.com",
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: "",
    tenantId: null,
    delete: jest.fn(),
    getIdToken: jest.fn(),
    getIdTokenResult: jest.fn(),
    reload: jest.fn(),
    toJSON: jest.fn(),
    providerId: "firebase",
    ...overrides,
  };
}

describe("useCachedAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { isAuthBypassEnabled } = require("@/lib/firebase/authBypass");
    isAuthBypassEnabled.mockReturnValue(false);
  });

  it("returns mock auth state when bypass is enabled", async () => {
    const { isAuthBypassEnabled, createMockAuthState } = require("@/lib/firebase/authBypass");
    isAuthBypassEnabled.mockReturnValue(true);
    createMockAuthState.mockReturnValue({
      user: { uid: "test-admin-123", role: "admin" },
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useCachedAuth());

    expect(result.current.user?.uid).toBe("test-admin-123");
    expect(result.current.loading).toBe(false);
    expect(result.current.isAdmin).toBe(true);
  });

  it("subscribes to auth state and sets provider role from Firestore", async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(createMockFirebaseUser({ uid: "provider-1", displayName: "Provider" }));
      return jest.fn();
    });

    const { result } = renderHook(() => useCachedAuth());
    await act(async () => {});

    expect(result.current.user?.uid).toBe("provider-1");
    expect(result.current.user?.role).toBe("provider");
    expect(result.current.loading).toBe(false);
    expect(result.current.isProvider).toBe(true);
  });

  it("handles sign-out by clearing user and cache", async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null);
      return jest.fn();
    });

    const { result } = renderHook(() => useCachedAuth());
    await act(async () => {});

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(getCacheManager().clear).toHaveBeenCalledWith("auth-memory");
    expect(getCacheManager().clear).toHaveBeenCalledWith("auth-session");
  });

  it("sets admin role and pre-warms admin cache", async () => {
    mockGetCachedDocument.mockResolvedValue({ role: "admin" });
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(createMockFirebaseUser({ uid: "admin-1" }));
      return jest.fn();
    });

    const { result } = renderHook(() => useCachedAuth());
    await act(async () => {});

    expect(result.current.user?.role).toBe("admin");
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isProvider).toBe(false);
  });

  it("uses cached user data from multi-layer cache when available", async () => {
    getCacheManager().getMultiLayer.mockResolvedValueOnce({
      role: "admin",
      autoGeofenceCheckEnabled: true,
      profile: { displayName: "Cached Admin" },
    });

    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(createMockFirebaseUser({ uid: "cached-user" }));
      return jest.fn();
    });

    const { result } = renderHook(() => useCachedAuth());
    await act(async () => {});

    expect(result.current.user?.role).toBe("admin");
    expect(result.current.user?.autoGeofenceCheckEnabled).toBe(true);
    // Should NOT have called Firestore since cache hit
    expect(mockGetCachedDocument).not.toHaveBeenCalled();
  });

  it("caches user data after fetching from Firestore", async () => {
    mockGetCachedDocument.mockResolvedValue({
      role: "provider",
      autoGeofenceCheckEnabled: false,
    });

    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(createMockFirebaseUser({ uid: "new-user" }));
      return jest.fn();
    });

    const { result } = renderHook(() => useCachedAuth());
    await act(async () => {});

    expect(getCacheManager().setMultiLayer).toHaveBeenCalledWith(
      "auth_user_new-user",
      expect.objectContaining({ role: "provider" }),
      ["auth-memory", "auth-session"]
    );
  });

  it("handles auth state change error gracefully", async () => {
    mockGetCachedDocument.mockRejectedValue(new Error("Network failure"));

    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(createMockFirebaseUser({ uid: "error-user" }));
      return jest.fn();
    });

    const { result } = renderHook(() => useCachedAuth());
    await act(async () => {});

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("Network failure");
  });

  it("handles non-Error thrown in auth state change", async () => {
    mockGetCachedDocument.mockRejectedValue("string error");

    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(createMockFirebaseUser());
      return jest.fn();
    });

    const { result } = renderHook(() => useCachedAuth());
    await act(async () => {});

    expect(result.current.error).toBe("Authentication error");
  });

  it("restores auth state from cache on mount", async () => {
    getCacheManager().get.mockResolvedValueOnce({
      user: { uid: "cached-uid", role: "provider" },
      loading: false,
      error: null,
    });

    // Don't fire onAuthStateChanged callback immediately
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());

    const { result } = renderHook(() => useCachedAuth());
    await act(async () => {});

    // Cached state should be restored with loading: true
    expect(result.current.user?.uid).toBe("cached-uid");
    expect(result.current.loading).toBe(true);
  });

  it("unsubscribes from auth on unmount", async () => {
    const mockUnsubscribe = jest.fn();
    mockOnAuthStateChanged.mockImplementation(() => mockUnsubscribe);

    const { unmount } = renderHook(() => useCachedAuth());
    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("uses fallback profile from firebase user when userData has no profile", async () => {
    mockGetCachedDocument.mockResolvedValue({ role: "provider" });

    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(
        createMockFirebaseUser({
          uid: "profile-user",
          displayName: "FB Name",
          photoURL: "http://photo.url",
          phoneNumber: "+1234567890",
        })
      );
      return jest.fn();
    });

    const { result } = renderHook(() => useCachedAuth());
    await act(async () => {});

    expect(result.current.user?.profile).toEqual({
      displayName: "FB Name",
      photoURL: "http://photo.url",
      phoneNumber: "+1234567890",
    });
  });

  describe("refreshUser", () => {
    it("refreshes user data from Firestore and updates cache", async () => {
      mockGetCachedDocument.mockResolvedValue({ role: "provider" });

      mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        callback(createMockFirebaseUser({ uid: "refresh-user" }));
        return jest.fn();
      });

      const { result } = renderHook(() => useCachedAuth());
      await act(async () => {});

      // Now change what Firestore returns and call refreshUser
      mockGetCachedDocument.mockResolvedValue({
        role: "admin",
        autoGeofenceCheckEnabled: true,
        profile: { displayName: "Updated" },
      });

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user?.role).toBe("admin");
      expect(result.current.user?.autoGeofenceCheckEnabled).toBe(true);
      expect(getCacheManager().setMultiLayer).toHaveBeenCalledWith(
        "auth_user_refresh-user",
        expect.objectContaining({ role: "admin" }),
        ["auth-memory", "auth-session"]
      );
    });

    it("does nothing when no user is logged in", async () => {
      mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        callback(null);
        return jest.fn();
      });

      const { result } = renderHook(() => useCachedAuth());
      await act(async () => {});

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user).toBeNull();
    });

    it("handles refresh errors gracefully", async () => {
      mockGetCachedDocument.mockResolvedValue({ role: "provider" });

      mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        callback(createMockFirebaseUser({ uid: "error-refresh" }));
        return jest.fn();
      });

      const { result } = renderHook(() => useCachedAuth());
      await act(async () => {});

      // Make refresh fail
      mockGetCachedDocument.mockRejectedValue(new Error("Refresh failed"));

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.error).toBe("Refresh failed");
      expect(result.current.loading).toBe(false);
    });
  });

  describe("getCachedDocumentWithRetry", () => {
    it("retries on permission-denied errors with exponential backoff", async () => {
      // First two calls: permission denied. Third call: success.
      mockGetCachedDocument
        .mockRejectedValueOnce({ code: "permission-denied", message: "Permission denied" })
        .mockRejectedValueOnce({ code: "permission-denied", message: "Permission denied" })
        .mockResolvedValueOnce({ role: "admin" });

      mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        callback(createMockFirebaseUser({ uid: "retry-user" }));
        return jest.fn();
      });

      const { result } = renderHook(() => useCachedAuth());
      await act(async () => {
        // Allow retries to resolve
        await new Promise((r) => setTimeout(r, 500));
      });

      expect(result.current.user?.role).toBe("admin");
      expect(mockGetCachedDocument).toHaveBeenCalledTimes(3);
      // Second+ calls should have forceRefresh: true
      expect(mockGetCachedDocument).toHaveBeenNthCalledWith(2, "users", "retry-user", { forceRefresh: true });
    });

    it("returns null after exhausting all retries", async () => {
      const permError = { code: "permission-denied", message: "Permission denied" };
      mockGetCachedDocument.mockRejectedValue(permError);

      mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        callback(createMockFirebaseUser({ uid: "max-retry" }));
        return jest.fn();
      });

      const { result } = renderHook(() => useCachedAuth());
      await act(async () => {
        await new Promise((r) => setTimeout(r, 2000));
      });

      // User should still be set but without role (null userData)
      expect(result.current.user?.uid).toBe("max-retry");
      expect(result.current.user?.role).toBeUndefined();
      expect(result.current.loading).toBe(false);
    }, 10000);

    it("throws non-permission errors immediately without retrying", async () => {
      mockGetCachedDocument.mockRejectedValue(new Error("Network failure"));

      mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        callback(createMockFirebaseUser({ uid: "network-err" }));
        return jest.fn();
      });

      const { result } = renderHook(() => useCachedAuth());
      await act(async () => {});

      expect(result.current.error).toBe("Network failure");
      // Should only have been called once — no retries
      expect(mockGetCachedDocument).toHaveBeenCalledTimes(1);
    });
  });
});

describe("useUserPreferences", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { isAuthBypassEnabled } = require("@/lib/firebase/authBypass");
    isAuthBypassEnabled.mockReturnValue(false);
    getCacheManager().get.mockResolvedValue(null);
  });

  it("loads preferences for authenticated user", async () => {
    mockGetCachedDocument.mockResolvedValue({
      role: "provider",
      preferences: { theme: "dark", notifications: true },
    });

    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(createMockFirebaseUser({ uid: "pref-user" }));
      return jest.fn();
    });

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(() => {
      expect(result.current.preferences).toEqual({ theme: "dark", notifications: true });
    });
  });

  it("returns null preferences when no user", async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null);
      return jest.fn();
    });

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.preferences).toBeNull();
  });

  it("uses cached preferences when available", async () => {
    // cacheManager.get is called for:
    // 1. restoreAuthStateFromCache -> null
    // 2. loadUserPreferences -> cache hit
    getCacheManager().get.mockImplementation((key: string) => {
      if (key.startsWith("user_prefs_")) return Promise.resolve({ theme: "light" });
      return Promise.resolve(null);
    });

    mockGetCachedDocument.mockResolvedValue({ role: "provider" });
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(createMockFirebaseUser({ uid: "cached-pref" }));
      return jest.fn();
    });

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(() => {
      expect(result.current.preferences).toEqual({ theme: "light" });
    });
  });

  it("updates preferences optimistically and persists", async () => {
    // loadUserPreferences will call getCachedDocument -> extract .preferences
    // useCachedAuth also calls getCachedDocument for user role
    // Use a consistent return for all calls
    mockGetCachedDocument.mockResolvedValue({
      role: "provider",
      preferences: { theme: "dark" },
    });

    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(createMockFirebaseUser({ uid: "update-pref" }));
      return jest.fn();
    });

    const { result } = renderHook(() => useUserPreferences());

    // Wait for both auth and preferences to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.preferences).toEqual({ theme: "dark" });
    });

    await act(async () => {
      await result.current.updatePreferences({ notifications: false });
    });

    expect(result.current.preferences).toEqual({ theme: "dark", notifications: false });
    expect(getCacheManager().set).toHaveBeenCalledWith(
      "user_prefs_update-pref",
      expect.objectContaining({ theme: "dark", notifications: false }),
      "user-memory"
    );
  });

  it("reverts optimistic update on error", async () => {
    mockGetCachedDocument.mockResolvedValue({
      role: "provider",
      preferences: { theme: "dark" },
    });

    const { updateDocument } = require("@/lib/firebase/firestore");
    updateDocument.mockRejectedValue(new Error("Write failed"));

    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(createMockFirebaseUser({ uid: "revert-pref" }));
      return jest.fn();
    });

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.preferences).toEqual({ theme: "dark" });
    });

    await expect(
      act(async () => {
        await result.current.updatePreferences({ theme: "light" });
      })
    ).rejects.toThrow("Write failed");

    // Should revert to original
    expect(result.current.preferences).toEqual({ theme: "dark" });
  });

  it("does nothing on updatePreferences when no user", async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null);
      return jest.fn();
    });

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updatePreferences({ theme: "light" });
    });

    expect(result.current.preferences).toBeNull();
  });
});
