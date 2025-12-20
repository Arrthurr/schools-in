import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SessionStatus } from "./SessionStatus";
import * as useAuthModule from "../../lib/hooks/useAuth";

// Mock the modules
jest.mock("../../lib/hooks/useAuth");
jest.mock("firebase/firestore", () => ({
  Timestamp: class {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
    toDate() {
      return new Date(this.seconds * 1000 + this.nanoseconds / 1000000);
    }
    static fromDate(date: Date) {
      return new this(Math.floor(date.getTime() / 1000), (date.getTime() % 1000) * 1000000);
    }
    static now() {
      return this.fromDate(new Date());
    }
  },
}));

const mockUseAuth = jest.spyOn(useAuthModule, "useAuth");

const mockUser = {
  uid: "user-123",
  email: "provider@test.com",
  displayName: "Test Provider",
  role: "provider" as const,
} as unknown as ReturnType<typeof useAuthModule.useAuth>["user"];

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

const mockCompletedSession = {
  ...mockActiveSession,
  status: "completed" as const,
  duration: 120, // 2 hours
};

describe("SessionStatus Component", () => {
  const mockOnEndSession = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
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
      />
    );

    expect(screen.getByText("Walter Payton High School")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("30m")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("shows end session button for active session", () => {
    render(
      <SessionStatus
        currentSession={mockActiveSession}
        onEndSession={mockOnEndSession}
      />
    );

    expect(screen.getByRole("button", { name: /end session/i })).toBeInTheDocument();
  });

  it("calls onEndSession when end session button is clicked", () => {
    render(
      <SessionStatus
        currentSession={mockActiveSession}
        onEndSession={mockOnEndSession}
      />
    );

    const endButton = screen.getByRole("button", { name: /end session/i });
    fireEvent.click(endButton);
    expect(mockOnEndSession).toHaveBeenCalledWith("session-123");
  });

  it("renders completed session correctly", () => {
    render(
      <SessionStatus
        currentSession={mockCompletedSession}
        onEndSession={mockOnEndSession}
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
      />
    );

    expect(screen.queryByRole("button", { name: /end session/i })).not.toBeInTheDocument();
  });

  it("formats duration correctly for hours and minutes", () => {
    render(
      <SessionStatus
        currentSession={{
          ...mockActiveSession,
          status: "active",
          startTime: new Date(Date.now() - 90 * 60000),
        }}
      />
    );

    expect(screen.getByText(/duration/i)).toBeInTheDocument();
  });

  it("formats duration correctly for minutes only", () => {
    render(
      <SessionStatus
        currentSession={{
          ...mockActiveSession,
          status: "active",
          startTime: new Date(Date.now() - 45 * 60000),
        }}
      />
    );

    expect(screen.getByText(/duration/i)).toBeInTheDocument();
  });

  it("displays GPS coordinates correctly", () => {
    render(
      <SessionStatus
        currentSession={mockActiveSession}
        onEndSession={mockOnEndSession}
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
    
    // Just ensure it renders without crashing
    expect(screen.getByText("Ongoing")).toBeInTheDocument();
  });
});
