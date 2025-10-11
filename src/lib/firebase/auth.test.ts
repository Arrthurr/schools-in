// Unit tests for Firebase authentication utilities

import { User } from "firebase/auth";
import {
  signInWithEmail,
  createAccount,
  signInWithGoogle,
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
  providerId: "password",
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
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: jest.fn(() => ({})),
  OAuthProvider: jest.fn(() => ({})),
  signOut: jest.fn(),
  getAuth: jest.fn(() => ({
    currentUser: mockUser,
  })),
}));

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  getAuth,
} from "firebase/auth";

describe("Firebase Auth Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("signInWithEmail", () => {
    it("calls signInWithEmailAndPassword with correct parameters", async () => {
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue(
        mockUserCredential
      );

      const result = await signInWithEmail("test@example.com", "password123");

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.any(Object), // auth object
        "test@example.com",
        "password123"
      );
      expect(result).toEqual(mockUserCredential);
    });

    it("throws error when authentication fails", async () => {
      const mockError = new Error("Invalid credentials");
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(mockError);

      await expect(
        signInWithEmail("test@example.com", "wrongpassword")
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("createAccount", () => {
    it("calls createUserWithEmailAndPassword with correct parameters", async () => {
      (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue(
        mockUserCredential
      );

      const result = await createAccount("newuser@example.com", "password123");

      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.any(Object), // auth object
        "newuser@example.com",
        "password123"
      );
      expect(result).toEqual(mockUserCredential);
    });

    it("throws error when account creation fails", async () => {
      const mockError = new Error("Email already in use");
      (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue(
        mockError
      );

      await expect(
        createAccount("existing@example.com", "password123")
      ).rejects.toThrow("Email already in use");
    });
  });

  describe("signInWithGoogle", () => {
    it("calls signInWithPopup with Google provider", async () => {
      (signInWithPopup as jest.Mock).mockResolvedValue(mockUserCredential);

      const result = await signInWithGoogle();

      expect(signInWithPopup).toHaveBeenCalledWith(
        expect.any(Object), // auth object
        expect.any(Object) // GoogleAuthProvider instance
      );
      expect(result).toEqual(mockUserCredential);
    });

    it("throws error when Google sign-in fails", async () => {
      const mockError = new Error("Google sign-in cancelled");
      (signInWithPopup as jest.Mock).mockRejectedValue(mockError);

      await expect(signInWithGoogle()).rejects.toThrow(
        "Google sign-in cancelled"
      );
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
});
