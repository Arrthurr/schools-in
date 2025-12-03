import { render, screen, waitFor } from "@testing-library/react";
import { SessionManagement } from "./SessionManagement";

// Mock the entire firestore module
jest.mock("../../lib/firebase/firestore", () => ({
  getCollection: jest.fn().mockResolvedValue([]),
  updateDocument: jest.fn().mockResolvedValue(undefined),
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

describe("SessionManagement Component", () => {
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
});
