import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import DashboardPage from "./page";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useProviderMetrics } from "@/lib/hooks/useProviderMetrics";
import { CachedSessionService } from "@/lib/services/cachedSessionService";
import { getAssignedLocations } from "@/lib/services/locationService";

// Mock the hooks
jest.mock("@/lib/hooks/useCachedAuth");
jest.mock("@/lib/hooks/useProviderMetrics");
jest.mock("@/lib/services/cachedSessionService");
jest.mock("@/lib/services/locationService");

// Mock components to avoid rendering issues and simplify testing
jest.mock("../../components/provider/SchoolList", () => ({
  SchoolList: () => <div data-testid="school-list">SchoolList</div>,
}));
jest.mock("../../components/provider/SessionStatus", () => ({
  SessionStatus: () => <div data-testid="session-status">SessionStatus</div>,
}));
jest.mock("@/components/ui/logo", () => ({
  Logo: () => <div>Logo</div>,
}));

// Mock UI components that might cause issues
jest.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

describe("DashboardPage Recent Activity", () => {
  const mockUser = {
    uid: "test-user",
    displayName: "Test User",
    role: "provider",
  };

  const mockMetrics = {
    isSessionActive: false,
    currentSession: null,
    lastCompletedSession: null,
    weeklyMetrics: {
      weeklySessionsCount: 5,
      weeklyTotalHours: 10,
    },
    endSession: jest.fn(),
  };

  const mockLocations = [
    { id: "loc1", name: "School A" },
    { id: "loc2", name: "School B" },
  ];

  const mockSessions = [
    {
      id: "s1",
      locationId: "loc1",
      startTime: { toDate: () => new Date(Date.now() - 1000 * 60 * 60 * 2) }, // 2 hours ago
      status: "completed",
    },
    {
      id: "s2",
      locationId: "loc2",
      startTime: { toDate: () => new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) }, // 2 days ago
      status: "completed",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useCachedAuth as jest.Mock).mockReturnValue({ user: mockUser, loading: false });
    (useProviderMetrics as jest.Mock).mockReturnValue(mockMetrics);
    (getAssignedLocations as jest.Mock).mockResolvedValue(mockLocations);
    (CachedSessionService.getUserSessions as jest.Mock).mockResolvedValue(mockSessions);
  });

  it("should display recent sessions", async () => {
    await act(async () => {
      render(<DashboardPage />);
    });

    // Check if getAssignedLocations was called
    await waitFor(() => {
      expect(getAssignedLocations).toHaveBeenCalledWith("test-user");
    });

    // Verify that the sessions are displayed with their location names
    expect(screen.getByText("School A")).toBeInTheDocument();
    expect(screen.getByText("School B")).toBeInTheDocument();
    expect(screen.queryByText(/No recent activity/i)).not.toBeInTheDocument();
  });

  it("should display empty state when no recent sessions", async () => {
    (CachedSessionService.getUserSessions as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<DashboardPage />);
    });

    // Wait for potential async effects
    await waitFor(() => {
      expect(CachedSessionService.getUserSessions).toHaveBeenCalled();
    });

    expect(screen.getByText(/No recent activity/i)).toBeInTheDocument();
  });
});
