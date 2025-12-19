import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { SchoolList } from "./SchoolList";
import * as useAuthModule from "../../lib/hooks/useAuth";
import * as useLocationModule from "../../lib/hooks/useLocation";
import * as LocationServiceModule from "../../lib/services/locationService";
import * as useSessionModule from "../../lib/hooks/useSession";

// Mock the modules
jest.mock("../../lib/hooks/useAuth");
jest.mock("../../lib/hooks/useLocation");
jest.mock("../../lib/services/locationService");
jest.mock("../../lib/hooks/useSession");

const mockUseAuth = jest.spyOn(useAuthModule, "useAuth");
const mockUseLocation = jest.spyOn(useLocationModule, "useLocation");
const mockLocationService = LocationServiceModule as jest.Mocked<
  typeof LocationServiceModule
>;
const mockUseSession = jest.spyOn(useSessionModule, "useSession");

const mockSchools = [
  {
    id: "school-1",
    name: "Walter Payton HS",
    latitude: 41.90191443941818,
    longitude: -87.63472443763325,
    address: "Walter Payton HS Location",
    radiusMeters: 100,
    isAssigned: true,
    distance: 50,
  },
  {
    id: "school-2",
    name: "Estrella Foothills HS",
    latitude: 33.32774730573383,
    longitude: -112.42321335568697,
    address: "Estrella Foothills HS Location",
    radiusMeters: 100,
    isAssigned: true,
    distance: 150,
  },
];

const mockUser = {
  uid: "user-123",
  email: "provider@test.com",
  displayName: "Test Provider",
  role: "provider" as const,
};

const mockLocation = {
  latitude: 41.90191443941818,
  longitude: -87.63472443763325,
};

describe("SchoolList Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
    });

    mockUseLocation.mockReturnValue({
      location: mockLocation,
      loading: false,
      error: null,
      getLocation: jest.fn(),
      clearError: jest.fn(),
    });

    mockUseSession.mockReturnValue({
      checkIn: jest.fn(),
      currentSession: null,
      loading: false,
    } as any);

    mockLocationService.getAssignedLocations.mockResolvedValue(mockSchools as any);
    mockLocationService.addDistances.mockImplementation((schools) => schools as any);
    mockLocationService.sortByDistance.mockImplementation((schools) => schools as any);
    mockLocationService.calculateDistance.mockReturnValue(50);
  });

  it("renders school list when schools are loaded", async () => {
    render(<SchoolList />);

    await waitFor(() => {
      expect(screen.getByText("Walter Payton HS")).toBeInTheDocument();
      expect(screen.getByText("Estrella Foothills HS")).toBeInTheDocument();
    });

    expect(screen.getByText("2 schools assigned")).toBeInTheDocument();
  });

  it("renders empty state when no schools assigned", async () => {
    mockLocationService.getAssignedLocations.mockResolvedValue([]);

    render(<SchoolList />);

    await waitFor(() => {
      expect(mockLocationService.getAssignedLocations).toHaveBeenCalled();
    });

    await expect(
      mockLocationService.getAssignedLocations.mock.results[0]?.value,
    ).resolves.toEqual([]);

    await waitFor(() => {
      expect(
        screen.getByText(
          "You don't have any schools assigned yet. Contact your administrator to get access to schools.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows search functionality", async () => {
    render(<SchoolList />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Search schools..."),
      ).toBeInTheDocument();
    });
  });

  it("shows distance when available", async () => {
    render(<SchoolList />);

    await waitFor(() => {
      expect(screen.getByText(/assigned schools/i)).toBeInTheDocument();
    });

    const distanceBadges = screen.getAllByText(/away/);
    expect(distanceBadges.length).toBeGreaterThan(0);
  });

  it("shows check-in buttons when explicitly enabled", async () => {
    render(<SchoolList showCheckInButtons={true} />);

    await waitFor(() => {
      const checkInButtons = screen.getAllByRole("button", {
        name: /check in/i,
      });
      expect(checkInButtons.length).toBeGreaterThan(0);
    });
  });

  it("does not show check-in buttons when showCheckInButtons is false (provider auto mode)", async () => {
    render(<SchoolList showCheckInButtons={false} />);

    await waitFor(() => {
      expect(screen.getByText("Walter Payton HS")).toBeInTheDocument();
    });

    // Should not find any check-in buttons
    const checkInButtons = screen.queryAllByRole("button", {
      name: /check in/i,
    });
    expect(checkInButtons.length).toBe(0);
  });

  it("does not show check-in buttons by default", async () => {
    render(<SchoolList />);

    await waitFor(() => {
      expect(screen.getByText("Walter Payton HS")).toBeInTheDocument();
    });

    // Default behavior should not show check-in buttons (for providers using auto mode)
    const checkInButtons = screen.queryAllByRole("button", {
      name: /check in/i,
    });
    expect(checkInButtons.length).toBe(0);
  });

  it("handles search input", async () => {
    render(<SchoolList />);

    await waitFor(() => {
      expect(screen.getByText("Walter Payton HS")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search schools...");
    fireEvent.change(searchInput, { target: { value: "Walter" } });

    // Just verify the input value changed
    expect(searchInput).toHaveValue("Walter");
  });

  it("handles missing location gracefully", async () => {
    mockUseLocation.mockReturnValue({
      location: null,
      loading: false,
      error: null,
      getLocation: jest.fn(),
      clearError: jest.fn(),
    });

    render(<SchoolList />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /enable location/i })
      ).toBeInTheDocument();
    });
  });

  it("shows error state when assignments fail to load", async () => {
    mockLocationService.getAssignedLocations.mockRejectedValueOnce(
      new Error("Network down")
    );

    render(<SchoolList />);

    const errorMessages = await screen.findAllByText(/failed to load schools/i);
    expect(errorMessages.length).toBeGreaterThan(0);
  });

  it("shows empty search state when no schools match query", async () => {
    jest.useFakeTimers();
    render(<SchoolList />);

    await waitFor(() => {
      expect(screen.getByText("Walter Payton HS")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search schools...");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    act(() => {
      jest.runAllTimers();
    });

    expect(
      await screen.findByText(/no schools found/i)
    ).toBeInTheDocument();

    jest.useRealTimers();
  });

  it("shows loading state initially", () => {
    mockLocationService.getAssignedLocations.mockImplementationOnce(
      () => new Promise(() => {}), // Never resolves
    );

    render(<SchoolList />);

    expect(
      screen.getByText("Loading your school assignments..."),
    ).toBeInTheDocument();
  });

  it("calls onSchoolSelect when school is clicked", async () => {
    const mockOnSchoolSelect = jest.fn();
    render(<SchoolList onSchoolSelect={mockOnSchoolSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Walter Payton HS")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Walter Payton HS"));
    expect(mockOnSchoolSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Walter Payton HS",
      }),
    );
  });
});
