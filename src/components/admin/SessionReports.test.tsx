import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirebaseError } from "firebase/app";
import * as firestore from "firebase/firestore";
import { getCollection } from "../../lib/firebase/firestore";
import { SessionReports } from "./SessionReports";

const mockGetCollection = getCollection as jest.MockedFunction<typeof getCollection>;

beforeAll(() => {
  // Radix Select / Floating UI use DOM APIs not fully implemented in jsdom
  Element.prototype.hasPointerCapture = jest.fn(() => false);
  Element.prototype.releasePointerCapture = jest.fn();
  Element.prototype.setPointerCapture = jest.fn();
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

jest.mock("firebase/firestore", () => {
  const Timestamp = {
    fromDate: (date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    }),
  };

  return {
    collection: jest.fn(() => ({})),
    query: jest.fn(() => ({})),
    where: jest.fn(() => ({})),
    orderBy: jest.fn(() => ({})),
    limit: jest.fn(() => ({})),
    getDocs: jest.fn().mockResolvedValue({ docs: [] }),
    Timestamp,
  };
});

jest.mock("../../lib/firebase/firestore", () => ({
  getCollection: jest.fn().mockResolvedValue([]),
  COLLECTIONS: {
    USERS: "users",
    SESSIONS: "sessions",
    LOCATIONS: "locations",
  },
}));

jest.mock("../../lib/utils/session", () => ({
  formatDuration: jest.fn((minutes: number) => `${minutes}m`),
  getSessionStatusConfig: jest.fn((status: string) => ({
    label: status,
    color: "bg-gray-100 text-gray-800",
    icon: "Circle",
    description: `Status: ${status}`,
  })),
  calculateSessionDuration: jest.fn(() => 60),
  getSessionCheckInTimestamp: jest.fn((session: { checkInTime?: unknown; startTime?: { toDate: () => Date } }) =>
    session.checkInTime ?? session.startTime
  ),
  getSessionCheckOutTimestamp: jest.fn((session: { checkOutTime?: unknown; endTime?: unknown }) =>
    session.checkOutTime ?? session.endTime
  ),
  getSessionLocationId: jest.fn((session: { locationId?: string; schoolId?: string }) =>
    session.locationId ?? session.schoolId
  ),
}));

const renderReports = async () => {
  render(<SessionReports />);
  await screen.findByText("Session Data (0 sessions)");
  await screen.findByText(/No sessions match the selected filters/i);
};

describe("SessionReports Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCollection.mockResolvedValue([]);
    (firestore.getDocs as jest.Mock).mockResolvedValue({ docs: [] });
  });

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

  it("queries sessions by startTime range and orders by startTime desc", async () => {
    await renderReports();

    expect(firestore.where).toHaveBeenCalledWith(
      "startTime",
      ">=",
      expect.anything()
    );
    expect(firestore.where).toHaveBeenCalledWith(
      "startTime",
      "<=",
      expect.anything()
    );
    expect(firestore.orderBy).toHaveBeenCalledWith("startTime", "desc");
  });

  it("adds userId constraint when a provider is selected", async () => {
    mockGetCollection.mockImplementation((collectionName: string) => {
      if (collectionName === "users") {
        return Promise.resolve([
          {
            id: "provider-1",
            role: "provider",
            displayName: "Prov One",
            email: "p1@test.com",
          },
        ]);
      }
      if (collectionName === "locations") {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const user = userEvent.setup();
    await renderReports();

    await user.click(screen.getByLabelText("Provider"));
    await user.click(await screen.findByRole("option", { name: "Prov One" }));

    await waitFor(() => {
      expect(firestore.where).toHaveBeenCalledWith(
        "userId",
        "==",
        "provider-1"
      );
    });
  });

  it("shows a clear message when Firestore requires a composite index", async () => {
    (firestore.getDocs as jest.Mock).mockRejectedValueOnce(
      new FirebaseError("failed-precondition", "query requires an index")
    );

    render(<SessionReports />);

    await waitFor(() => {
      expect(
        screen.getByText(/composite index/i)
      ).toBeInTheDocument();
    });
  });

  it("displays admin users as 'Admin (...)' label in session table", async () => {
    const mockUsers = [
      { id: "admin-1", role: "admin", displayName: "Admin User", email: "admin@test.com" },
      { id: "provider-1", role: "provider", displayName: "Prov One", email: "p1@test.com" },
    ];
    const mockSessions = [
      {
        id: "session-a1",
        data: () => ({
          userId: "admin-1",
          status: "completed",
          startTime: { toDate: () => new Date(), toMillis: () => Date.now() },
        }),
      },
    ];

    mockGetCollection.mockImplementation((collectionName: string) => {
      if (collectionName === "users") return Promise.resolve(mockUsers);
      if (collectionName === "locations") return Promise.resolve([{ id: "loc-1", name: "School One" }]);
      return Promise.resolve([]);
    });
    (firestore.getDocs as jest.Mock).mockResolvedValue({ docs: mockSessions });

    render(<SessionReports />);

    await waitFor(() => {
      expect(screen.getByText("Admin (Admin User)")).toBeInTheDocument();
    });
  });

  it("excludes admin users from provider filter dropdown", async () => {
    const mockUsers = [
      { id: "admin-1", role: "admin", displayName: "Admin User", email: "admin@test.com" },
      { id: "provider-1", role: "provider", displayName: "Prov One", email: "p1@test.com" },
    ];

    mockGetCollection.mockImplementation((collectionName: string) => {
      if (collectionName === "users") return Promise.resolve(mockUsers);
      if (collectionName === "locations") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const user = userEvent.setup();
    render(<SessionReports />);

    await screen.findByText("Session Data (0 sessions)");

    await user.click(screen.getByLabelText("Provider"));

    expect(await screen.findByRole("option", { name: "Prov One" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Admin/ })).not.toBeInTheDocument();
  });
});
