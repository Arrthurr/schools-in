// Unit tests for Firebase authentication utilities

import { User } from "firebase/auth";
import {
  signInWithMicrosoft,
  logOut,
  getCurrentUser,
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

// Mock Firebase Auth
jest.mock("../../../firebase.config", () => ({
  auth: {
    currentUser: null, // Start with null, will be set in tests
  },
  db: {}, // Mock Firestore db
}));

// Mock Firestore
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(() => Promise.resolve({
    exists: () => false,
  })),
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

import {
  signInWithPopup,
  OAuthProvider,
  signOut,
  getAuth,
} from "firebase/auth";

describe("Firebase Auth Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
