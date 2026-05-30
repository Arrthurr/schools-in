/**
 * AttendanceSummary.test.tsx — TDD rewrite for Task 2
 *
 * Tests aggregation using locationId (canonical), admin labelling,
 * durationMinutes priority, and provider-pool exclusivity.
 *
 * RED phase: all new assertions should fail with the current implementation.
 * After the refactor, they pass.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttendanceSummary } from "./AttendanceSummary";
import { Timestamp } from "firebase/firestore";

// ── Mock firestore ──────────────────────────────────────────────
jest.mock("../../lib/firebase/firestore", () => ({
  getCollection: jest.fn(),
  COLLECTIONS: {
    USERS: "users",
    SESSIONS: "sessions",
    LOCATIONS: "locations",
  },
}));

import { getCollection } from "@/lib/firebase/firestore";
const mockGetCollection = getCollection as jest.MockedFunction<
  typeof getCollection
>;

// ── Mock session utils (real helpers, display stub) ─────────────
jest.mock("../../lib/utils/session", () => {
  const actual = jest.requireActual("../../lib/utils/session");
  return {
    ...actual,
    formatDuration: jest.fn((minutes: number) => `${minutes}m`),
  };
});

// ── Mock Recharts (unused by AttendanceSummary but may be hoisted) ─
jest.mock("recharts", () => ({}));

// ==================== Test Fixtures =============================

// Use current month so the default "month" date-range filter
// naturally includes these sessions.
const now = new Date();
const y = now.getFullYear();
const m = now.getMonth(); // 0-indexed

const testLocations = [
  { id: "school-a", name: "Alpha School", address: "123 Alpha St" },
  { id: "school-b", name: "Beta School", address: "456 Beta Ave" },
  { id: "school-c", name: "Gamma School", address: "789 Gamma Blvd" },
];

const testUsers = [
  {
    id: "provider-1",
    email: "alice@test.com",
    displayName: "Alice Provider",
    role: "provider",
  },
  {
    id: "provider-2",
    email: "bob@test.com",
    displayName: "Bob Provider",
    role: "provider",
  },
  {
    id: "admin-1",
    email: "admin@example.com",
    displayName: "Admin User",
    role: "admin",
  },
];

/**
 * All sessions use `locationId` (the canonical field).
 * `schoolId` is deliberately absent — mimicking newer Cloud Function–written
 * sessions that don't carry the legacy field.
 */
const testSessions = [
  // ── provider-1, school-a ──────────────────────────────────
  {
    id: "s1",
    userId: "provider-1",
    locationId: "school-a",
    status: "completed",
    checkInTime: Timestamp.fromDate(new Date(y, m, 15, 8, 0)),
    checkOutTime: Timestamp.fromDate(new Date(y, m, 15, 9, 30)),
  },
  // ── provider-1, school-b ──────────────────────────────────
  {
    id: "s2",
    userId: "provider-1",
    locationId: "school-b",
    status: "completed",
    checkInTime: Timestamp.fromDate(new Date(y, m, 15, 11, 0)),
    checkOutTime: Timestamp.fromDate(new Date(y, m, 15, 12, 30)),
  },
  // ── provider-1, school-c ──────────────────────────────────
  {
    id: "s3",
    userId: "provider-1",
    locationId: "school-c",
    status: "completed",
    checkInTime: Timestamp.fromDate(new Date(y, m, 15, 14, 0)),
    checkOutTime: Timestamp.fromDate(new Date(y, m, 15, 15, 0)),
  },
  // ── provider-2, school-a ──────────────────────────────────
  {
    id: "s4",
    userId: "provider-2",
    locationId: "school-a",
    status: "completed",
    checkInTime: Timestamp.fromDate(new Date(y, m, 16, 9, 0)),
    checkOutTime: Timestamp.fromDate(new Date(y, m, 16, 10, 0)),
  },
  // ── admin-1, school-b (manual check-in) ───────────────────
  {
    id: "s5",
    userId: "admin-1",
    locationId: "school-b",
    status: "completed",
    checkInTime: Timestamp.fromDate(new Date(y, m, 16, 11, 0)),
    checkOutTime: Timestamp.fromDate(new Date(y, m, 16, 12, 0)),
    checkInMethod: "manual",
  },
  // ── provider-1, school-a — durationMinutes overrides gap ──
  {
    id: "s6",
    userId: "provider-1",
    locationId: "school-a",
    status: "completed",
    checkInTime: Timestamp.fromDate(new Date(y, m, 17, 8, 0)),
    checkOutTime: Timestamp.fromDate(new Date(y, m, 17, 9, 30)),
    durationMinutes: 120, // auth field, but timestamps only 90 min apart
  },
];

// ==================== Test Suite =================================

// Polyfill hasPointerCapture and scrollIntoView for Radix UI Select in jsdom
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

