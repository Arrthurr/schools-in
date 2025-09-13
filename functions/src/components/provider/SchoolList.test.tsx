import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SchoolList } from "./SchoolList";
import * as useAuthModule from "../../lib/hooks/useAuth";
import * as useLocationModule from "../../lib/hooks/useLocation";
import * as SchoolServiceModule from "../../lib/services/schoolService";

// Mock the modules
jest.mock("../../lib/hooks/useAuth");
jest.mock("../../lib/hooks/useLocation");
jest.mock("../../lib/services/schoolService");

const mockUseAuth = jest.spyOn(useAuthModule, "useAuth");
const mockUseLocation = jest.spyOn(useLocationModule, "useLocation");
const mockSchoolService = SchoolServiceModule.SchoolService as jest.Mocked<
  typeof SchoolServiceModule.SchoolService
>;

const mockSchools = [
  {
    id: "school-1",
    name: "Walter Payton HS",
    latitude: 41.90191443941818,
    longitude: -87.63472443763325,
    address: "Walter Payton HS Location",
    radius: 100,
    isAssigned: true,
    distance: 50,
  },
  {
    id: "school-2",
    name: "Estrella Foothills HS",
    latitude: 33.32774730573383,
    longitude: -112.42321335568697,
    address: "Estrella Foothills HS Location",
    radius: 100,
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

    mockSchoolService.getAssignedSchools = jest
      .fn()
      .mockResolvedValue(mockSchools);
    mockSchoolService.searchSchools = jest.fn().mockResolvedValue(mockSchools);
    mockSchoolService.isWithinRadius = jest.fn().mockReturnValue(true);
    mockSchoolService.getSchoolsWithDistance = jest
      .fn()
      .mockResolvedValue(mockSchools);
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
    mockSchoolService.getAssignedSchools = jest.fn().mockResolvedValue([]);

    render(<SchoolList />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No schools assigned yet. Contact your administrator to get started.",
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
      expect(screen.getByText("50m away")).toBeInTheDocument();
    });
  });

  it("shows check-in buttons when enabled", async () => {
    render(<SchoolList showCheckInButtons={true} />);

    await waitFor(() => {
      const checkInButtons = screen.getAllByRole("button", {
        name: /check in/i,
      });
      expect(checkInButtons.length).toBeGreaterThan(0);
    });
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
        screen.getByRole("button", { name: /get location/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    mockSchoolService.getAssignedSchools = jest.fn().mockImplementation(
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
