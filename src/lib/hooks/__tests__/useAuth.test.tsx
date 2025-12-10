import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "../useAuth";
import { onAuthStateChanged } from "firebase/auth";
import { getDocument } from "@/lib/firebase/firestore";
import { isAuthBypassEnabled, createMockAuthState } from "@/lib/firebase/authBypass";

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn(),
}));

jest.mock("../../../../firebase.config", () => ({
  auth: {},
}));

jest.mock("@/lib/firebase/firestore", () => ({
  getDocument: jest.fn(),
  COLLECTIONS: { USERS: "users" },
}));

jest.mock("@/lib/firebase/authBypass", () => ({
  isAuthBypassEnabled: jest.fn(),
  createMockAuthState: jest.fn(),
}));

describe("useAuth", () => {
  const mockUnsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUnsubscribe.mockClear();
  });

  it("uses auth bypass when enabled", () => {
    (isAuthBypassEnabled as jest.Mock).mockReturnValue(true);
    (createMockAuthState as jest.Mock).mockReturnValue({
      user: { uid: "bypass-123", role: "provider" },
      loading: false,
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(false);
    expect(result.current.user?.uid).toBe("bypass-123");
    expect(result.current.user?.role).toBe("provider");
  });

  it("subscribes to Firebase auth and sets user role", async () => {
    (isAuthBypassEnabled as jest.Mock).mockReturnValue(false);
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback({ uid: "firebase-123", email: "user@test.com" } as any);
      return mockUnsubscribe;
    });
    (getDocument as jest.Mock).mockResolvedValue({ role: "admin" });

    const { result, unmount } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.uid).toBe("firebase-123");
    expect(result.current.user?.role).toBe("admin");

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("handles signed-out state", async () => {
    (isAuthBypassEnabled as jest.Mock).mockReturnValue(false);
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(null);
      return mockUnsubscribe;
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });
});
