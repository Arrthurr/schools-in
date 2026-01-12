import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { PWAInstallPrompt } from "./PWAInstallPrompt";

// Mock the window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, "sessionStorage", {
  value: mockSessionStorage,
});

const setupPromptEvent = (outcome: "accepted" | "dismissed" = "accepted") => {
  const event = new Event("beforeinstallprompt") as any;
  event.prompt = jest.fn();
  event.userChoice = Promise.resolve({ outcome });
  Object.defineProperty(window, "deferredPrompt", {
    value: event,
    writable: true,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

describe("PWAInstallPrompt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset sessionStorage mock
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  it("renders nothing when no install prompt event is available", () => {
    render(<PWAInstallPrompt />);
    expect(screen.queryByText("Install CampusAccess")).not.toBeInTheDocument();
  });

  it("renders install prompt when beforeinstallprompt event is triggered", async () => {
    render(<PWAInstallPrompt />);

    setupPromptEvent("accepted");

    await waitFor(() => {
      expect(screen.getByText("Install CampusAccess")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Install the app for faster access and offline functionality"
        )
      ).toBeInTheDocument();
    });
  });

  it("handles install button click", async () => {
    render(<PWAInstallPrompt />);

    const promptEvent = setupPromptEvent("accepted");

    await waitFor(() => {
      expect(screen.getByText("Install App")).toBeInTheDocument();
    });

    // Click the install button
    fireEvent.click(screen.getByText("Install App"));

    await waitFor(() => {
      expect(promptEvent.prompt).toHaveBeenCalled();
    });
  });

  it("handles dismiss button click", async () => {
    render(<PWAInstallPrompt />);

    setupPromptEvent("dismissed");

    await waitFor(() => {
      expect(screen.getByText("Not Now")).toBeInTheDocument();
    });

    // Click the dismiss button
    fireEvent.click(screen.getByText("Not Now"));

    await waitFor(() => {
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        "pwa-prompt-dismissed",
        "true"
      );
    });
  });

  it("does not show prompt when user has dismissed it in current session", () => {
    mockSessionStorage.getItem.mockReturnValue("true");

    render(<PWAInstallPrompt />);

    setupPromptEvent("dismissed");

    expect(screen.queryByText("Install CampusAccess")).not.toBeInTheDocument();
  });
});
