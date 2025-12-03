import { act, render, screen } from "@testing-library/react";
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
  const renderComponent = async () => {
    await act(async () => {
      render(<AttendanceSummary />);
    });
  };

  it("renders attendance summary dashboard", async () => {
    await renderComponent();

    expect(screen.getByText("Attendance Summary Filters")).toBeInTheDocument();
    expect(screen.getByText("Total Providers")).toBeInTheDocument();
    expect(screen.getByText("Total Schools")).toBeInTheDocument();
    expect(screen.getByText("Avg Attendance Rate")).toBeInTheDocument();
    expect(screen.getByText("Total Session Days")).toBeInTheDocument();
  });

  it("renders filter controls", async () => {
    await renderComponent();

    expect(screen.getByLabelText("Date Range")).toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    expect(screen.getByLabelText("School")).toBeInTheDocument();
  });

  it("renders provider and school attendance tables", async () => {
    await renderComponent();

    expect(
      screen.getByText("Provider Attendance Summary (0 providers)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("School Coverage Summary (0 schools)")
    ).toBeInTheDocument();
  });

  it("shows empty state messages", async () => {
    await renderComponent();

    expect(
      screen.getByText(
        "No provider attendance data found for the selected filters"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("No school coverage data found for the selected filters")
    ).toBeInTheDocument();
  });

  it("renders apply and reset filter buttons", async () => {
    await renderComponent();

    expect(
      await screen.findByRole("button", { name: "Apply Filters" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset Filters" })).toBeInTheDocument();
  });
});
