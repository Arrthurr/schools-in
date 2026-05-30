import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionManagement } from "./SessionManagement";

const mockGetCollection = jest.fn();
const mockUpdateDocument = jest.fn();

jest.mock("../../lib/firebase/firestore", () => ({
  getCollection: (...args: unknown[]) => mockGetCollection(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  COLLECTIONS: { USERS: "users", SESSIONS: "sessions", LOCATIONS: "locations" },
}));

jest.mock("../../lib/utils/session", () => ({
  formatDuration: jest.fn((minutes: number) => `${minutes}m`),
  getSessionStatusConfig: jest.fn(
    (statusOrSession: string | { status?: string }) => {
      const status =
        typeof statusOrSession === "string"
          ? statusOrSession
          : statusOrSession.status || "unknown";
      return {
        label: status,
        color: "bg-gray-100 text-gray-800",
        icon: "Circle",
        description: `Status: ${status}`,
      };
    }
  ),
  calculateSessionDuration: jest.fn(() => 60),
  getSessionLocationId: jest.fn((session: any) => session.locationId ?? session.schoolId),
  getSessionCheckInTimestamp: jest.fn((session: any) => session.checkInTime ?? session.startTime),
}));

jest.mock("../../lib/hooks/useCachedAuth", () => ({
  useCachedAuth: () => ({ user: { uid: "admin-1", email: "admin@test.com" } }),
}));

// --- helpers ---

const mockTimestamp = (dateStr: string) => ({
  toDate: () => new Date(dateStr),
  toMillis: () => new Date(dateStr).getTime(),
  seconds: Math.floor(new Date(dateStr).getTime() / 1000),
  nanoseconds: 0,
});

const makeSession = (overrides = {}) => ({
  id: "session-1",
  userId: "provider-1",
  schoolId: "school-1",
  locationId: "school-1",
  checkInTime: mockTimestamp("2025-03-20T09:00:00"),
  checkOutTime: mockTimestamp("2025-03-20T15:00:00"),
  startTime: mockTimestamp("2025-03-20T09:00:00"),
  endTime: mockTimestamp("2025-03-20T15:00:00"),
  status: "completed" as const,
  checkInMethod: "geo",
  notes: "",
  checkInLocation: { latitude: 41.88, longitude: -87.63 },
  checkOutLocation: { latitude: 41.88, longitude: -87.63 },
  distanceFromCenterAtCheckIn: 50,
  dayKey: "2025-03-20",
  needsAdminReview: false,
  ...overrides,
});

const makeSchool = (overrides = {}) => ({
  id: "school-1",
  name: "Test Elementary",
  address: "123 Test St",
  ...overrides,
});

const makeProvider = (overrides = {}) => ({
  id: "provider-1",
  email: "provider@test.com",
  displayName: "Test Provider",
  role: "provider" as const,
  ...overrides,
});

function setupMockData({
  sessions = [] as ReturnType<typeof makeSession>[],
  schools = [] as ReturnType<typeof makeSchool>[],
  users = [] as ReturnType<typeof makeProvider>[],
} = {}) {
  mockGetCollection.mockImplementation((collection: string) => {
    switch (collection) {
      case "locations":
        return Promise.resolve(schools);
      case "users":
        return Promise.resolve(users);
      case "sessions":
        return Promise.resolve(sessions);
      default:
        return Promise.resolve([]);
    }
  });
}

describe("SessionManagement Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCollection.mockResolvedValue([]);
    mockUpdateDocument.mockResolvedValue(undefined);
  });

  it("renders session management dashboard", async () => {
    render(<SessionManagement />);

    expect(
      screen.getByText("Session Management & Corrections")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("All Sessions (0)")).toBeInTheDocument();
    });
  });

  it("shows no sessions message when empty", async () => {
    render(<SessionManagement />);

    await waitFor(() => {
      expect(
        screen.getByText(
          /manage and correct session data, force-close stuck sessions, and resolve error states/i
        )
      ).toBeInTheDocument();
    });
  });

  it("renders session management description", async () => {
    render(<SessionManagement />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Manage and correct session data, force-close stuck sessions, and resolve error states."
        )
      ).toBeInTheDocument();
    });
  });

  it("displays sessions when data is loaded", async () => {
    setupMockData({
      sessions: [makeSession()],
      schools: [makeSchool()],
      users: [makeProvider()],
    });

    render(<SessionManagement />);

    await waitFor(() => {
      expect(screen.getByText("All Sessions (1)")).toBeInTheDocument();
    });

    expect(screen.getByText("Test Provider")).toBeInTheDocument();
    expect(screen.getByText("Test Elementary")).toBeInTheDocument();
  });

  it("displays needs review badge for sessions requiring admin review", async () => {
    // Session must be error + timeout_auto_close + needsAdminReview to show in attention section
    const reviewSession = makeSession({
      id: "review-session",
      status: "error",
      errorCode: "timeout_auto_close",
      needsAdminReview: true,
    });

    setupMockData({
      sessions: [reviewSession],
      schools: [makeSchool()],
      users: [makeProvider()],
    });

    render(<SessionManagement />);

    await waitFor(() => {
      expect(
        screen.getByText("Sessions Needing Attention (1)")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Needs admin review")).toBeInTheDocument();
  });

  it("marks session as reviewed", async () => {
    const reviewSession = makeSession({
      id: "review-session",
      status: "error",
      errorCode: "timeout_auto_close",
      needsAdminReview: true,
    });

    setupMockData({
      sessions: [reviewSession],
      schools: [makeSchool()],
      users: [makeProvider()],
    });

    const user = userEvent.setup();
    render(<SessionManagement />);

    await waitFor(() => {
      expect(screen.getByText("Mark Reviewed")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Mark Reviewed"));

    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith(
        "sessions",
        "review-session",
        expect.objectContaining({
          needsAdminReview: false,
          adminReviewStatus: "reviewed",
          adminReviewedBy: "admin-1",
        })
      );
    });
  });

  it("opens force close dialog for active session", async () => {
    // Active session checked in >12 hours ago so it appears in "Needing Attention"
    const activeSession = makeSession({
      id: "active-session",
      status: "active",
      checkInTime: mockTimestamp("2025-03-19T06:00:00"),
      checkOutTime: undefined,
    });

    setupMockData({
      sessions: [activeSession],
      schools: [makeSchool()],
      users: [makeProvider()],
    });

    const user = userEvent.setup();
    render(<SessionManagement />);

    await waitFor(() => {
      expect(screen.getByText("Force Close")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Force Close"));

    await waitFor(() => {
      expect(
        screen.getByText(/force-close the active session/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: /Force Close Session/i })).toBeInTheDocument();
  });

  it("handles loading error gracefully", async () => {
    mockGetCollection.mockRejectedValue(new Error("Network error"));

    render(<SessionManagement />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load session data")
      ).toBeInTheDocument();
    });
  });
});
