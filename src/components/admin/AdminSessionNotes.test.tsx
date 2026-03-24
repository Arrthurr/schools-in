/**
 * Tests for AdminSessionNotes component
 *
 * Covers loading state, empty table, rendering rows, name hydration,
 * dialog open/close, timestamp fallback, refresh, and load-more.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { getDocs } from "firebase/firestore";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("../../../firebase.config", () => ({ db: {} }));

jest.mock("@/lib/firebase/firestore", () => ({
  COLLECTIONS: { SESSIONS: "sessions", LOCATIONS: "locations" },
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  startAfter: jest.fn(),
}));

jest.mock("@/lib/logging/appLogger", () => ({
  appLogger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock("@/lib/utils/time", () => ({
  formatShortDate: jest.fn(() => "Mar 24"),
  formatRelativeTime: jest.fn((ts: any) =>
    ts ? "2h ago" : ""
  ),
}));

const mockGetDocs = getDocs as jest.Mock;

// Import AFTER mocks
import { AdminSessionNotes } from "./AdminSessionNotes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data, ref: { id } };
}

function makeSnapshot(docs: ReturnType<typeof makeFakeDoc>[]) {
  return { docs, empty: docs.length === 0 };
}

const SESSION_DATA = {
  userId: "prov-1",
  locationId: "loc-1",
  startTime: { seconds: 1742817600 },
  status: "completed",
  notes: "Test note from provider",
  hasNotes: true,
  notesUpdatedAt: { seconds: 1742821200 },
  updatedAt: { seconds: 1742817600 },
};

// Setup getDocs to return sessions first, then user/location batches
function setupDefaultMocks(sessionDocs: ReturnType<typeof makeFakeDoc>[] = []) {
  let callCount = 0;
  mockGetDocs.mockImplementation(() => {
    callCount++;
    // First call: sessions query
    if (callCount === 1) {
      return Promise.resolve(makeSnapshot(sessionDocs));
    }
    // Second call: users batch
    if (callCount === 2) {
      return Promise.resolve(
        makeSnapshot([
          makeFakeDoc("prov-1", { displayName: "Jane Doe", email: "jane@test.com" }),
        ])
      );
    }
    // Third call: locations batch
    if (callCount === 3) {
      return Promise.resolve(
        makeSnapshot([makeFakeDoc("loc-1", { name: "Lincoln Elementary" })])
      );
    }
    return Promise.resolve(makeSnapshot([]));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AdminSessionNotes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    mockGetDocs.mockReturnValue(new Promise(() => {}));
    render(<AdminSessionNotes />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty table when no note sessions", async () => {
    setupDefaultMocks([]);
    render(<AdminSessionNotes />);

    await waitFor(() => {
      expect(screen.getByText("No session notes found.")).toBeInTheDocument();
    });
  });

  it("renders rows for sessions with notes", async () => {
    setupDefaultMocks([makeFakeDoc("s1", SESSION_DATA)]);
    render(<AdminSessionNotes />);

    await waitFor(() => {
      expect(screen.getByText("Test note from provider")).toBeInTheDocument();
    });
  });

  it("hydrates provider names", async () => {
    setupDefaultMocks([makeFakeDoc("s1", SESSION_DATA)]);
    render(<AdminSessionNotes />);

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });
  });

  it("hydrates location names", async () => {
    setupDefaultMocks([makeFakeDoc("s1", SESSION_DATA)]);
    render(<AdminSessionNotes />);

    await waitFor(() => {
      expect(screen.getByText("Lincoln Elementary")).toBeInTheDocument();
    });
  });

  it("opens detail dialog on row click", async () => {
    setupDefaultMocks([makeFakeDoc("s1", SESSION_DATA)]);
    render(<AdminSessionNotes />);

    await waitFor(() => {
      expect(screen.getByText("Test note from provider")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test note from provider").closest("tr")!);

    await waitFor(() => {
      expect(screen.getByText("Session Note")).toBeInTheDocument();
    });
  });

  it("dialog shows full note and metadata", async () => {
    setupDefaultMocks([makeFakeDoc("s1", SESSION_DATA)]);
    render(<AdminSessionNotes />);

    await waitFor(() => {
      expect(screen.getByText("Test note from provider")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test note from provider").closest("tr")!);

    await waitFor(() => {
      // Dialog title
      expect(screen.getByText("Session Note")).toBeInTheDocument();
      // The dialog should contain the note text in a pre-wrap block
      const dialogs = document.querySelectorAll("[role='dialog']");
      expect(dialogs.length).toBeGreaterThan(0);
      const dialogEl = dialogs[0];
      expect(dialogEl.textContent).toContain("Test note from provider");
      expect(dialogEl.textContent).toContain("Jane Doe");
      expect(dialogEl.textContent).toContain("Lincoln Elementary");
    });
  });

  it("uses notesUpdatedAt when present for relative time", async () => {
    const { formatRelativeTime } = jest.requireMock("@/lib/utils/time");
    setupDefaultMocks([makeFakeDoc("s1", SESSION_DATA)]);
    render(<AdminSessionNotes />);

    await waitFor(() => {
      expect(screen.getByText("Test note from provider")).toBeInTheDocument();
    });

    // formatRelativeTime should have been called with notesUpdatedAt
    expect(formatRelativeTime).toHaveBeenCalledWith(SESSION_DATA.notesUpdatedAt);
  });

  it("falls back to updatedAt when notesUpdatedAt is absent", async () => {
    const { formatRelativeTime } = jest.requireMock("@/lib/utils/time");
    const sessionWithoutNotesTimestamp = {
      ...SESSION_DATA,
      notesUpdatedAt: undefined,
    };

    setupDefaultMocks([makeFakeDoc("s1", sessionWithoutNotesTimestamp)]);
    render(<AdminSessionNotes />);

    await waitFor(() => {
      expect(screen.getByText("Test note from provider")).toBeInTheDocument();
    });

    // Should fall back to updatedAt
    expect(formatRelativeTime).toHaveBeenCalledWith(SESSION_DATA.updatedAt);
  });

  it("refresh button reloads sessions", async () => {
    setupDefaultMocks([makeFakeDoc("s1", SESSION_DATA)]);
    render(<AdminSessionNotes />);

    await waitFor(() => {
      expect(screen.getByText("Test note from provider")).toBeInTheDocument();
    });

    // Reset mock for the refresh call
    setupDefaultMocks([
      makeFakeDoc("s1", { ...SESSION_DATA, notes: "Refreshed note" }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(screen.getByText("Refreshed note")).toBeInTheDocument();
    });
  });

  it("shows error state when Firestore query fails", async () => {
    mockGetDocs.mockRejectedValue(new Error("Missing index: please create a composite index"));
    render(<AdminSessionNotes />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load session notes")).toBeInTheDocument();
      expect(screen.getByText("Check the browser console or Firebase logs for details.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  it("retry button re-issues the query and clears error on success", async () => {
    mockGetDocs
      .mockRejectedValueOnce(new Error("Missing index"))
      .mockImplementation(() => Promise.resolve(makeSnapshot([])));

    render(<AdminSessionNotes />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() =>
      expect(screen.queryByText("Failed to load session notes")).not.toBeInTheDocument()
    );

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });

  it("shows load more button when hasMore is true", async () => {
    // Return PAGE_SIZE + 1 docs to trigger hasMore
    const docs = Array.from({ length: 26 }, (_, i) =>
      makeFakeDoc(`s${i}`, {
        ...SESSION_DATA,
        notes: `Note ${i}`,
        userId: "prov-1",
        locationId: "loc-1",
      })
    );
    setupDefaultMocks(docs);
    render(<AdminSessionNotes />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });
  });
});
