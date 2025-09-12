import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SessionStatus } from "./SessionStatus";
import * as useAuthModule from "../../lib/hooks/useAuth";

// Mock the modules
jest.mock("../../lib/hooks/useAuth");

const mockUseAuth = jest.spyOn(useAuthModule, "useAuth");

const mockUser = {
  uid: "user-123",
  email: "provider@test.com",
  displayName: "Test Provider",
  role: "provider" as const,
};

const mockActiveSession = {
  id: "session-123",
  schoolId: "school-1",
  schoolName: "Walter Payton High School",
  startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
  status: "active" as const,
  duration: 30,
  location: {
    latitude: 41.90191443941818,
    longitude: -87.63472443763325,
  },
};

const mockPausedSession = {
  ...mockActiveSession,
  status: "paused" as const,
};

const mockCompletedSession = {
  ...mockActiveSession,
  status: "completed" as const,
  duration: 120, // 2 hours
};

describe("SessionStatus Component", () => {
  const mockOnEndSession = jest.fn();
  const mockOnPauseSession = jest.fn();
  const mockOnResumeSession = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders no session state correctly", () => {
    render(
      <SessionStatus
        currentSession={null}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    expect(screen.getByText("No active session")).toBeInTheDocument();
    expect(
      screen.getByText("You're not currently checked in at any school")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Check in at a school to start tracking your session")
    ).toBeInTheDocument();
  });

  it("renders active session correctly", () => {
    render(
      <SessionStatus
        currentSession={mockActiveSession}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    expect(screen.getByText("Walter Payton High School")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("30m")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("shows pause and end session buttons for active session", () => {
    render(
      <SessionStatus
        currentSession={mockActiveSession}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /end session/i })).toBeInTheDocument();
  });

  it("calls onPauseSession when pause button is clicked", () => {
    render(
      <SessionStatus
        currentSession={mockActiveSession}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    const pauseButton = screen.getByRole("button", { name: /pause/i });
    fireEvent.click(pauseButton);
    expect(mockOnPauseSession).toHaveBeenCalledWith("session-123");
  });

  it("calls onEndSession when end session button is clicked", () => {
    render(
      <SessionStatus
        currentSession={mockActiveSession}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    const endButton = screen.getByRole("button", { name: /end session/i });
    fireEvent.click(endButton);
    expect(mockOnEndSession).toHaveBeenCalledWith("session-123");
  });

  it("renders paused session correctly", () => {
    render(
      <SessionStatus
        currentSession={mockPausedSession}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Session Paused")).toBeInTheDocument();
    expect(screen.getByText(/Remember to resume your session/)).toBeInTheDocument();
  });

  it("shows resume and end session buttons for paused session", () => {
    render(
      <SessionStatus
        currentSession={mockPausedSession}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    expect(screen.getByRole("button", { name: /resume/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /end session/i })).toBeInTheDocument();
  });

  it("calls onResumeSession when resume button is clicked", () => {
    render(
      <SessionStatus
        currentSession={mockPausedSession}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    const resumeButton = screen.getByRole("button", { name: /resume/i });
    fireEvent.click(resumeButton);
    expect(mockOnResumeSession).toHaveBeenCalledWith("session-123");
  });

  it("renders completed session correctly", () => {
    render(
      <SessionStatus
        currentSession={mockCompletedSession}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Session Completed")).toBeInTheDocument();
    expect(screen.getByText(/This session has been completed/)).toBeInTheDocument();
    expect(screen.getByText(/Total duration: 2h 0m/)).toBeInTheDocument();
  });

  it("does not show action buttons for completed session", () => {
    render(
      <SessionStatus
        currentSession={mockCompletedSession}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    expect(screen.queryByRole("button", { name: /pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resume/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /end session/i })).not.toBeInTheDocument();
  });

  it("formats duration correctly for hours and minutes", () => {
    const sessionWith90Minutes = {
      ...mockActiveSession,
      duration: 90, // 1h 30m
    };

    render(
      <SessionStatus
        currentSession={sessionWith90Minutes}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    expect(screen.getByText("1h 30m")).toBeInTheDocument();
  });

  it("formats duration correctly for minutes only", () => {
    const sessionWith45Minutes = {
      ...mockActiveSession,
      duration: 45,
    };

    render(
      <SessionStatus
        currentSession={sessionWith45Minutes}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    expect(screen.getByText("45m")).toBeInTheDocument();
  });

  it("displays GPS coordinates correctly", () => {
    render(
      <SessionStatus
        currentSession={mockActiveSession}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    expect(screen.getByText("41.9019, -87.6347")).toBeInTheDocument();
  });

  it("displays start time correctly", () => {
    const mockDate = new Date("2024-01-15T10:30:00");
    const sessionWithSpecificTime = {
      ...mockActiveSession,
      startTime: mockDate,
    };

    render(
      <SessionStatus
        currentSession={sessionWithSpecificTime}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    expect(screen.getByText(/Started at/)).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <SessionStatus
        currentSession={null}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("shows session status correctly", () => {
    render(
      <SessionStatus
        currentSession={mockActiveSession}
        onEndSession={mockOnEndSession}
        onPauseSession={mockOnPauseSession}
        onResumeSession={mockOnResumeSession}
      />
    );

    expect(screen.getByText("Ongoing")).toBeInTheDocument();
  });

  it("handles undefined callbacks gracefully", () => {
    render(
      <SessionStatus
        currentSession={mockActiveSession}
      />
    );

    const pauseButton = screen.getByRole("button", { name: /pause/i });
    fireEvent.click(pauseButton);
    // Should not throw any errors
  });
});
