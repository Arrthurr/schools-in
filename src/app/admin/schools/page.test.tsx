import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import SchoolManagementPage from "./page";

// --- Mocks ---

jest.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock("@/components/admin/AdminNavigation", () => ({
  AdminNavigation: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-nav">{children}</div>
  ),
}));

jest.mock("@/components/admin/SchoolForm", () => ({
  SchoolForm: () => <div data-testid="school-form" />,
}));

const mockGetAllSchools = jest.fn();
jest.mock("@/lib/services/cachedSchoolService", () => ({
  CachedSchoolService: {
    getAllSchools: (...args: unknown[]) => mockGetAllSchools(...args),
  },
}));

const mockGetSchedulesByLocation = jest.fn();
jest.mock("@/lib/services/scheduleService", () => ({
  getSchedulesByLocation: (...args: unknown[]) =>
    mockGetSchedulesByLocation(...args),
}));

jest.mock("@/lib/services/userService", () => ({
  getUserById: jest.fn(),
}));

// --- Helpers ---

function makeSchool(overrides: Record<string, unknown> = {}) {
  return {
    id: "school-1",
    name: "Lincoln Elementary",
    address: "100 Main St",
    latitude: 41.878,
    longitude: -87.63,
    radiusMeters: 300,
    assignedProviders: ["prov-a", "prov-b"],
    ...overrides,
  };
}

function makeSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-1",
    providerId: "prov-a",
    locationId: "school-1",
    dayOfWeek: 1,
    startTime: "08:00",
    endTime: "12:00",
    serviceId: "svc-1",
    isActive: true,
    ...overrides,
  };
}

// --- Tests ---

describe("SchoolManagementPage – session count", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("displays the schedule-based session count on each school card", async () => {
    const schoolA = makeSchool({ id: "school-a", name: "Alpha School" });
    const schoolB = makeSchool({
      id: "school-b",
      name: "Beta School",
      assignedProviders: ["prov-c"],
    });

    mockGetAllSchools.mockResolvedValue([schoolA, schoolB]);

    mockGetSchedulesByLocation.mockImplementation((locationId: string) => {
      if (locationId === "school-a") {
        return Promise.resolve([
          makeSchedule({ id: "s1", locationId: "school-a" }),
          makeSchedule({ id: "s2", locationId: "school-a" }),
          makeSchedule({ id: "s3", locationId: "school-a" }),
        ]);
      }
      if (locationId === "school-b") {
        return Promise.resolve([
          makeSchedule({ id: "s4", locationId: "school-b" }),
        ]);
      }
      return Promise.resolve([]);
    });

    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("Alpha School")).toBeInTheDocument();
    });

    expect(screen.getByText("3 weekly sessions")).toBeInTheDocument();
    expect(screen.getByText("1 weekly sessions")).toBeInTheDocument();
  });

  it("shows 0 weekly sessions when a school has no schedules", async () => {
    mockGetAllSchools.mockResolvedValue([makeSchool()]);
    mockGetSchedulesByLocation.mockResolvedValue([]);

    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("Lincoln Elementary")).toBeInTheDocument();
    });

    expect(screen.getByText("0 weekly sessions")).toBeInTheDocument();
  });

  it("falls back to 0 when getSchedulesByLocation rejects", async () => {
    mockGetAllSchools.mockResolvedValue([makeSchool()]);
    mockGetSchedulesByLocation.mockRejectedValue(new Error("Firestore down"));

    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("Lincoln Elementary")).toBeInTheDocument();
    });

    expect(screen.getByText("0 weekly sessions")).toBeInTheDocument();
  });

  it("displays the correct provider count alongside sessions", async () => {
    mockGetAllSchools.mockResolvedValue([
      makeSchool({ assignedProviders: ["p1", "p2", "p3"] }),
    ]);
    mockGetSchedulesByLocation.mockResolvedValue([makeSchedule()]);

    render(<SchoolManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("3 providers")).toBeInTheDocument();
    });

    expect(screen.getByText("1 weekly sessions")).toBeInTheDocument();
  });
});
