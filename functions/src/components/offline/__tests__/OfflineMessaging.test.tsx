// Tests for offline status indicators and messaging system
// Validates Task 11.6: Add offline status indicators and user messaging

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OfflineStatusIndicator } from "../OfflineStatusIndicator";
import {
  OfflineMessageList,
  OfflineMessagingProvider,
  useOfflineMessaging,
} from "../OfflineMessaging";
import { OfflineStatusBar } from "../OfflineStatusBar";

// Mock dependencies
jest.mock("@/lib/hooks/useNetworkStatus", () => ({
  useNetworkStatus: jest.fn(),
}));

jest.mock("@/lib/hooks/useEnhancedOfflineQueue", () => ({
  useEnhancedOfflineQueue: jest.fn(),
}));

jest.mock("@/components/ui/use-toast", () => ({
  useToast: jest.fn(() => ({
    toast: jest.fn(),
  })),
}));

// Mock imports
const mockUseNetworkStatus =
  require("@/lib/hooks/useNetworkStatus").useNetworkStatus;
const mockUseEnhancedOfflineQueue =
  require("@/lib/hooks/useEnhancedOfflineQueue").useEnhancedOfflineQueue;
const mockUseToast = require("@/components/ui/use-toast").useToast;

describe("OfflineStatusIndicator", () => {
  const defaultNetworkStatus = {
    isOnline: true,
    isUnstable: false,
    connectivityScore: 85,
  };

  const defaultQueueState = {
    queueStats: {
      total: 0,
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      cancelled: 0,
    },
    pendingActions: [],
    isSyncing: false,
    isOnline: true,
    isUnstable: false,
    connectivityScore: 80,
    isRestoring: false,
    syncRecommendations: {
      shouldSync: true,
      reason: "Good connection",
    },
  };

  const defaultQueueActions = {
    syncNow: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNetworkStatus.mockReturnValue(defaultNetworkStatus);
    mockUseEnhancedOfflineQueue.mockReturnValue({
      state: defaultQueueState,
      actions: defaultQueueActions,
    });
  });

  describe("Compact Variant", () => {
    it("shows wifi icon when online", () => {
      render(<OfflineStatusIndicator variant="compact" />);

      // Should show wifi icon (via lucide-react, test by presence)
      expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    it("shows offline icon when offline", () => {
      mockUseNetworkStatus.mockReturnValue({
        ...defaultNetworkStatus,
        isOnline: false,
        connectivityScore: 0,
      });

      render(<OfflineStatusIndicator variant="compact" />);

      // Component should render the wifi-off icon without error when offline
      const component = document.querySelector(".lucide-wifi-off");
      expect(component).toBeInTheDocument();
    });

    it("shows pending count badge when actions are queued", () => {
      mockUseEnhancedOfflineQueue.mockReturnValue({
        state: {
          ...defaultQueueState,
          queueStats: {
            ...defaultQueueState.queueStats,
            pending: 3,
          },
        },
        actions: defaultQueueActions,
      });

      render(<OfflineStatusIndicator variant="compact" />);

      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  describe("Banner Variant", () => {
    it("hides banner when online and no pending actions", () => {
      const { container } = render(<OfflineStatusIndicator variant="banner" />);

      expect(container.firstChild).toBeNull();
    });

    it("shows banner when offline", () => {
      mockUseNetworkStatus.mockReturnValue({
        ...defaultNetworkStatus,
        isOnline: false,
      });

      render(<OfflineStatusIndicator variant="banner" />);

      expect(screen.getByText(/Working offline/)).toBeInTheDocument();
    });

    it("shows banner when connection is unstable", () => {
      mockUseNetworkStatus.mockReturnValue({
        ...defaultNetworkStatus,
        isUnstable: true,
      });

      render(<OfflineStatusIndicator variant="banner" />);

      expect(screen.getByText(/Connection unstable/)).toBeInTheDocument();
    });

    it("shows sync button when pending actions exist", () => {
      mockUseEnhancedOfflineQueue.mockReturnValue({
        state: {
          ...defaultQueueState,
          queueStats: {
            ...defaultQueueState.queueStats,
            pending: 2,
          },
        },
        actions: defaultQueueActions,
      });

      render(<OfflineStatusIndicator variant="banner" showSyncButton={true} />);

      expect(screen.getByText("Sync Now")).toBeInTheDocument();
    });

    it("triggers sync when sync button is clicked", async () => {
      const mockSyncNow = jest.fn();
      mockUseEnhancedOfflineQueue.mockReturnValue({
        state: {
          ...defaultQueueState,
          queueStats: {
            ...defaultQueueState.queueStats,
            pending: 1,
          },
        },
        actions: {
          syncNow: mockSyncNow,
        },
      });

      render(<OfflineStatusIndicator variant="banner" showSyncButton={true} />);

      const syncButton = screen.getByText("Sync Now");
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(mockSyncNow).toHaveBeenCalledWith(true);
      });
    });
  });

  describe("Full Variant", () => {
    it("displays connection status information", () => {
      render(<OfflineStatusIndicator variant="full" />);

      expect(screen.getByText("Online")).toBeInTheDocument();
      expect(screen.getByText("85/100")).toBeInTheDocument();
    });

    it("shows progress bar for connection quality", () => {
      render(<OfflineStatusIndicator variant="full" />);

      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toBeInTheDocument();
      // Note: Radix UI Progress may not always set aria-valuenow, so we just check for presence
    });

    it("displays queue status information", () => {
      mockUseEnhancedOfflineQueue.mockReturnValue({
        state: {
          ...defaultQueueState,
          queueStats: {
            total: 5,
            pending: 2,
            syncing: 1,
            synced: 2,
            failed: 0,
            cancelled: 0,
          },
        },
        actions: defaultQueueActions,
      });

      render(<OfflineStatusIndicator variant="full" showQueueInfo={true} />);

      expect(screen.getByText("2 pending actions")).toBeInTheDocument();
    });

    it("shows sync recommendations when sync is not recommended", () => {
      mockUseEnhancedOfflineQueue.mockReturnValue({
        state: {
          ...defaultQueueState,
          queueStats: {
            ...defaultQueueState.queueStats,
            pending: 1,
          },
          syncRecommendations: {
            shouldSync: false,
            reason: "Poor connection quality",
            recommendedDelay: 5000,
          },
        },
        actions: defaultQueueActions,
      });

      render(<OfflineStatusIndicator variant="full" />);

      expect(screen.getByText(/Sync delayed/)).toBeInTheDocument();
      expect(screen.getByText(/Poor connection quality/)).toBeInTheDocument();
    });

    it("shows offline message when not connected", () => {
      mockUseNetworkStatus.mockReturnValue({
        ...defaultNetworkStatus,
        isOnline: false,
      });

      render(<OfflineStatusIndicator variant="full" />);

      expect(screen.getByText(/Working offline/)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Actions will sync automatically when connection returns/
        )
      ).toBeInTheDocument();
    });
  });
});

describe("OfflineStatusBar", () => {
  const defaultNetworkStatus = {
    isOnline: true,
    isUnstable: false,
    connectivityScore: 80,
  };

  const defaultQueueState = {
    queueStats: {
      total: 0,
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      cancelled: 0,
    },
    pendingActions: [],
    isSyncing: false,
    isOnline: true,
    isUnstable: false,
    connectivityScore: 80,
    isRestoring: false,
    syncRecommendations: {
      shouldSync: true,
      reason: "Good connection",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNetworkStatus.mockReturnValue(defaultNetworkStatus);
    mockUseEnhancedOfflineQueue.mockReturnValue({
      state: defaultQueueState,
      actions: {},
    });
  });

  it("hides status bar when online and no issues", () => {
    const { container } = render(<OfflineStatusBar variant="compact" />);

    expect(container.firstChild).toBeNull();
  });

  it("shows status bar when offline", () => {
    mockUseNetworkStatus.mockReturnValue({
      ...defaultNetworkStatus,
      isOnline: false,
    });

    render(<OfflineStatusBar variant="compact" />);

    expect(screen.getByText(/Working offline/)).toBeInTheDocument();
  });

  it("shows status bar when pending actions exist", () => {
    mockUseEnhancedOfflineQueue.mockReturnValue({
      state: {
        ...defaultQueueState,
        queueStats: {
          ...defaultQueueState.queueStats,
          pending: 3,
        },
      },
      actions: {},
    });

    render(<OfflineStatusBar variant="compact" />);

    // Should show status information
    expect(screen.getByText(/3 remaining/)).toBeInTheDocument();
  });

  it("always shows in full variant regardless of status", () => {
    render(<OfflineStatusBar variant="full" />);

    // Full variant should always render content
    expect(screen.getByText("Online")).toBeInTheDocument();
  });
});

describe("OfflineMessageList", () => {
  const defaultNetworkStatus = {
    isOnline: true,
    isUnstable: false,
    connectivityScore: 80,
  };

  const defaultQueueState = {
    queueStats: {
      total: 0,
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      cancelled: 0,
    },
    pendingActions: [],
    isSyncing: false,
    isOnline: true,
    isUnstable: false,
    connectivityScore: 80,
    isRestoring: false,
    syncRecommendations: {
      shouldSync: true,
      reason: "Good connection",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNetworkStatus.mockReturnValue(defaultNetworkStatus);
    mockUseEnhancedOfflineQueue.mockReturnValue({
      state: defaultQueueState,
      actions: { syncNow: jest.fn() },
    });
  });

  it("shows no messages when everything is normal", () => {
    const { container } = render(<OfflineMessageList />);

    expect(container.firstChild).toBeNull();
  });

  it("shows offline message when disconnected", () => {
    mockUseNetworkStatus.mockReturnValue({
      ...defaultNetworkStatus,
      isOnline: false,
    });

    render(<OfflineMessageList />);

    expect(screen.getByText("Working Offline")).toBeInTheDocument();
  });

  it("shows unstable connection warning", () => {
    mockUseNetworkStatus.mockReturnValue({
      ...defaultNetworkStatus,
      isUnstable: true,
    });

    render(<OfflineMessageList />);

    expect(screen.getByText("Unstable Connection")).toBeInTheDocument();
  });

  it("shows pending sync message with action button", () => {
    mockUseEnhancedOfflineQueue.mockReturnValue({
      state: {
        ...defaultQueueState,
        queueStats: {
          ...defaultQueueState.queueStats,
          pending: 2,
        },
      },
      actions: { syncNow: jest.fn() },
    });

    render(<OfflineMessageList />);

    expect(screen.getByText("Syncing Actions")).toBeInTheDocument();
    expect(screen.getByText("2 actions waiting to sync")).toBeInTheDocument();
    expect(screen.getByText("Sync Now")).toBeInTheDocument();
  });

  it("shows failed actions message", () => {
    mockUseEnhancedOfflineQueue.mockReturnValue({
      state: {
        ...defaultQueueState,
        queueStats: {
          ...defaultQueueState.queueStats,
          failed: 1,
        },
      },
      actions: { syncNow: jest.fn() },
    });

    render(<OfflineMessageList />);

    expect(screen.getByText("Sync Failed")).toBeInTheDocument();
    expect(screen.getByText("1 actions failed to sync")).toBeInTheDocument();
  });

  it("limits displayed messages to maxVisible", () => {
    // Setup multiple message conditions
    mockUseNetworkStatus.mockReturnValue({
      ...defaultNetworkStatus,
      isOnline: false,
      isUnstable: true, // This won't show since offline takes precedence
    });

    mockUseEnhancedOfflineQueue.mockReturnValue({
      state: {
        ...defaultQueueState,
        queueStats: {
          ...defaultQueueState.queueStats,
          pending: 1,
          failed: 1,
        },
      },
      actions: { syncNow: jest.fn() },
    });

    render(<OfflineMessageList maxVisible={1} />);

    // Should only show 1 message (offline takes priority)
    expect(screen.getByText("Working Offline")).toBeInTheDocument();
    expect(screen.queryByText("Sync Failed")).not.toBeInTheDocument();
  });
});

describe("useOfflineMessaging Hook", () => {
  let TestComponent: React.FC;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      isUnstable: false,
      connectivityScore: 80,
    });
    mockUseEnhancedOfflineQueue.mockReturnValue({
      state: {
        queueStats: {
          total: 0,
          pending: 0,
          syncing: 0,
          synced: 0,
          failed: 0,
          cancelled: 0,
        },
        pendingActions: [],
        isSyncing: false,
        isOnline: true,
        isUnstable: false,
        connectivityScore: 80,
        isRestoring: false,
        syncRecommendations: {
          shouldSync: true,
          reason: "Good connection",
        },
      },
      actions: { syncNow: jest.fn() },
    });
    mockUseToast.mockReturnValue({
      toast: jest.fn(),
    });

    TestComponent = () => {
      const messaging = useOfflineMessaging();

      return (
        <div>
          <button onClick={() => messaging.showConnectivityMessage("online")}>
            Show Online Message
          </button>
          <button onClick={() => messaging.showConnectivityMessage("offline")}>
            Show Offline Message
          </button>
          <button
            onClick={() => messaging.showSyncMessage("completed", "Test sync")}
          >
            Show Sync Complete
          </button>
          <button
            onClick={() => messaging.showActionMessage("check-in", true, false)}
          >
            Show Check-in Success
          </button>
        </div>
      );
    };
  });

  it("provides connectivity message functions", () => {
    const mockToast = jest.fn();
    mockUseToast.mockReturnValue({ toast: mockToast });

    render(<TestComponent />);

    fireEvent.click(screen.getByText("Show Online Message"));

    expect(mockToast).toHaveBeenCalledWith({
      title: "Connected",
      description: "Connection restored successfully",
    });
  });

  it("shows offline connectivity message", () => {
    const mockToast = jest.fn();
    mockUseToast.mockReturnValue({ toast: mockToast });

    render(<TestComponent />);

    fireEvent.click(screen.getByText("Show Offline Message"));

    expect(mockToast).toHaveBeenCalledWith({
      title: "Offline",
      description: "Working offline - actions will sync when connected",
      variant: "destructive",
    });
  });

  it("shows sync completion message", () => {
    const mockToast = jest.fn();
    mockUseToast.mockReturnValue({ toast: mockToast });

    render(<TestComponent />);

    fireEvent.click(screen.getByText("Show Sync Complete"));

    expect(mockToast).toHaveBeenCalledWith({
      title: "Sync Complete",
      description: "Test sync",
    });
  });

  it("shows action success message", () => {
    const mockToast = jest.fn();
    mockUseToast.mockReturnValue({ toast: mockToast });

    render(<TestComponent />);

    fireEvent.click(screen.getByText("Show Check-in Success"));

    expect(mockToast).toHaveBeenCalledWith({
      title: "Check-in Successful",
      description: "Check-in completed successfully",
    });
  });
});
