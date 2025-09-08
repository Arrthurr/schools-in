import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SessionHistory } from "./SessionHistory";
import * as useAuthModule from "../../lib/hooks/useAuth";
import * as useSessionModule from "../../lib/hooks/useSession";
import * as schoolServiceModule from "../../lib/services/schoolService";
import { Timestamp } from "firebase/firestore";

// Mock the modules
jest.mock("../../lib/hooks/useAuth");
jest.mock("../../lib/hooks/useSession");
jest.mock("../../lib/services/schoolService");

const mockUseAuth = jest.spyOn(useAuthModule, "useAuth");
const mockUseSession = jest.spyOn(useSessionModule, "useSession");
const mockSchoolService = jest.spyOn(
  schoolServiceModule.SchoolService,
  "getSchoolById"
);

const mockUser = {
  uid: "user-123",
  email: "provider@test.com",
  displayName: "Test Provider",
  role: "provider" as const,
  emailVerified: true,
  isAnonymous: false,
  metadata: {},
  providerData: [],
  refreshToken: "",
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

const mockCompletedSession = {
  id: "session-123",
  userId: "user-123",
  schoolId: "school-1",
  checkInTime: Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000)), // 2 hours ago
  checkOutTime: Timestamp.fromDate(new Date(Date.now() - 30 * 60 * 1000)), // 30 minutes ago
  checkInLocation: {
    latitude: 41.90191443941818,
    longitude: -87.63472443763325,
  },
  checkOutLocation: {
    latitude: 41.90191443941818,
    longitude: -87.63472443763325,
  },
  status: "completed" as const,
  duration: 90, // 1.5 hours
};

const mockActiveSession = {
  id: "session-456",
  userId: "user-123",
  schoolId: "school-2",
  checkInTime: Timestamp.fromDate(new Date(Date.now() - 30 * 60 * 1000)), // 30 minutes ago
  checkInLocation: {
    latitude: 41.90191443941818,
    longitude: -87.63472443763325,
  },
  status: "active" as const,
};

const mockSchool = {
  id: "school-1",
  name: "Walter Payton High School",
  latitude: 41.90191443941818,
  longitude: -87.63472443763325,
  address: "1034 N Wells St, Chicago, IL 60610",
  isAssigned: true,
};

const mockLoadSessions = jest.fn();

