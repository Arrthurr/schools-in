// Unit tests for PWAStatus component

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { PWAStatus } from "./PWAStatus";
import { useOffline } from "../../lib/hooks/useOffline";

// Mock the useOffline hook
jest.mock("../../lib/hooks/useOffline", () => ({
  useOffline: jest.fn(),
}));

const mockUseOffline = useOffline as jest.MockedFunction<typeof useOffline>;

describe("PWAStatus", () => {
  const mockOfflineData = {
    isOnline: true,
    syncInProgress: false,
    lastSyncTime: new Date("2024-01-01T12:00:00Z"),
    checkInOffline: jest.fn(),
    checkOutOffline: jest.fn(),
    syncOfflineActions: jest.fn(),
    getCachedSchools: jest.fn(),
    getCachedSessions: jest.fn(),
    clearOfflineData: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOffline.mockReturnValue(mockOfflineData);

    // Reset window properties
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    // Reset navigator.standalone
    Object.defineProperty(window.navigator, "standalone", {
      writable: true,
      value: undefined,
    });

    // Reset document.referrer
    Object.defineProperty(document, "referrer", {
      writable: true,
      value: "",
    });

    // Ensure beforeinstallprompt is not present on window
    delete (window as any).beforeinstallprompt;
    // Also ensure it's not enumerable
    if ("beforeinstallprompt" in window) {
      Object.defineProperty(window, "beforeinstallprompt", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: undefined,
      });
    }
  });

  it("shows online status when connected", () => {
    render(<PWAStatus />);

    expect(screen.getByText("Online")).toBeInTheDocument();
    // Check for wifi icon by its class
    const wifiIcon = document.querySelector(".lucide-wifi");
    expect(wifiIcon).toBeInTheDocument();
  });

  it("shows offline status when disconnected", () => {
    mockUseOffline.mockReturnValue({
      ...mockOfflineData,
      isOnline: false,
    });

    render(<PWAStatus />);

    expect(screen.getByText("Offline")).toBeInTheDocument();
    // Check for wifi-off icon by its class
    const wifiOffIcon = document.querySelector(".lucide-wifi-off");
    expect(wifiOffIcon).toBeInTheDocument();
  });

  it("shows sync status when syncing", () => {
    mockUseOffline.mockReturnValue({
      ...mockOfflineData,
      syncInProgress: true,
    });

    render(<PWAStatus />);

    expect(screen.getByText("Syncing")).toBeInTheDocument();
    // Check for refresh-cw icon by its class
    const refreshIcon = document.querySelector(".lucide-refresh-cw");
    expect(refreshIcon).toBeInTheDocument();
  });

  it("shows last sync time when available", () => {
    render(<PWAStatus />);

    expect(screen.getByText(/Synced/)).toBeInTheDocument();
    // Check for clock icon by its class
    const clockIcon = document.querySelector(".lucide-clock");
    expect(clockIcon).toBeInTheDocument();
  });

  it("does not show last sync time when syncing", () => {
    mockUseOffline.mockReturnValue({
      ...mockOfflineData,
      syncInProgress: true,
    });

    render(<PWAStatus />);

    expect(screen.queryByText(/Synced/)).not.toBeInTheDocument();
  });

  it("shows PWA mode when running as PWA", () => {
    // Mock PWA mode
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: query === "(display-mode: standalone)",
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<PWAStatus />);

    expect(screen.getByText("App Mode")).toBeInTheDocument();
    // Check for smartphone icon by its class
    const smartphoneIcon = document.querySelector(".lucide-smartphone");
    expect(smartphoneIcon).toBeInTheDocument();
  });

  it("shows installable status when PWA can be installed", () => {
    // Mock beforeinstallprompt available
    Object.defineProperty(window, "beforeinstallprompt", {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    render(<PWAStatus />);

    expect(screen.getByText("Installable")).toBeInTheDocument();
    // Check for monitor icon by its class
    const monitorIcon = document.querySelector(".lucide-monitor");
    expect(monitorIcon).toBeInTheDocument();
  });

  it("does not show installable status when running as PWA", () => {
    // Mock PWA mode
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: query === "(display-mode: standalone)",
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<PWAStatus />);

    expect(screen.queryByText("Installable")).not.toBeInTheDocument();
  });

  it("shows not-supported status when PWA is not supported", () => {
    // Default mock setup shows not-supported
    render(<PWAStatus />);

    expect(screen.queryByText("Installable")).not.toBeInTheDocument();
    expect(screen.queryByText("App Mode")).not.toBeInTheDocument();
  });

  it("handles navigator.standalone for iOS PWA detection", () => {
    // Mock iOS standalone mode
    Object.defineProperty(window.navigator, "standalone", {
      writable: true,
      value: true,
    });

    render(<PWAStatus />);

    expect(screen.getByText("App Mode")).toBeInTheDocument();
  });

  it("handles android-app referrer for Android PWA detection", () => {
    // Mock Android PWA referrer
    Object.defineProperty(document, "referrer", {
      writable: true,
      value: "android-app://com.example.app",
    });

    render(<PWAStatus />);

    expect(screen.getByText("App Mode")).toBeInTheDocument();
  });

  it("renders all status badges correctly", () => {
    mockUseOffline.mockReturnValue({
      ...mockOfflineData,
      lastSyncTime: new Date(),
    });

    // Mock installable PWA
    Object.defineProperty(window, "beforeinstallprompt", {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    render(<PWAStatus />);

    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText(/Synced/)).toBeInTheDocument();
    expect(screen.getByText("Installable")).toBeInTheDocument();
  });

  it("handles missing lastSyncTime gracefully", () => {
    mockUseOffline.mockReturnValue({
      ...mockOfflineData,
      lastSyncTime: null,
    });

    render(<PWAStatus />);

    expect(screen.queryByText(/Synced/)).not.toBeInTheDocument();
  });
});
