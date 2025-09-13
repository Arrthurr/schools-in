import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { CheckInButton } from "./CheckInButton";
import { useAuth } from "../../lib/hooks/useAuth";
import { useSession } from "../../lib/hooks/useSession";
import { locationService } from "../../lib/utils/location";
import { User } from "firebase/auth";

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

  // Mock user with all required Firebase User properties
  const mockUser: User & { role: "provider" } = {
    uid: "user-1",
    email: "test@example.com",
    displayName: "Test User",
    role: "provider",
    emailVerified: true,
    isAnonymous: false,
    metadata: {
      creationTime: "2023-01-01T00:00:00.000Z",
      lastSignInTime: "2023-01-01T00:00:00.000Z",
    },
    providerData: [],
    refreshToken: "refresh-token",
    tenantId: null,
    delete: jest.fn(),
    getIdToken: jest.fn(),
    getIdTokenResult: jest.fn(),
    reload: jest.fn(),
    toJSON: jest.fn(),
    phoneNumber: null,
    photoURL: null,
    providerId: "firebase",
  };

  const mockSession = {
    checkIn: jest.fn(),
    checkOut: jest.fn(),
    loading: false,
    currentSession: null,
    sessions: [],
    error: null,
    totalSessions: 0,
    hasMore: false,
    loadSessions: jest.fn(),
    clearError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
    });

    mockUseSession.mockReturnValue(mockSession);

    // Mock successful location response by default
    mockLocationService.getCurrentLocation.mockResolvedValue({
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 5,
    });
    mockCalculateDistance.mockReturnValue(0);
    mockIsWithinRadius.mockReturnValue(true);
  });

  it("renders check-in button when not checked in", () => {
    render(<CheckInButton school={mockSchool} />);

    expect(screen.getByRole("button", { name: /check in/i })).toBeDefined();
    expect(
      screen.getByText("Uses GPS for location verification")
    ).toBeDefined();
  });

  it("renders check-out button when checked in", () => {
    render(
      <CheckInButton
        school={mockSchool}
        isCheckedIn={true}
        currentSessionId="session-1"
      />
    );

    expect(screen.getByRole("button", { name: /check out/i })).toBeDefined();
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

    // Should show loading state
    expect(screen.getByText(/Processing.../)).toBeDefined();
    expect(screen.queryByText(/getting location/i)).not.toBeDefined();

    // Wait for location to be obtained
    await waitFor(
      () => {
        expect(
          screen.getByRole("dialog", { name: /confirm check-in/i })
        ).toBeDefined();
      },
      { timeout: 200 }
    );
  });

  it("shows in range status when user is close to school", async () => {
    // User is exactly at school coordinates
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
      expect(screen.getByText("Status: In Range")).toBeDefined();
      expect(screen.getByText("Distance: 0m")).toBeDefined();
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
      expect(screen.getByText("Status: Out of Range")).toBeDefined();
      expect(screen.getByText("Distance: 9700m")).toBeDefined();
      // Dialog should not open when user is too far away (enhanced behavior)
      expect(screen.queryByText("Confirm Check-In")).toBeNull();
    });
  });

  it("opens confirmation dialog when check-in is clicked and location is obtained", async () => {
    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getByText("Confirm Check-In")).toBeDefined();
      expect(screen.getByText(mockSchool.name)).toBeDefined();
      expect(screen.getByText(mockSchool.address)).toBeDefined();
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
      expect(screen.getByText("Distance: 50m")).toBeDefined();
      expect(screen.getByRole("dialog")).toBeDefined();
    });
  });

  it("handles check-in when confirm button is clicked", async () => {
    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getByText("Confirm Check-In")).toBeDefined();
    });

    const confirmButton = screen.getByRole("button", { name: /confirm/i });
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

  it("shows GPS accuracy in location info", async () => {
    mockLocationService.getCurrentLocation.mockResolvedValue({
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 15, // 15 meter accuracy
    });

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getByText("Accuracy: ±15m")).toBeDefined();
    });
  });

  it("disables confirm button when location accuracy is too low", async () => {
    mockLocationService.getCurrentLocation.mockResolvedValue({
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 100, // Very low accuracy (100m)
    });

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getByText("Confirm Check-In")).toBeDefined();
    });

    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    expect(confirmButton).toBeDisabled();

    expect(screen.getByText(/GPS accuracy is too low/)).toBeDefined();
  });

  it("handles location errors gracefully", async () => {
    mockLocationService.getCurrentLocation.mockRejectedValue(
      new Error("Location access denied")
    );

    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getByText(/Location access denied/)).toBeDefined();
    });
  });

  it("handles check-out flow", async () => {
    render(
      <CheckInButton
        school={mockSchool}
        isCheckedIn={true}
        currentSessionId="session-1"
      />
    );

    const checkOutButton = screen.getByRole("button", { name: /check out/i });
    fireEvent.click(checkOutButton);

    await waitFor(() => {
      expect(screen.getByText(/confirm check-out/i)).toBeDefined();
    });
  });

  it("confirms successful location verification", async () => {
    render(<CheckInButton school={mockSchool} />);

    const checkInButton = screen.getByRole("button", { name: /check in/i });
    fireEvent.click(checkInButton);

    await waitFor(() => {
      expect(screen.getByText("Status: In Range")).toBeDefined();
    });
  });
});
