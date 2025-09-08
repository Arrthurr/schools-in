import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckInButton } from "./CheckInButton";
import { useAuth } from "../../lib/hooks/useAuth";
import { useSession } from "../../lib/hooks/useSession";
import { locationService } from "../../lib/utils/location";

// Mock the hooks
jest.mock("../../lib/hooks/useAuth");
jest.mock("../../lib/hooks/useSession");
jest.mock("../../lib/utils/location", () => ({
  locationService: {
    getCurrentLocation: jest.fn(),
  },
  isWithinRadius: jest.fn(),
  calculateDistance: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockLocationService = locationService as jest.Mocked<
  typeof locationService
>;
const mockIsWithinRadius = require("../../lib/utils/location")
  .isWithinRadius as jest.MockedFunction<any>;
const mockCalculateDistance = require("../../lib/utils/location")
  .calculateDistance as jest.MockedFunction<any>;

describe("CheckInButton", () => {
  const mockSchool = {
    id: "school-1",
    name: "Test Elementary School",
    address: "123 Test St, Test City, TC 12345",
    gpsCoordinates: {
      latitude: 40.7128,
      longitude: -74.006,
    },
    radius: 100, // 100 meters
  };

  const mockUser = {
    uid: "user-1",
    email: "test@example.com",
    displayName: "Test User",
    role: "provider" as const,
  };

  const mockSession = {
    checkIn: jest.fn(),
    checkOut: jest.fn(),
    loading: false,
    currentSession: null,
    sessions: [],
    error: null,
    loadSessions: jest.fn(),
    clearError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      signInWithGoogle: jest.fn(),
      signInWithEmailAndPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    });

    mockUseSession.mockReturnValue(mockSession);

    // Mock successful location response by default
    mockLocationService.getCurrentLocation.mockResolvedValue({
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 5,
    });

    // Mock distance calculation to return 0 for same coordinates by default
    mockCalculateDistance.mockReturnValue(0);
    mockIsWithinRadius.mockReturnValue(true);
  });

  it("renders check-in button when not checked in", () => {
    render(<CheckInButton school={mockSchool} />);

    expect(
      screen.getByRole("button", { name: /check in/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Uses GPS for location verification")
    ).toBeInTheDocument();
  });

  it("renders check-out button when checked in", () => {
    render(
      <CheckInButton
        school={mockSchool}
        isCheckedIn={true}
        currentSessionId="session-1"
      />
    );

    expect(
      screen.getByRole("button", { name: /check out/i })
    ).toBeInTheDocument();
  });

  it("shows loading state while getting location", async () => {
    // Mock a delayed location response
    mockLocationService.getCurrentLocation.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                latitude: 40.7128,
                longitude: -74.006,
                accuracy: 5,
              }),
            100
          )
        )
    );

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    expect(
      screen.getByRole("button", { name: /getting location.*\(0\/3\)/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/getting location/i)).not.toBeInTheDocument();
    });
  });

  it("shows error when location permission is denied", async () => {
    const locationError = {
      code: 1,
      message: "Location access denied. Please enable location permissions.",
    };

    mockLocationService.getCurrentLocation.mockRejectedValue(locationError);

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Location access denied. Please enable location permissions in your browser settings and try again. Check your browser's location settings."
        )
      ).toBeInTheDocument();
    });
  });

  it("shows within range status when user is close to school", async () => {
    // User is at the same location as school
    mockLocationService.getCurrentLocation.mockResolvedValue({
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 5,
    });
    mockCalculateDistance.mockReturnValue(0);
    mockIsWithinRadius.mockReturnValue(true);

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getAllByText(/within range/i)).toHaveLength(2); // One in main view, one in dialog
      expect(screen.getAllByText(/0m away/i)).toHaveLength(2);
    });
  });

  it("shows outside range status when user is far from school", async () => {
    // User is far from school coordinates
    mockLocationService.getCurrentLocation.mockResolvedValue({
      latitude: 40.8, // About 10km north
      longitude: -74.006,
      accuracy: 5,
    });
    mockCalculateDistance.mockReturnValue(9700); // 9.7 km
    mockIsWithinRadius.mockReturnValue(false);

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getByText(/outside range/i)).toBeInTheDocument();
      expect(screen.getByText(/km away/i)).toBeInTheDocument();
      // Dialog should not open when user is too far away (enhanced behavior)
      expect(screen.queryByText("Confirm Check-In")).not.toBeInTheDocument();
    });
  });

  it("opens confirmation dialog when check-in is clicked and location is obtained", async () => {
    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getAllByText("Confirm Check-In")[0]).toBeInTheDocument();
      expect(screen.getAllByText(mockSchool.name)[0]).toBeInTheDocument();
      expect(screen.getByText(mockSchool.address)).toBeInTheDocument();
    });
  });

  it("allows check-in when user is within range", async () => {
    mockLocationService.getCurrentLocation.mockResolvedValue({
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 5,
    });
    mockCalculateDistance.mockReturnValue(0);
    mockIsWithinRadius.mockReturnValue(true);

    render(<CheckInButton school={mockSchool} />);

    // Click check-in button
    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getAllByText("Confirm Check-In")[0]).toBeInTheDocument();
    });

    // Click confirm button
    const confirmButton = screen.getByRole("button", {
      name: /confirm check-in/i,
    });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockSession.checkIn).toHaveBeenCalledWith(mockSchool.id, {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 5,
      });
    });
  });

  it("prevents check-in when user is outside range", async () => {
    // User is moderately far from school (within reasonable distance but outside radius)
    mockLocationService.getCurrentLocation.mockResolvedValue({
      latitude: 40.7135,
      longitude: -74.006,
      accuracy: 5,
    });
    mockCalculateDistance.mockReturnValue(120); // 120m - outside 100m radius but within reasonable range
    mockIsWithinRadius.mockReturnValue(false);

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getAllByText("Confirm Check-In")[0]).toBeInTheDocument();
    });

    // Confirm button should be disabled
    const confirmButton = screen.getByRole("button", {
      name: /confirm check-in/i,
    });
    expect(confirmButton).toBeDisabled();

    // Should show warning message
    expect(
      screen.getByText(/You are currently 120m from Test Elementary School/i)
    ).toBeInTheDocument();
  });

  it("handles check-out process", async () => {
    const currentSessionId = "session-1";
    const mockCurrentSession = {
      id: currentSessionId,
      userId: "user-1",
      schoolId: "school-1",
      checkInTime: { toMillis: () => Date.now() - 3600000 } as any, // 1 hour ago
      checkInLocation: { latitude: 40.7128, longitude: -74.006, accuracy: 5 },
      status: "active" as const,
    };

    // Update mock to include current session
    mockUseSession.mockReturnValue({
      ...mockSession,
      currentSession: mockCurrentSession,
    });

    render(
      <CheckInButton
        school={mockSchool}
        isCheckedIn={true}
        currentSessionId={currentSessionId}
      />
    );

    const checkOutButton = screen.getByRole("button", { name: /check out/i });
    fireEvent.click(checkOutButton);

    // Wait for check-out confirmation dialog to appear
    await waitFor(() => {
      expect(screen.getAllByText(/confirm check-out/i).length).toBeGreaterThan(
        0
      );
    });

    // Click the confirm button in the dialog
    const confirmButton = screen.getByRole("button", {
      name: /confirm check-out/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockSession.checkOut).toHaveBeenCalledWith(currentSessionId, {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 5,
      });
    });
  });

  it("shows error when user is not logged in", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle: jest.fn(),
      signInWithEmailAndPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    });

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(
        screen.getByText("You must be logged in to check in")
      ).toBeInTheDocument();
    });
  });

  it("calls onLocationUpdate when location is obtained", async () => {
    const onLocationUpdate = jest.fn();
    const mockLocation = { latitude: 40.7128, longitude: -74.006, accuracy: 5 };

    mockLocationService.getCurrentLocation.mockResolvedValue(mockLocation);

    render(
      <CheckInButton school={mockSchool} onLocationUpdate={onLocationUpdate} />
    );

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(onLocationUpdate).toHaveBeenCalledWith(mockLocation);
    });
  });

  it("shows session loading state", () => {
    mockUseSession.mockReturnValue({
      ...mockSession,
      loading: true,
    });

    render(<CheckInButton school={mockSchool} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("cancels check-in dialog", async () => {
    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getAllByText("Confirm Check-In")[0]).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText("Confirm Check-In")).not.toBeInTheDocument();
    });
  });

  it("formats distance correctly for meters and kilometers", async () => {
    // Test with distance in meters (less than 1km) - within reasonable range
    mockLocationService.getCurrentLocation.mockResolvedValue({
      latitude: 40.7132, // About 50m away - within reasonable range
      longitude: -74.006,
      accuracy: 5,
    });
    mockCalculateDistance.mockReturnValue(50);
    mockIsWithinRadius.mockReturnValue(true);

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getAllByText(/50m away/)).toHaveLength(2);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("displays required radius information", async () => {
    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          `Required within ${mockSchool.radius}m of ${mockSchool.name}`
        )
      ).toBeInTheDocument();
    });
  });

  it("shows GPS accuracy indicator", async () => {
    mockLocationService.getCurrentLocation.mockResolvedValue({
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 15,
    });

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getByText(/GPS Accuracy: ±15m/)).toBeInTheDocument();
    });
  });

  it("handles location timeout error", async () => {
    mockLocationService.getCurrentLocation.mockRejectedValue({
      code: 3,
      message: "Location request timed out. Please try again.",
    });

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Location timeout \(attempt 1\/4\)\. Retrying with extended timeout/
        )
      ).toBeInTheDocument();
    });

    expect(screen.queryByText("Confirm Check-In")).not.toBeInTheDocument();
  });

  it("shows accuracy indicator with good GPS", async () => {
    mockLocationService.getCurrentLocation.mockResolvedValue({
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 10, // Good accuracy that will show dialog immediately
    });
    mockCalculateDistance.mockReturnValue(0);
    mockIsWithinRadius.mockReturnValue(true);

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/GPS Accuracy: ±10m/)).toBeInTheDocument();
    });
  });

  it("shows location verification states correctly", async () => {
    mockLocationService.getCurrentLocation.mockResolvedValue({
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 5,
    });
    mockIsWithinRadius.mockReturnValue(true);

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Location verified! You are within the allowed check-in radius/
        )
      ).toBeInTheDocument();
    });
  });
});
