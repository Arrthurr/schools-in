import { render, screen } from "@testing-library/react";
import { SessionReports } from "./SessionReports";

// Mock the entire firestore module
jest.mock("@/lib/firebase/firestore", () => ({
  getCollection: jest.fn().mockResolvedValue([]),
  COLLECTIONS: {
    USERS: "users",
    SESSIONS: "sessions", 
    LOCATIONS: "locations",
  },
}));

// Mock session utils
jest.mock("@/lib/utils/session", () => ({
  formatDuration: jest.fn((minutes) => `${minutes}m`),
  getSessionStatusConfig: jest.fn((status) => ({
    label: status,
    color: "bg-gray-100 text-gray-800",
    icon: "Circle",
    description: `Status: ${status}`,
  })),
}));

describe("SessionReports Component", () => {
  it("renders session reports dashboard", () => {
    render(<SessionReports />);
    
    expect(screen.getByText("Report Filters")).toBeInTheDocument();
    expect(screen.getByText("Total Sessions")).toBeInTheDocument();
    expect(screen.getByText("Total Duration")).toBeInTheDocument();
    expect(screen.getByText("Avg Session")).toBeInTheDocument();
    expect(screen.getByText("Completion Rate")).toBeInTheDocument();
  });

  it("renders filter controls", () => {
    render(<SessionReports />);
    
    expect(screen.getByLabelText("Date Range")).toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    expect(screen.getByLabelText("School")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("renders apply and reset filter buttons", () => {
    render(<SessionReports />);
    
    expect(screen.getByText("Apply Filters")).toBeInTheDocument();
    expect(screen.getByText("Reset Filters")).toBeInTheDocument();
  });

  it("renders session data table", () => {
    render(<SessionReports />);
    
    expect(screen.getByText("Session Data (0 sessions)")).toBeInTheDocument();
    expect(screen.getByText("No sessions found for the selected filters")).toBeInTheDocument();
  });
});