describe("AttendanceSummary Component", () => {
  const setupMockData = () => {
    mockGetCollection.mockImplementation((collection: string) => {
      switch (collection) {
        case "locations":
          return Promise.resolve(testLocations);
        case "users":
          return Promise.resolve(testUsers);
        case "sessions":
          return Promise.resolve(testSessions);
        default:
          return Promise.resolve([]);
      }
    });
  };

  const renderComponent = async () => {
    await act(async () => {
      render(<AttendanceSummary />);
    });
  };

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    setupMockData();
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  // ────────────── Smoke / Render Tests ───────────────────────

  it("renders attendance summary dashboard with stat cards", async () => {
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

  it("renders apply and reset filter buttons", async () => {
    await renderComponent();

    expect(
      await screen.findByRole("button", { name: "Apply Filters" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset Filters" })
    ).toBeInTheDocument();
  });

  // ────────────── TDD: Aggregation & Filtering ───────────────
  //  Each test below MUST fail (RED) against the current code
  //  and pass (GREEN) after the refactor.

  it("counts provider schools visited from locationId — Alice Provider should have 3 schools", async () => {
    await renderComponent();

    await waitFor(() => {
      // Scope to the provider table to avoid matching "Most Active Provider" in Key Insights
      const providerTable = screen.getByText(/Provider Attendance Summary/)
        .closest("div[class*='rounded-xl']") as HTMLElement;
      const aliceCells = within(providerTable).getAllByText("Alice Provider");
      // First match is the table cell
      const aliceRow = aliceCells[0].closest("tr")!;
      const cells = within(aliceRow).getAllByRole("cell");
      // Column 6 (index 5): Schools Visited
      expect(cells[5]).toHaveTextContent("3");
    });
  });

  it("school coverage table shows Alpha/Beta/Gamma — no 'Unknown School'", async () => {
    await renderComponent();

    await waitFor(() => {
      // Scope to the school coverage table to avoid "Most Visited School" in Key Insights
      const schoolCard = screen.getByText(/School Coverage Summary/)
        .closest("div[class*='rounded-xl']") as HTMLElement;
      expect(within(schoolCard).getByText("Alpha School")).toBeInTheDocument();
      expect(within(schoolCard).getByText("Beta School")).toBeInTheDocument();
      expect(within(schoolCard).getByText("Gamma School")).toBeInTheDocument();
    });

    // "Unknown School" must not appear anywhere
    expect(screen.queryByText("Unknown School")).not.toBeInTheDocument();
  });

  it("school filter selecting school-b includes only Beta School sessions", async () => {
    const user = userEvent.setup();
    await renderComponent();

    // Wait for initial data to load — scope to provider table
    await waitFor(() => {
      const providerTable = screen.getByText(/Provider Attendance Summary/)
        .closest("div[class*='rounded-xl']") as HTMLElement;
      expect(within(providerTable).getByText("Alice Provider")).toBeInTheDocument();
    });

    // Open the School select dropdown (Radix Select)
    const schoolTrigger = screen.getByRole("combobox", { name: "School" });
    await user.click(schoolTrigger);

    // Select "Beta School" from the portal dropdown
    const betaOption = await screen.findByRole("option", {
      name: "Beta School",
    });
    await user.click(betaOption);

    // Wait for React to process the state update (select value changes)
    await waitFor(() => {
      const trigger = screen.getByRole("combobox", { name: "School" });
      expect(trigger).toHaveTextContent("Beta School");
    });

    // Click Apply Filters to trigger reload with the new school filter
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));

    // After filtering, only school-b sessions should remain:
    // s2 (provider-1) and s5 (admin-1)
    await waitFor(() => {
      const providerTable = screen.getByText(/Provider Attendance Summary/)
        .closest("div[class*='rounded-xl']") as HTMLElement;
      expect(within(providerTable).getByText("Alice Provider")).toBeInTheDocument();
    });

    // Only Beta School appears in the school coverage table
    const schoolCard = screen.getByText(/School Coverage Summary/)
      .closest("div[class*='rounded-xl']") as HTMLElement;
    expect(within(schoolCard).getByText("Beta School")).toBeInTheDocument();
    expect(within(schoolCard).queryByText("Alpha School")).not.toBeInTheDocument();
    expect(within(schoolCard).queryByText("Gamma School")).not.toBeInTheDocument();
  });

  it("labels admin sessions as 'Admin (displayName)' not 'Unknown Provider'", async () => {
    await renderComponent();

    await waitFor(() => {
      // Admin row should exist with the correct label (displayName preferred over email)
      expect(
        screen.getByText("Admin (Admin User)")
      ).toBeInTheDocument();
      // The legacy "Unknown Provider" label should never appear
      expect(screen.queryByText("Unknown Provider")).not.toBeInTheDocument();
    });
  });

  it("uses durationMinutes (120) over computed timestamp gap (90)", async () => {
    await renderComponent();

    await waitFor(() => {
      // Scope to provider table to avoid Key Insights match
      const providerTable = screen.getByText(/Provider Attendance Summary/)
        .closest("div[class*='rounded-xl']") as HTMLElement;
      const aliceCells = within(providerTable).getAllByText("Alice Provider");
      const aliceRow = aliceCells[0].closest("tr")!;
      const cells = within(aliceRow).getAllByRole("cell");
      // Column 4 (index 3): Total Duration
      expect(cells[3]).toHaveTextContent("360m");
    });
  });

  it("excludes admin users from provider-pool metrics in overall stats", async () => {
    await renderComponent();

    await waitFor(() => {
      const title = screen.getByText(/Provider Attendance Summary/);
      expect(title.textContent).toMatch(/2 providers/);
      expect(title.textContent).toMatch(/1 admin/);
    });
  });
});
