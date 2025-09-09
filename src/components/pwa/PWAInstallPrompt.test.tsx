import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PWAInstallPrompt } from './PWAInstallPrompt';

// Mock the window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
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
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

describe('PWAInstallPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset sessionStorage mock
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  it('renders nothing when no install prompt event is available', () => {
    render(<PWAInstallPrompt />);
    expect(screen.queryByText('Install Schools In')).not.toBeInTheDocument();
  });

  it('renders install prompt when beforeinstallprompt event is triggered', async () => {
    render(<PWAInstallPrompt />);

    // Simulate the beforeinstallprompt event
    const mockEvent = {
      preventDefault: jest.fn(),
      prompt: jest.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };

    // Trigger the event
    window.dispatchEvent(new CustomEvent('beforeinstallprompt', mockEvent as any));

    await waitFor(() => {
      expect(screen.getByText('Install Schools In')).toBeInTheDocument();
      expect(screen.getByText('Install the app for faster access and offline functionality')).toBeInTheDocument();
    });
  });

  it('handles install button click', async () => {
    render(<PWAInstallPrompt />);

    const mockEvent = {
      preventDefault: jest.fn(),
      prompt: jest.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };

    // Trigger the beforeinstallprompt event
    window.dispatchEvent(new CustomEvent('beforeinstallprompt', mockEvent as any));

    await waitFor(() => {
      expect(screen.getByText('Install App')).toBeInTheDocument();
    });

    // Click the install button
    fireEvent.click(screen.getByText('Install App'));

    await waitFor(() => {
      expect(mockEvent.prompt).toHaveBeenCalled();
    });
  });

  it('handles dismiss button click', async () => {
    render(<PWAInstallPrompt />);

    const mockEvent = {
      preventDefault: jest.fn(),
      prompt: jest.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    };

    // Trigger the beforeinstallprompt event
    window.dispatchEvent(new CustomEvent('beforeinstallprompt', mockEvent as any));

    await waitFor(() => {
      expect(screen.getByText('Not Now')).toBeInTheDocument();
    });

    // Click the dismiss button
    fireEvent.click(screen.getByText('Not Now'));

    await waitFor(() => {
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('pwa-prompt-dismissed', 'true');
    });
  });

  it('does not show prompt when user has dismissed it in current session', () => {
    mockSessionStorage.getItem.mockReturnValue('true');
    
    render(<PWAInstallPrompt />);

    const mockEvent = {
      preventDefault: jest.fn(),
      prompt: jest.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    };

    // Trigger the beforeinstallprompt event
    window.dispatchEvent(new CustomEvent('beforeinstallprompt', mockEvent as any));

    expect(screen.queryByText('Install Schools In')).not.toBeInTheDocument();
  });
});
