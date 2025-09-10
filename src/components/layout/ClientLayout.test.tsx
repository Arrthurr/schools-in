// Unit tests for ClientLayout component

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import ClientLayout from "./ClientLayout";
import { useAuth } from "../../lib/hooks/useAuth";
import { logOut } from "../../lib/firebase/auth";

// Mock the hooks and components
jest.mock("../../lib/hooks/useAuth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("../../lib/firebase/auth", () => ({
  logOut: jest.fn(),
}));

jest.mock("../pwa/PWAInstallPrompt", () => ({
  PWAInstallPrompt: () => (
    <div data-testid="pwa-install-prompt">PWA Install Prompt</div>
  ),
}));

jest.mock("../pwa/PWAUpdatePrompt", () => ({
  PWAUpdatePrompt: () => (
    <div data-testid="pwa-update-prompt">PWA Update Prompt</div>
  ),
}));

jest.mock("../pwa/PWAStatus", () => ({
  PWAStatus: () => <div data-testid="pwa-status">PWA Status</div>,
}));

jest.mock("../offline/OfflineMessaging", () => ({
  OfflineMessagingProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="offline-provider">{children}</div>
  ),
}));

jest.mock("../offline/OfflineStatusBar", () => ({
  OfflineStatusBar: ({
    variant,
    position,
  }: {
    variant: string;
    position: string;
  }) => (
    <div data-testid="offline-status-bar">
      Offline Status Bar - {variant} - {position}
    </div>
  ),
}));

jest.mock("../offline/OfflineStatusIndicator", () => ({
  OfflineStatusIndicator: ({
    variant,
    className,
  }: {
    variant: string;
    className?: string;
  }) => (
    <div data-testid="offline-status-indicator" className={className}>
      Offline Status Indicator - {variant}
    </div>
  ),
}));

jest.mock("../ui/toaster", () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>,
}));

jest.mock("../ui/logo", () => ({
  Logo: ({ size, priority }: { size: string; priority?: boolean }) => (
    <div data-testid="logo">
      Logo - {size} - {priority ? "priority" : "normal"}
    </div>
  ),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockLogOut = logOut as jest.MockedFunction<typeof logOut>;

describe("ClientLayout", () => {
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

  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter);
  });

  it("renders children correctly", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <ClientLayout>
        <div data-testid="test-child">Test Content</div>
      </ClientLayout>
    );

    expect(screen.getByTestId("test-child")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("renders PWA components", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <ClientLayout>
        <div>Test Content</div>
      </ClientLayout>
    );

    expect(screen.getByTestId("pwa-install-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("pwa-update-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("offline-status-bar")).toBeInTheDocument();
    expect(screen.getByTestId("toaster")).toBeInTheDocument();
  });

  it("renders OfflineMessagingProvider wrapper", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <ClientLayout>
        <div>Test Content</div>
      </ClientLayout>
    );

    expect(screen.getByTestId("offline-provider")).toBeInTheDocument();
  });

  it("renders logo with correct props", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <ClientLayout>
        <div>Test Content</div>
      </ClientLayout>
    );

    expect(screen.getByTestId("logo")).toHaveTextContent(
      "Logo - sm - priority"
    );
  });

  it("renders navigation when user is authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    render(
      <ClientLayout>
        <div>Test Content</div>
      </ClientLayout>
    );

    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Sign Out")).toBeInTheDocument();
  });

  it("does not render navigation when user is not authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <ClientLayout>
        <div>Test Content</div>
      </ClientLayout>
    );

    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign Out")).not.toBeInTheDocument();
  });

  it("renders PWA status and offline indicator for authenticated users on larger screens", () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    render(
      <ClientLayout>
        <div>Test Content</div>
      </ClientLayout>
    );

    expect(screen.getByTestId("pwa-status")).toBeInTheDocument();
    expect(screen.getByTestId("offline-status-indicator")).toBeInTheDocument();
  });

  it("handles sign out correctly", async () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });
    mockLogOut.mockResolvedValue(undefined);

    render(
      <ClientLayout>
        <div>Test Content</div>
      </ClientLayout>
    );

    const signOutButton = screen.getByRole("button", { name: /sign out/i });
    fireEvent.click(signOutButton);

    await waitFor(() => {
      expect(mockLogOut).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/");
    });
  });

  it("renders main content with correct accessibility attributes", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <ClientLayout>
        <div>Test Content</div>
      </ClientLayout>
    );

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabIndex", "-1");
  });

  it("renders header with correct accessibility attributes", () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    render(
      <ClientLayout>
        <div>Test Content</div>
      </ClientLayout>
    );

    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute("aria-label", "Main navigation");
  });

  it("renders home link with correct accessibility attributes", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <ClientLayout>
        <div>Test Content</div>
      </ClientLayout>
    );

    const homeLink = screen.getByRole("link", { name: "Schools-In Home" });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("renders profile link with correct accessibility attributes", () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    render(
      <ClientLayout>
        <div>Test Content</div>
      </ClientLayout>
    );

    const profileLink = screen.getByRole("link", { name: "User profile" });
    expect(profileLink).toHaveAttribute("href", "/profile");
  });

  it("handles sign out button with responsive text", () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    render(
      <ClientLayout>
        <div>Test Content</div>
      </ClientLayout>
    );

    const signOutButton = screen.getByRole("button", { name: /sign out/i });
    expect(signOutButton).toHaveAttribute(
      "aria-label",
      "Sign out of application"
    );
  });
});
