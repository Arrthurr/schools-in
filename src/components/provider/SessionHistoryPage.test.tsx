import { render, screen, waitFor } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { SessionHistoryPage } from "./SessionHistoryPage";

const mockGetUserSessions = jest.fn();

jest.mock("@/lib/services/cachedSessionService", () => ({
  CachedSessionService: {
    getUserSessions: (...args: any[]) => mockGetUserSessions(...args),
  },
}));

jest.mock("@/lib/hooks/useCachedAuth", () => ({
  useCachedAuth: () => ({ user: { uid: "provider-1" } }),
}));

jest.mock("@/lib/hooks/useProviderLocations", () => ({
  useProviderLocations: () => ({
    locations: [{ id: "loc-1", name: "Lincoln High" }],
    loading: false,
    error: null,
    refreshing: false,
    refreshLocations: jest.fn(),
    refreshAssignments: jest.fn(),
  }),
}));

jest.mock("@/components/dashboard", () => ({
  PageHeader: ({ title, description, actions }: any) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
      <div>{actions}</div>
    </div>
  ),
  SectionCard: ({ title, description, children, headerActions }: any) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
      <div>{headerActions}</div>
      {children}
    </div>
  ),
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

describe("SessionHistoryPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserSessions.mockResolvedValue([
      {
        id: "s-1",
        userId: "provider-1",
        locationId: "loc-1",
        startTime: Timestamp.fromDate(new Date("2024-01-01T08:00:00Z")),
        endTime: Timestamp.fromDate(new Date("2024-01-01T09:00:00Z")),
        status: "completed",
        durationMinutes: 60,
        checkInMethod: "geo",
        distanceFromCenterAtCheckIn: 5,
        dayKey: "2024-01-01",
        createdAt: Timestamp.fromDate(new Date("2024-01-01T08:00:00Z")),
        updatedAt: Timestamp.fromDate(new Date("2024-01-01T09:00:00Z")),
      },
    ]);
  });

  it("fetches completed sessions and renders them", async () => {
    render(<SessionHistoryPage />);

    await waitFor(() => {
      expect(mockGetUserSessions).toHaveBeenCalled();
    });

    expect(mockGetUserSessions.mock.calls[0][1]).toMatchObject({
      status: "completed",
    });
    expect(screen.getByText("Lincoln High")).toBeInTheDocument();
    expect(screen.getByText(/Session History/i)).toBeInTheDocument();
  });
});
