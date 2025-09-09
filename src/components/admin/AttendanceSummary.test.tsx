import { render, screen } from "@testing-library/react";
import { AttendanceSummary } from "./AttendanceSummary";

// Mock the entire firestore module
jest.mock("../../lib/firebase/firestore", () => ({
  getCollection: jest.fn().mockResolvedValue([]),
  COLLECTIONS: {
    USERS: "users",
    SESSIONS: "sessions",
    LOCATIONS: "locations",
  },
}));

// Mock session utils
jest.mock("../../lib/utils/session", () => ({
  formatDuration: jest.fn((minutes: number) => `${minutes}m`),
  getSessionStatusConfig: jest.fn((status: string) => ({
    label: status,
    color: "bg-gray-100 text-gray-800",
    icon: "Circle",
    description: `Status: ${status}`,
  })),
  calculateSessionDuration: jest.fn(() => 60),
}));

describe("AttendanceSummary Component", () => {
  it("renders attendance summary dashboard", () => {
    render(<AttendanceSummary />);

    expect(screen.getByText("Attendance Summary Filters")).toBeInTheDocument();
    expect(screen.getByText("Total Providers")).toBeInTheDocument();
    expect(screen.getByText("Total Schools")).toBeInTheDocument();
    expect(screen.getByText("Avg Attendance Rate")).toBeInTheDocument();
    expect(screen.getByText("Total Session Days")).toBeInTheDocument();
  });

  it("renders filter controls", () => {
    render(<AttendanceSummary />);

    expect(screen.getByLabelText("Date Range")).toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    expect(screen.getByLabelText("School")).toBeInTheDocument();
  });

  it("renders provider and school attendance tables", () => {
    render(<AttendanceSummary />);

    expect(screen.getByText("Provider Attendance Summary (0 providers)")).toBeInTheDocument();
    expect(screen.getByText("School Coverage Summary (0 schools)")).toBeInTheDocument();
  });

  it("shows empty state messages", () => {
    render(<AttendanceSummary />);

    expect(
      screen.getByText("No provider attendance data found for the selected filters")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No school coverage data found for the selected filters")
    ).toBeInTheDocument();
  });

  it("renders apply and reset filter buttons", () => {
    render(<AttendanceSummary />);

    expect(screen.getByText("Apply Filters")).toBeInTheDocument();
    expect(screen.getByText("Reset Filters")).toBeInTheDocument();
  });
});
