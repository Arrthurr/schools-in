/**
 * Tests for SessionNotesList component
 *
 * Covers loading, empty state, rendering sessions, click-to-edit,
 * keyboard accessibility, save/cancel flow, location name hydration,
 * and load-more pagination.
 */

import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { getDocs, getDoc } from "firebase/firestore";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("../../../firebase.config", () => ({
  db: {},
}));

jest.mock("@/lib/firebase/firestore", () => ({
  COLLECTIONS: { SESSIONS: "sessions", LOCATIONS: "locations" },
}));

const mockUpdateNote = jest.fn();

jest.mock("@/lib/hooks/useCachedAuth", () => ({
  useCachedAuth: jest.fn(() => ({
    user: { uid: "user-1", email: "test@example.com", role: "provider" },
    loading: false,
  })),
}));

jest.mock("@/lib/hooks/useSession", () => ({
  useSession: jest.fn(() => ({ updateNote: mockUpdateNote })),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  startAfter: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock("@/lib/utils/time", () => ({
  formatShortDate: jest.fn(() => "Mar 24"),
  formatShortTime: jest.fn(() => "9:00 AM"),
}));

// Import component AFTER mocks
import { SessionNotesList } from "./SessionNotesList";

const mockGetDocs = getDocs as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data, exists: () => true };
}

function makeSnapshot(docs: ReturnType<typeof makeFakeDoc>[]) {
  return { docs, empty: docs.length === 0 };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SessionNotesList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: "loc-1",
      data: () => ({ name: "Lincoln Elementary" }),
    });
  });

  it("shows loading spinner initially", () => {
    // getDocs never resolves → stays in loading state
    mockGetDocs.mockReturnValue(new Promise(() => {}));
    render(<SessionNotesList />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no sessions", async () => {
    mockGetDocs.mockResolvedValue(makeSnapshot([]));

    render(<SessionNotesList />);

    await waitFor(() => {
      expect(screen.getByText("No sessions yet")).toBeInTheDocument();
    });
  });

  it("renders existing session notes", async () => {
    mockGetDocs.mockResolvedValue(
      makeSnapshot([
        makeFakeDoc("s1", {
          locationId: "loc-1",
          startTime: { seconds: 1742817600 },
          status: "completed",
          notes: "My session note",
        }),
      ])
    );

    render(<SessionNotesList />);

    await waitFor(() => {
      expect(screen.getByText("My session note")).toBeInTheDocument();
    });
  });

  it("renders 'Click to add a note...' when note is empty", async () => {
    mockGetDocs.mockResolvedValue(
      makeSnapshot([
        makeFakeDoc("s2", {
          locationId: "loc-1",
          startTime: { seconds: 1742817600 },
          status: "active",
        }),
      ])
    );

    render(<SessionNotesList />);

    await waitFor(() => {
      expect(screen.getByText("Click to add a note...")).toBeInTheDocument();
    });
  });

  it("enters edit mode on click", async () => {
    mockGetDocs.mockResolvedValue(
      makeSnapshot([
        makeFakeDoc("s1", {
          locationId: "loc-1",
          startTime: { seconds: 1742817600 },
          status: "completed",
          notes: "Editable note",
        }),
      ])
    );

    render(<SessionNotesList />);

    await waitFor(() => {
      expect(screen.getByText("Editable note")).toBeInTheDocument();
    });

    const noteRow = screen.getByText("Editable note").closest("[role='button']")!;
    fireEvent.click(noteRow);

    await waitFor(() => {
      expect(screen.getByLabelText("Session note")).toBeInTheDocument();
    });
  });

  it("enters edit mode via keyboard Enter", async () => {
    mockGetDocs.mockResolvedValue(
      makeSnapshot([
        makeFakeDoc("s1", {
          locationId: "loc-1",
          startTime: { seconds: 1742817600 },
          status: "completed",
          notes: "Keyboard note",
        }),
      ])
    );

    render(<SessionNotesList />);

    await waitFor(() => {
      expect(screen.getByText("Keyboard note")).toBeInTheDocument();
    });

    const noteRow = screen.getByText("Keyboard note").closest("[role='button']")!;
    fireEvent.keyDown(noteRow, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByLabelText("Session note")).toBeInTheDocument();
    });
  });

  it("exits edit mode on cancel", async () => {
    mockGetDocs.mockResolvedValue(
      makeSnapshot([
        makeFakeDoc("s1", {
          locationId: "loc-1",
          startTime: { seconds: 1742817600 },
          status: "completed",
          notes: "Cancel test",
        }),
      ])
    );

    render(<SessionNotesList />);

    await waitFor(() => {
      expect(screen.getByText("Cancel test")).toBeInTheDocument();
    });

    // Enter edit mode
    fireEvent.click(screen.getByText("Cancel test").closest("[role='button']")!);

    await waitFor(() => {
      expect(screen.getByLabelText("Session note")).toBeInTheDocument();
    });

    // Click cancel
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Session note")).not.toBeInTheDocument();
      expect(screen.getByText("Cancel test")).toBeInTheDocument();
    });
  });

  it("saves note, updates displayed text, and exits edit mode", async () => {
    mockGetDocs.mockResolvedValue(
      makeSnapshot([
        makeFakeDoc("s1", {
          locationId: "loc-1",
          startTime: { seconds: 1742817600 },
          status: "completed",
          notes: "Old note",
        }),
      ])
    );
    mockUpdateNote.mockResolvedValue(true);

    render(<SessionNotesList />);

    await waitFor(() => {
      expect(screen.getByText("Old note")).toBeInTheDocument();
    });

    // Enter edit mode
    fireEvent.click(screen.getByText("Old note").closest("[role='button']")!);

    await waitFor(() => {
      expect(screen.getByLabelText("Session note")).toBeInTheDocument();
    });

    // Change the note and save
    const textarea = screen.getByLabelText("Session note");
    fireEvent.change(textarea, { target: { value: "Updated note" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save note/i }));
    });

    expect(mockUpdateNote).toHaveBeenCalledWith("s1", "Updated note");

    // Should exit edit mode and show updated text
    await waitFor(() => {
      expect(screen.queryByLabelText("Session note")).not.toBeInTheDocument();
      expect(screen.getByText("Updated note")).toBeInTheDocument();
    });
  });

  it("stays in edit mode when save fails", async () => {
    mockGetDocs.mockResolvedValue(
      makeSnapshot([
        makeFakeDoc("s1", {
          locationId: "loc-1",
          startTime: { seconds: 1742817600 },
          status: "completed",
          notes: "Fail save",
        }),
      ])
    );
    mockUpdateNote.mockResolvedValue(false);

    render(<SessionNotesList />);

    await waitFor(() => {
      expect(screen.getByText("Fail save")).toBeInTheDocument();
    });

    // Enter edit mode
    fireEvent.click(screen.getByText("Fail save").closest("[role='button']")!);

    await waitFor(() => {
      expect(screen.getByLabelText("Session note")).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText("Session note");
    fireEvent.change(textarea, { target: { value: "New text" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save note/i }));
    });

    // Should stay in edit mode
    expect(screen.getByLabelText("Session note")).toBeInTheDocument();
  });

  it("loads and displays location names", async () => {
    mockGetDocs.mockResolvedValue(
      makeSnapshot([
        makeFakeDoc("s1", {
          locationId: "loc-1",
          startTime: { seconds: 1742817600 },
          status: "completed",
          notes: "Note",
        }),
      ])
    );

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: "loc-1",
      data: () => ({ name: "Washington High" }),
    });

    render(<SessionNotesList />);

    await waitFor(() => {
      expect(screen.getByText("Washington High")).toBeInTheDocument();
    });
  });

  it("shows load more button when hasMore is true", async () => {
    // Return PAGE_SIZE + 1 docs to trigger hasMore
    const docs = Array.from({ length: 21 }, (_, i) =>
      makeFakeDoc(`s${i}`, {
        locationId: "loc-1",
        startTime: { seconds: 1742817600 - i * 3600 },
        status: "completed",
        notes: `Note ${i}`,
      })
    );
    mockGetDocs.mockResolvedValue(makeSnapshot(docs));

    render(<SessionNotesList />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });
  });
});
