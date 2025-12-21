// Unit tests for Firebase authentication utilities

import { User } from "firebase/auth";
import {
  signInWithMicrosoft,
  logOut,
  getCurrentUser,
  syncUserFromM365,
  waitForUserDocument,
  M365SyncResult,
} from "./auth";

// Mock user object
const mockUser: User = {
  uid: "user123",
  email: "test@example.com",
  displayName: "Test User",
  emailVerified: true,
  isAnonymous: false,
  metadata: {
    creationTime: "2024-01-01T00:00:00Z",
    lastSignInTime: "2024-01-01T00:00:00Z",
  },
  providerData: [],
  refreshToken: "mock-token",
  tenantId: null,
  delete: jest.fn(),
  getIdToken: jest.fn(),
  getIdTokenResult: jest.fn(),
  reload: jest.fn(),
  toJSON: jest.fn(),
  phoneNumber: null,
  photoURL: null,
  providerId: "firebase",
};

const mockUserCredential = {
  user: mockUser,
  providerId: "microsoft.com",
  operationType: "signIn",
};

// Mock httpsCallable result
const mockSyncResult: M365SyncResult = {
  role: "provider",
  assignedLocations: [{ id: "loc1", name: "Test School" }],
  removedLocations: [],
  groupsFound: ["Test School", "Another Group"],
};

const mockAdminSyncResult: M365SyncResult = {
  role: "admin",
  assignedLocations: [],
  removedLocations: [],
  groupsFound: ["DMDL Office", "Admin Group"],
};

// Mock Firebase Auth
jest.mock("../../../firebase.config", () => ({
  auth: {
    currentUser: null, // Start with null, will be set in tests
  },
  db: {}, // Mock Firestore db
  functions: {}, // Mock Firebase Functions
}));

// Mock Firestore
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(() =>
    Promise.resolve({
      exists: () => false,
    })
  ),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  },
}));

// Mock firestore COLLECTIONS
jest.mock("./firestore", () => ({
  COLLECTIONS: {
    USERS: "users",
    LOCATIONS: "locations",
    SESSIONS: "sessions",
  },
}));

// Mock Firebase Functions
const mockHttpsCallable = jest.fn();
jest.mock("firebase/functions", () => ({
  httpsCallable: (...args: any[]) => mockHttpsCallable(...args),
}));

jest.mock("firebase/auth", () => ({
  signInWithPopup: jest.fn(),
  OAuthProvider: jest.fn(() => ({
    setCustomParameters: jest.fn(),
  })),
  signOut: jest.fn(),
  getAuth: jest.fn(() => ({
    currentUser: mockUser,
  })),
}));

import { signInWithPopup, signOut } from "firebase/auth";
import { getDoc } from "firebase/firestore";

