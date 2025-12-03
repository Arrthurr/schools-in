import { render, screen } from "@testing-library/react";
import { SessionReports } from "./SessionReports";

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

const renderReports = async () => {
  render(<SessionReports />);
  await screen.findByText("Session Data (0 sessions)");
};

describe("SessionReports Component", () => {
  it("renders session reports dashboard", async () => {
    await renderReports();

    expect(screen.getByText("Report Filters")).toBeInTheDocument();
    expect(screen.getByText("Total Sessions")).toBeInTheDocument();
    expect(screen.getByText("Total Duration")).toBeInTheDocument();
    expect(screen.getByText("Avg Session")).toBeInTheDocument();
    expect(screen.getByText("Completion Rate")).toBeInTheDocument();
  });

  it("renders filter controls", async () => {
    await renderReports();

    expect(screen.getByLabelText("Date Range")).toBeInTheDocument();
    expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    expect(screen.getByLabelText("School")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("renders apply and reset filter buttons", async () => {
    await renderReports();

    expect(await screen.findByText("Apply Filters")).toBeInTheDocument();
    expect(screen.getByText("Reset Filters")).toBeInTheDocument();
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
  });

  it("disables CSV export button when no sessions", async () => {
    await renderReports();

    const exportButton = await screen.findByText("Export CSV");
    expect(exportButton).toBeDisabled();
  });

  it("renders session data table", async () => {
    await renderReports();

    expect(screen.getByText("Session Data (0 sessions)")).toBeInTheDocument();
    expect(
      screen.getByText(/No sessions match the selected filters/i)
    ).toBeInTheDocument();
  });
});
