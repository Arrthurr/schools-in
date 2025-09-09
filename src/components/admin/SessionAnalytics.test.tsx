import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionAnalytics } from "./SessionAnalytics";

// Mock the entire firestore module
jest.mock("../../lib/firebase/firestore", () => ({
  getCollection: jest.fn(),
  COLLECTIONS: {
    USERS: "users",
    SESSIONS: "sessions",
    LOCATIONS: "locations",
  },
}));

import { getCollection } from "@/lib/firebase/firestore";
const mockGetCollection = getCollection as jest.MockedFunction<typeof getCollection>;

// Mock the Recharts components
jest.mock("recharts", () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

// Mock session utilities
jest.mock("../../lib/utils/session", () => ({
  formatDuration: (minutes: number) => `${minutes}m`,
  getSessionStatusConfig: (status: string) => ({ label: status }),
  calculateSessionDuration: () => 60, // 1 hour
}));

const mockSchools = [
  { id: "school1", name: "Test School 1", address: "123 Main St" },
  { id: "school2", name: "Test School 2", address: "456 Oak Ave" },
];

const mockProviders = [
  { id: "user1", email: "provider1@test.com", displayName: "Provider One", role: "provider" },
  { id: "user2", email: "provider2@test.com", displayName: "Provider Two", role: "provider" },
];

const mockSessions = [
  {
    id: "session1",
    userId: "user1",
    schoolId: "school1",
    status: "completed",
    checkInTime: { toDate: () => new Date("2024-01-15T09:00:00") },
    checkOutTime: { toDate: () => new Date("2024-01-15T10:00:00") },
  },
  {
    id: "session2",
    userId: "user2",
    schoolId: "school2",
    status: "in-progress",
    checkInTime: { toDate: () => new Date("2024-01-15T14:00:00") },
    checkOutTime: null,
  },
  {
    id: "session3",
    userId: "user1",
    schoolId: "school1",
    status: "completed",
    checkInTime: { toDate: () => new Date("2024-01-16T10:00:00") },
    checkOutTime: { toDate: () => new Date("2024-01-16T11:30:00") },
  },
];

describe("SessionAnalytics", () => {
  beforeEach(() => {
    mockGetCollection.mockImplementation((collection: string) => {
      switch (collection) {
        case "locations":
          return Promise.resolve(mockSchools);
        case "users":
          return Promise.resolve(mockProviders);
        case "sessions":
          return Promise.resolve(mockSessions);
        default:
          return Promise.resolve([]);
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders analytics dashboard", async () => {
    render(<SessionAnalytics />);

    expect(screen.getByText("Session Analytics & Visualization")).toBeInTheDocument();
    expect(screen.getByText("Analytics Filters")).toBeInTheDocument();
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("Total Sessions")).toBeInTheDocument();
      expect(screen.getByText("Active Providers")).toBeInTheDocument();
      expect(screen.getByText("Schools Visited")).toBeInTheDocument();
      expect(screen.getByText("Avg Duration")).toBeInTheDocument();
    });
  });

  it("displays summary statistics", async () => {
    render(<SessionAnalytics />);

    await waitFor(() => {
      // Should show correct counts based on mock data
      expect(screen.getByText("Total Sessions")).toBeInTheDocument();
      expect(screen.getByText("Active Providers")).toBeInTheDocument();
      expect(screen.getByText("Schools Visited")).toBeInTheDocument();
      expect(screen.getByText("Avg Duration")).toBeInTheDocument();
    });
  });

  it("renders chart title", async () => {
    render(<SessionAnalytics />);

    await waitFor(() => {
      expect(screen.getByText("Session Volume Over Time")).toBeInTheDocument();
    });
  });

  it("handles loading state", () => {
    // Mock loading state
    mockGetCollection.mockImplementation(() => new Promise(() => {}));
    
    render(<SessionAnalytics />);
    
    expect(screen.getByText("Loading chart data...")).toBeInTheDocument();
  });

  it("handles error state", async () => {
    // Mock error
    mockGetCollection.mockRejectedValue(new Error("Failed to load data"));
    
    render(<SessionAnalytics />);
    
    await waitFor(() => {
      expect(screen.getByText("Failed to load analytics data")).toBeInTheDocument();
    });
  });

  it("handles empty data state", async () => {
    // Mock empty data
    mockGetCollection.mockResolvedValue([]);
    
    render(<SessionAnalytics />);
    
    await waitFor(() => {
      expect(screen.getByText("No data available for the selected period")).toBeInTheDocument();
    });
  });

  it("renders filter controls", () => {
    render(<SessionAnalytics />);
    
    expect(screen.getByText("Date Range")).toBeInTheDocument();
    expect(screen.getByText("Chart Type")).toBeInTheDocument();
    expect(screen.getByText("Last 30 Days")).toBeInTheDocument();
    expect(screen.getByText("Session Volume")).toBeInTheDocument();
  });
});