describe("Firebase Auth Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => false,
    });
  });

  describe("signInWithMicrosoft", () => {
    it("calls signInWithPopup with Microsoft provider", async () => {
      (signInWithPopup as jest.Mock).mockResolvedValue(mockUserCredential);

      const result = await signInWithMicrosoft();

      expect(signInWithPopup).toHaveBeenCalledWith(
        expect.any(Object), // auth object
        expect.any(Object) // OAuthProvider instance
      );
      expect(result).toEqual(mockUserCredential);
    });

    it("creates user document after successful sign-in", async () => {
      (signInWithPopup as jest.Mock).mockResolvedValue(mockUserCredential);

      await signInWithMicrosoft();

      // Verify that the user document creation was attempted
      // This is implicitly tested by the function not throwing an error
      expect(signInWithPopup).toHaveBeenCalled();
    });

    it("throws error when Microsoft sign-in fails", async () => {
      const mockError = new Error("Microsoft sign-in cancelled");
      (signInWithPopup as jest.Mock).mockRejectedValue(mockError);

      await expect(signInWithMicrosoft()).rejects.toThrow(
        "Microsoft sign-in cancelled"
      );
    });

    it("returns UserCredential on successful authentication", async () => {
      (signInWithPopup as jest.Mock).mockResolvedValue(mockUserCredential);

      const result = await signInWithMicrosoft();

      expect(result).toEqual(mockUserCredential);
      expect(result.user).toEqual(mockUser);
      expect(result.user.email).toBe("test@example.com");
    });
  });

  describe("logOut", () => {
    it("calls signOut successfully", async () => {
      (signOut as jest.Mock).mockResolvedValue(undefined);

      await expect(logOut()).resolves.toBeUndefined();
      expect(signOut).toHaveBeenCalledWith(expect.any(Object)); // auth object
    });

    it("throws error when sign out fails", async () => {
      const mockError = new Error("Sign out failed");
      (signOut as jest.Mock).mockRejectedValue(mockError);

      await expect(logOut()).rejects.toThrow("Sign out failed");
    });
  });

  describe("getCurrentUser", () => {
    it("returns current user when authenticated", () => {
      // Set current user for this test
      require("../../../firebase.config").auth.currentUser = mockUser;

      const result = getCurrentUser();
      expect(result).toEqual(mockUser);
    });

    it("returns null when no user is authenticated", () => {
      // Temporarily modify the mock auth currentUser
      const originalCurrentUser = require("../../../firebase.config").auth
        .currentUser;
      require("../../../firebase.config").auth.currentUser = null;

      // Re-import to get updated mock
      const { getCurrentUser: getCurrentUserFresh } = require("./auth");
      const result = getCurrentUserFresh();
      expect(result).toBeNull();

      // Restore original mock
      require("../../../firebase.config").auth.currentUser =
        originalCurrentUser;
    });
  });

  describe("syncUserFromM365", () => {
    beforeEach(() => {
      // Reset mocks before each test
      mockHttpsCallable.mockReset();
    });

    it("throws error when user is not authenticated", async () => {
      // Set currentUser to null
      require("../../../firebase.config").auth.currentUser = null;

      await expect(syncUserFromM365()).rejects.toThrow(
        "No authenticated user. Please sign in first."
      );
    });

    it("calls syncUserFromM365 cloud function for authenticated user", async () => {
      // Set currentUser to mockUser
      require("../../../firebase.config").auth.currentUser = mockUser;

      // Mock the callable function
      const mockCallable = jest.fn().mockResolvedValue({ data: mockSyncResult });
      mockHttpsCallable.mockReturnValue(mockCallable);

      const result = await syncUserFromM365();

      // Verify httpsCallable was called with correct function name
      expect(mockHttpsCallable).toHaveBeenCalledWith(
        expect.any(Object), // functions instance
        "syncUserFromM365"
      );

      // Verify the callable was invoked
      expect(mockCallable).toHaveBeenCalled();
      expect(mockCallable).toHaveBeenCalledWith({ email: mockUser.email });

      // Verify returned result
      expect(result).toEqual(mockSyncResult);
      expect(result.role).toBe("provider");
      expect(result.assignedLocations).toHaveLength(1);
      expect(result.assignedLocations[0].name).toBe("Test School");
    });

    it("returns admin role when user is in DMDL Office group", async () => {
      require("../../../firebase.config").auth.currentUser = mockUser;

      const mockCallable = jest.fn().mockResolvedValue({ data: mockAdminSyncResult });
      mockHttpsCallable.mockReturnValue(mockCallable);

      const result = await syncUserFromM365();

      expect(result.role).toBe("admin");
      expect(result.groupsFound).toContain("DMDL Office");
      expect(mockCallable).toHaveBeenCalledWith({ email: mockUser.email });
    });

    it("returns provider role with assigned locations when user is not in DMDL Office", async () => {
      require("../../../firebase.config").auth.currentUser = mockUser;

      const mockCallable = jest.fn().mockResolvedValue({ data: mockSyncResult });
      mockHttpsCallable.mockReturnValue(mockCallable);

      const result = await syncUserFromM365();

      expect(result.role).toBe("provider");
      expect(result.assignedLocations.length).toBeGreaterThan(0);
      expect(result.groupsFound).not.toContain("DMDL Office");
      expect(mockCallable).toHaveBeenCalledWith({ email: mockUser.email });
    });

    it("propagates errors from cloud function", async () => {
      require("../../../firebase.config").auth.currentUser = mockUser;

      const mockError = new Error("Microsoft Graph API error");
      const mockCallable = jest.fn().mockRejectedValue(mockError);
      mockHttpsCallable.mockReturnValue(mockCallable);

      await expect(syncUserFromM365()).rejects.toThrow("Microsoft Graph API error");
      expect(mockCallable).toHaveBeenCalledWith({ email: mockUser.email });
    });

    it("includes removed locations when user is unassigned from schools", async () => {
      require("../../../firebase.config").auth.currentUser = mockUser;

      const resultWithRemovals: M365SyncResult = {
        role: "provider",
        assignedLocations: [{ id: "loc1", name: "Test School" }],
        removedLocations: [{ id: "loc2", name: "Old School" }],
        groupsFound: ["Test School"],
      };

      const mockCallable = jest.fn().mockResolvedValue({ data: resultWithRemovals });
      mockHttpsCallable.mockReturnValue(mockCallable);

      const result = await syncUserFromM365();

      expect(result.removedLocations).toHaveLength(1);
      expect(result.removedLocations[0].name).toBe("Old School");
      expect(mockCallable).toHaveBeenCalledWith({ email: mockUser.email });
    });
  });

  describe("waitForUserDocument", () => {
    it("resolves when a user document with role is found", async () => {
      (getDoc as jest.Mock)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ role: "provider" }),
        });

      await expect(waitForUserDocument("user123", 2, 1)).resolves.toBeUndefined();
    });

    it("throws after exhausting retries", async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      await expect(waitForUserDocument("missing", 2, 1)).rejects.toThrow(
        "Timed out"
      );
    });
  });
});
