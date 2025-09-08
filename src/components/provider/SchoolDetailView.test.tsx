import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SchoolDetailView } from "./SchoolDetailView";
import * as useLocationModule from "../../lib/hooks/useLocation";
import * as SchoolServiceModule from "../../lib/services/schoolService";

// Mock the modules
jest.mock("../../lib/hooks/useLocation");
jest.mock("../../lib/services/schoolService");

const mockUseLocation = jest.spyOn(useLocationModule, "useLocation");
const mockSchoolService = SchoolServiceModule.SchoolService as jest.Mocked<
  typeof SchoolServiceModule.SchoolService
>;

const mockSchool = {
  id: "school-1",
  name: "Walter Payton High School",
  latitude: 41.90191443941818,
  longitude: -87.63472443763325,
  address: "1034 N Wells St, Chicago, IL 60610",
  radius: 100,
  isAssigned: true,
  distance: 50,
};

const mockLocation = {
  latitude: 41.90191443941818,
  longitude: -87.63472443763325,
};

describe("SchoolDetailView Component", () => {
  const mockOnBack = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnCheckIn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseLocation.mockReturnValue({
      location: mockLocation,
      loading: false,
      error: null,
      getLocation: jest.fn(),
      clearError: jest.fn(),
    });

    mockSchoolService.calculateDistance = jest.fn().mockReturnValue(50);
    mockSchoolService.isWithinRadius = jest.fn().mockReturnValue(true);
  });

  it("renders school details correctly", () => {
    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    expect(screen.getByText("Walter Payton High School")).toBeInTheDocument();
    expect(screen.getByText("1034 N Wells St, Chicago, IL 60610")).toBeInTheDocument();
    expect(screen.getByText("100 meters")).toBeInTheDocument();
  });

  it("shows back button and calls onBack when clicked", () => {
    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    const backButton = screen.getByRole("button", { name: /back to list/i });
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);
    expect(mockOnBack).toHaveBeenCalled();
  });

  it("shows close button when onClose is provided", () => {
    render(
      <SchoolDetailView
        school={mockSchool}
        onBack={mockOnBack}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByRole("button", { name: "" }); // X button has no text
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("shows check-in button when showCheckInButton is true", () => {
    render(
      <SchoolDetailView
        school={mockSchool}
        onBack={mockOnBack}
        showCheckInButton={true}
        onCheckIn={mockOnCheckIn}
      />
    );

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    expect(checkInButton).toBeInTheDocument();
    expect(checkInButton).not.toBeDisabled();
  });

  it("calls onCheckIn when check-in button is clicked and within radius", () => {
    render(
      <SchoolDetailView
        school={mockSchool}
        onBack={mockOnBack}
        showCheckInButton={true}
        onCheckIn={mockOnCheckIn}
      />
    );

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);
    expect(mockOnCheckIn).toHaveBeenCalledWith(mockSchool);
  });

  it("disables check-in button when outside radius", () => {
    mockSchoolService.isWithinRadius = jest.fn().mockReturnValue(false);

    render(
      <SchoolDetailView
        school={mockSchool}
        onBack={mockOnBack}
        showCheckInButton={true}
        onCheckIn={mockOnCheckIn}
      />
    );

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    expect(checkInButton).toBeDisabled();
  });

  it("shows location status badge correctly when in range", () => {
    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    expect(screen.getByText("In Check-in Range")).toBeInTheDocument();
  });

  it("shows location status badge correctly when out of range", () => {
    mockSchoolService.isWithinRadius = jest.fn().mockReturnValue(false);

    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    expect(screen.getByText("Outside Check-in Range")).toBeInTheDocument();
  });

  it("shows location unknown when no location available", () => {
    mockUseLocation.mockReturnValue({
      location: null,
      loading: false,
      error: null,
      getLocation: jest.fn(),
      clearError: jest.fn(),
    });

    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    expect(screen.getByText("Location Unknown")).toBeInTheDocument();
  });

  it("shows get location button when location not available", () => {
    const mockGetLocation = jest.fn();
    mockUseLocation.mockReturnValue({
      location: null,
      loading: false,
      error: null,
      getLocation: mockGetLocation,
      clearError: jest.fn(),
    });

    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    const getLocationButtons = screen.getAllByRole("button", { name: /get location|enable location/i });
    expect(getLocationButtons.length).toBeGreaterThan(0);

    fireEvent.click(getLocationButtons[0]);
    expect(mockGetLocation).toHaveBeenCalled();
  });

  it("displays distance when location is available", () => {
    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    expect(screen.getByText("50m")).toBeInTheDocument();
  });

  it("displays distance in kilometers when over 1000m", () => {
    mockSchoolService.calculateDistance = jest.fn().mockReturnValue(1500);

    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    expect(screen.getByText("1.5km")).toBeInTheDocument();
  });

  it("shows GPS coordinates correctly", () => {
    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    expect(screen.getByText("41.901914, -87.634724")).toBeInTheDocument();
  });

  it("shows assigned badge when school is assigned", () => {
    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    expect(screen.getByText("Assigned")).toBeInTheDocument();
  });

  it("shows location help card when no location", () => {
    mockUseLocation.mockReturnValue({
      location: null,
      loading: false,
      error: null,
      getLocation: jest.fn(),
      clearError: jest.fn(),
    });

    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    expect(screen.getByText("Location Services Required")).toBeInTheDocument();
    expect(screen.getByText(/Enable location services to see your distance/)).toBeInTheDocument();
  });

  it("shows check-in instructions when outside radius", () => {
    mockSchoolService.isWithinRadius = jest.fn().mockReturnValue(false);
    mockSchoolService.calculateDistance = jest.fn().mockReturnValue(150);

    render(
      <SchoolDetailView
        school={mockSchool}
        onBack={mockOnBack}
        showCheckInButton={true}
      />
    );

    expect(screen.getByText("Move Closer to Check In")).toBeInTheDocument();
    expect(screen.getByText(/You need to be within 100 meters/)).toBeInTheDocument();
    expect(screen.getByText(/You're currently 150m away/)).toBeInTheDocument();
  });

  it("shows loading state for location button", () => {
    mockUseLocation.mockReturnValue({
      location: null,
      loading: true,
      error: null,
      getLocation: jest.fn(),
      clearError: jest.fn(),
    });

    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    const getLocationButton = screen.getByRole("button", { name: /get location/i });
    expect(getLocationButton).toBeDisabled();
  });

  it("shows contact information section", () => {
    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    expect(screen.getByText("Contact Information")).toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();
  });

  it("shows session information section", () => {
    render(
      <SchoolDetailView school={mockSchool} onBack={mockOnBack} />
    );

    expect(screen.getByText("Session Information")).toBeInTheDocument();
    expect(screen.getByText("Current Status")).toBeInTheDocument();
    expect(screen.getByText("Not checked in")).toBeInTheDocument();
    expect(screen.getByText("Total Sessions")).toBeInTheDocument();
    expect(screen.getByText("Total Hours")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <SchoolDetailView
        school={mockSchool}
        onBack={mockOnBack}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});