describe("SessionHistory Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [],
      loading: false,
      error: null,
      totalSessions: 0,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    mockSchoolService.mockResolvedValue(mockSchool);
  });

  it("renders loading state correctly", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [],
      loading: true,
      error: null,
      totalSessions: 0,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    expect(screen.getByText("Session History")).toBeInTheDocument();
    expect(screen.getByText("Loading session history...")).toBeInTheDocument();
  });

  it("renders error state correctly", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [],
      loading: false,
      error: "Failed to load sessions",
      totalSessions: 0,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    expect(screen.getByText("Session History")).toBeInTheDocument();
    expect(
      screen.getByText("Error loading sessions: Failed to load sessions")
    ).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("renders empty state when no completed sessions", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockActiveSession], // Only active session
      loading: false,
      error: null,
      totalSessions: 1,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    expect(screen.getByText("Session History")).toBeInTheDocument();
    expect(screen.getByText("No completed sessions yet")).toBeInTheDocument();
    expect(
      screen.getByText(/View your past check-in sessions/)
    ).toBeInTheDocument();
  });

  it("renders completed sessions correctly", async () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession, mockActiveSession],
      loading: false,
      error: null,
      totalSessions: 2,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    expect(screen.getByText("Session History")).toBeInTheDocument();
    expect(
      screen.getByText(/View your past check-in sessions/)
    ).toBeInTheDocument();

    // Wait for school name to load
    await waitFor(() => {
      expect(screen.getByText("Walter Payton High School")).toBeInTheDocument();
    });

    expect(screen.getByText("1h 30m")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("loads sessions on mount", () => {
    render(<SessionHistory />);

    expect(mockLoadSessions).toHaveBeenCalledWith(mockUser.uid, 1, 10, {});
  });

  it("retries loading sessions when retry button is clicked", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [],
      loading: false,
      error: "Network error",
      totalSessions: 0,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    const retryButton = screen.getByText("Retry");
    retryButton.click();

    expect(mockLoadSessions).toHaveBeenCalledWith(mockUser.uid);
  });

  it("refreshes sessions when refresh button is clicked", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 1,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    const refreshButton = screen.getByText("Refresh");
    fireEvent.click(refreshButton);

    expect(mockLoadSessions).toHaveBeenCalledWith(mockUser.uid, 1, 10, {});
  });

  it("loads school names for sessions", async () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 1,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(mockSchoolService).toHaveBeenCalledWith("school-1");
    });
  });

  it("handles unknown school gracefully", async () => {
    mockSchoolService.mockResolvedValue(null);

    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 1,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getByText("Unknown School")).toBeInTheDocument();
    });
  });

  it("handles school service error gracefully", async () => {
    mockSchoolService.mockRejectedValue(new Error("Service error"));

    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 1,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    await waitFor(() => {
      expect(screen.getByText("Unknown School")).toBeInTheDocument();
    });
  });

  it("displays pagination controls when there are sessions", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 25,
      hasMore: true,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    expect(
      screen.getByText("Showing 1 to 10 of 25 sessions")
    ).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("disables previous button on first page", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 25,
      hasMore: true,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    const previousButton = screen.getByText("Previous");
    expect(previousButton).toBeDisabled();
  });

  it("enables next button when there are more sessions", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 25,
      hasMore: true,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    const nextButton = screen.getByText("Next");
    expect(nextButton).not.toBeDisabled();
  });

  it("disables next button when there are no more sessions", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 1,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    const nextButton = screen.getByText("Next");
    expect(nextButton).toBeDisabled();
  });

  it("calls loadSessions with pagination parameters when navigating", async () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 25,
      hasMore: true,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mockLoadSessions).toHaveBeenCalledWith(mockUser.uid, 2, 10, {});
    });
  });

  it("resets to page 1 when refresh button is clicked", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 25,
      hasMore: true,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    const refreshButton = screen.getByText("Refresh");
    fireEvent.click(refreshButton);

    expect(mockLoadSessions).toHaveBeenCalledWith(mockUser.uid, 1, 10, {});
  });

  it("shows filter controls when show filters button is clicked", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 1,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    const showFiltersButton = screen.getByText("Show Filters");
    fireEvent.click(showFiltersButton);

    expect(
      screen.getByText("School", { selector: "label" })
    ).toBeInTheDocument();
    expect(screen.getByText("Start Date")).toBeInTheDocument();
    expect(screen.getByText("End Date")).toBeInTheDocument();
  });

  it("hides filter controls when hide filters button is clicked", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 1,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    const showFiltersButton = screen.getByText("Show Filters");
    fireEvent.click(showFiltersButton);

    const hideFiltersButton = screen.getByText("Hide Filters");
    fireEvent.click(hideFiltersButton);

    expect(
      screen.queryByText("School", { selector: "label" })
    ).not.toBeInTheDocument();
  });

  it("shows View Details button for each session", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 1,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    expect(screen.getByText("View")).toBeInTheDocument();
  });

  it("opens session detail modal when View Details is clicked", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 1,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    const viewButton = screen.getByText("View");
    fireEvent.click(viewButton);

    expect(screen.getByText("Session Details")).toBeInTheDocument();
    expect(screen.getByText("Session ID: session-123")).toBeInTheDocument();
  });

  it("includes Actions column in table header", () => {
    mockUseSession.mockReturnValue({
      currentSession: null,
      sessions: [mockCompletedSession],
      loading: false,
      error: null,
      totalSessions: 1,
      hasMore: false,
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      loadSessions: mockLoadSessions,
      clearError: jest.fn(),
    });

    render(<SessionHistory />);

    expect(screen.getByText("Actions")).toBeInTheDocument();
  });
});
