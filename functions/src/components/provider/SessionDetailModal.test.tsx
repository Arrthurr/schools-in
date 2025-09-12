import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SessionDetailModal } from "./SessionDetailModal";
import { SessionData } from "../../lib/utils/session";
import { Timestamp } from "firebase/firestore";

// Mock session data
const mockSession: SessionData = {
  id: "session-123",
  userId: "user-123",
  schoolId: "school-1",
  checkInTime: Timestamp.fromDate(new Date("2024-01-15T09:00:00")),
  checkOutTime: Timestamp.fromDate(new Date("2024-01-15T17:00:00")),
  checkInLocation: {
    latitude: 41.901914,
    longitude: -87.634724,
  },
  checkOutLocation: {
    latitude: 41.901914,
    longitude: -87.634724,
  },
  status: "completed",
  duration: 480, // 8 hours
  notes: "Great session with the students",
};

const mockActiveSession: SessionData = {
  id: "session-456",
  userId: "user-123",
  schoolId: "school-2",
  checkInTime: Timestamp.fromDate(new Date("2024-01-16T08:30:00")),
  checkInLocation: {
    latitude: 42.009124,
    longitude: -87.632747,
  },
  status: "active",
};

describe("SessionDetailModal Component", () => {
  it("renders nothing when session is null", () => {
    const { container } = render(
      <SessionDetailModal
        session={null}
        schoolName="Test School"
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders modal with completed session details", () => {
    render(
      <SessionDetailModal
        session={mockSession}
        schoolName="Walter Payton HS"
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Session Details")).toBeInTheDocument();
    expect(screen.getByText("Session ID: session-123")).toBeInTheDocument();
    expect(screen.getByText("Walter Payton HS")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("8 hours")).toBeInTheDocument();
    expect(
      screen.getByText("Great session with the students")
    ).toBeInTheDocument();
  });

  it("renders modal with active session details", () => {
    render(
      <SessionDetailModal
        session={mockActiveSession}
        schoolName="Bethesda International Academy"
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Session Details")).toBeInTheDocument();
    expect(screen.getByText("Session ID: session-456")).toBeInTheDocument();
    expect(
      screen.getByText("Bethesda International Academy")
    ).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByText("Check-out Time")).not.toBeInTheDocument();
  });

  it("displays coordinates correctly", () => {
    render(
      <SessionDetailModal
        session={mockSession}
        schoolName="Test School"
        isOpen={true}
        onClose={() => {}}
      />
    );

    const coordinateElements = screen.getAllByText("41.901914, -87.634724");
    expect(coordinateElements).toHaveLength(2); // Check-in and check-out coordinates
  });

  it("displays user ID correctly", () => {
    render(
      <SessionDetailModal
        session={mockSession}
        schoolName="Test School"
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("user-123")).toBeInTheDocument();
  });

  it("shows unknown school when schoolName is not provided", () => {
    render(
      <SessionDetailModal
        session={mockSession}
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Unknown School")).toBeInTheDocument();
  });

  it("does not show notes section when notes are not provided", () => {
    render(
      <SessionDetailModal
        session={mockActiveSession}
        schoolName="Test School"
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Great session with the students")
    ).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const mockOnClose = jest.fn();

    render(
      <SessionDetailModal
        session={mockSession}
        schoolName="Test School"
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("formats timestamps correctly", () => {
    render(
      <SessionDetailModal
        session={mockSession}
        schoolName="Test School"
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Check that the formatted time appears (exact format may vary by locale)
    const timeElements = screen.getAllByText(/1\/15\/2024/);
    expect(timeElements.length).toBeGreaterThan(0);
  });
});
