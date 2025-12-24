import { render, waitFor } from "@testing-library/react";
import DashboardPage from "./page";
import React from "react";

const mockGetAssignedLocations = jest.fn();

jest.mock("@/lib/services/locationService", () => ({
  getAssignedLocations: (...args: any[]) => mockGetAssignedLocations(...args),
}));

jest.mock("@/lib/hooks/useCachedAuth", () => ({
  useCachedAuth: () => ({ user: { uid: "provider-123" } }),
}));

jest.mock("@/lib/hooks/useProviderMetrics", () => ({
  useProviderMetrics: () => ({ endSession: jest.fn() }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/dashboard",
}));

jest.mock("../../components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("../../components/provider/SchoolList", () => ({
  SchoolList: () => <div data-testid="school-list">School List</div>,
}));

jest.mock("../../components/provider/SessionStatus", () => ({
  SessionStatus: () => <div data-testid="session-status">Session Status</div>,
}));

jest.mock("@/components/dashboard", () => ({
  PageHeader: ({ children }: any) => <div data-testid="page-header">{children}</div>,
  StatCard: () => <div data-testid="stat-card">Stat Card</div>,
  SectionCard: ({ children }: any) => <div data-testid="section-card">{children}</div>,
  ActivityList: () => <div data-testid="activity-list">Activity List</div>,
}));

jest.mock("../../components/ui/logo", () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children }: any) => <button>{children}</button>,
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

jest.mock("@/lib/services/cachedSessionService", () => ({
  CachedSessionService: {
    getUserSessions: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("@/lib/hooks/useAutoGeofencePreference", () => ({
  useAutoGeofencePreference: () => ({
    enabled: false,
    loading: false,
    error: null,
    setEnabled: jest.fn(),
  }),
}));

jest.mock("@/lib/hooks/useAutoGeofenceCheck", () => ({
  useAutoGeofenceCheck: () => ({
    geofenceState: "idle",
    gpsStatus: "idle",
    isPolling: false,
    currentLocation: null,
    nearbyLocations: [],
    checkInCountdown: null,
    checkOutCountdown: null,
    cancelCheckIn: jest.fn(),
    cancelCheckOut: jest.fn(),
    pausePolling: jest.fn(),
    resumePolling: jest.fn(),
  }),
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAssignedLocations.mockResolvedValue([
      { id: "loc1", name: "School One" },
      { id: "loc2", name: "School Two" },
    ]);
  });

  it("loads assigned locations for the current user", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(mockGetAssignedLocations).toHaveBeenCalledWith("provider-123");
    });
  });
});
