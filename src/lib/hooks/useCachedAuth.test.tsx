import { renderHook, act } from "@testing-library/react";
import { useCachedAuth } from "./useCachedAuth";

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

jest.mock("@/lib/firebase/cachedFirestore", () => ({
  getCachedDocument: jest.fn().mockResolvedValue({ role: "provider" }),
}));

jest.mock("@/lib/firebase/authBypass", () => ({
  isAuthBypassEnabled: jest.fn(),
  createMockAuthState: jest.fn(),
}));

describe("useCachedAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    const { isAuthBypassEnabled } = require("@/lib/firebase/authBypass");
    isAuthBypassEnabled.mockReturnValue(false);

    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback({
        uid: "provider-1",
        displayName: "Provider",
        photoURL: null,
        phoneNumber: null,
      });
      return jest.fn();
    });

    const { result } = renderHook(() => useCachedAuth());

    await act(async () => {});

    expect(result.current.user?.uid).toBe("provider-1");
    expect(result.current.user?.role).toBe("provider");
    expect(result.current.loading).toBe(false);
    expect(result.current.isProvider).toBe(true);
  });

  it("handles sign-out by clearing user", async () => {
    const { isAuthBypassEnabled } = require("@/lib/firebase/authBypass");
    isAuthBypassEnabled.mockReturnValue(false);

    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null);
      return jest.fn();
    });

    const { result } = renderHook(() => useCachedAuth());

    await act(async () => {});

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });
});
