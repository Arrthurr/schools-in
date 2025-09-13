// Unit tests for UserProfile component

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UserProfile } from "./UserProfile";
import { useAuth } from "../../lib/hooks/useAuth";

// Mock the useAuth hook
jest.mock("../../lib/hooks/useAuth", () => ({
  useAuth: jest.fn(),
}));

// Mock Firebase auth
jest.mock("firebase/auth", () => ({
  updateProfile: jest.fn(),
}));

jest.mock("../../../firebase.config", () => ({
  auth: {
    currentUser: null,
  },
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUpdateProfile = require("firebase/auth")
  .updateProfile as jest.MockedFunction<any>;

describe("UserProfile", () => {
  const mockUser = {
    uid: "user123",
    email: "test@example.com",
    displayName: "Test User",
    role: "provider" as const,
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders user profile information correctly", () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    render(<UserProfile />);

    expect(screen.getByText("User Profile")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("provider")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
  });

  it("displays loading state when user data is loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    });

    render(<UserProfile />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays loading when no user is authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    render(<UserProfile />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("updates profile successfully", async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    // Mock Firebase auth currentUser
    const mockAuth = require("../../../firebase.config").auth;
    mockAuth.currentUser = mockUser;

    mockUpdateProfile.mockResolvedValue(undefined);

    render(<UserProfile />);

    const input = screen.getByDisplayValue("Test User");
    const submitButton = screen.getByRole("button", {
      name: /update profile/i,
    });

    fireEvent.change(input, { target: { value: "Updated Name" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, {
        displayName: "Updated Name",
      });
    });
  });

  it("shows validation error for short display name", async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    render(<UserProfile />);

    const input = screen.getByDisplayValue("Test User");
    const submitButton = screen.getByRole("button", {
      name: /update profile/i,
    });

    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Display name must be at least 2 characters.")
      ).toBeInTheDocument();
    });
  });

  it("shows success message after successful update", async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    // Mock Firebase updateProfile
    const mockUpdateProfile = jest.fn().mockResolvedValue(undefined);
    jest.mock("firebase/auth", () => ({
      updateProfile: mockUpdateProfile,
    }));

    render(<UserProfile />);

    const input = screen.getByDisplayValue("Test User");
    const submitButton = screen.getByRole("button", {
      name: /update profile/i,
    });

    fireEvent.change(input, { target: { value: "Updated Name" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Profile updated successfully!")
      ).toBeInTheDocument();
    });
  });
});
