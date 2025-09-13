// Offline messaging system for user notifications and feedback
// Handles different types of offline-related messages and notifications

import React, { useState, useEffect } from "react";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { useEnhancedOfflineQueue } from "@/lib/hooks/useEnhancedOfflineQueue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle,
  AlertTriangle,
  Info,
  Wifi,
  WifiOff,
  Clock,
  RefreshCw,
  X,
} from "lucide-react";

export interface OfflineMessage {
  id: string;
  type: "success" | "warning" | "info" | "error";
  title: string;
  description: string;
  action?: {
    label: string;
    handler: () => void;
  };
  autoHide?: boolean;
  duration?: number;
  timestamp: number;
}

export interface OfflineMessagingProviderProps {
  children: React.ReactNode;
  maxMessages?: number;
  enableToasts?: boolean;
  enableNotifications?: boolean;
}

export function OfflineMessagingProvider({
  children,
  maxMessages = 5,
  enableToasts = true,
  enableNotifications = false,
}: OfflineMessagingProviderProps) {
  const networkStatus = useNetworkStatus();
  const { state, actions } = useEnhancedOfflineQueue();
  const { toast } = useToast();

  const [messages, setMessages] = useState<OfflineMessage[]>([]);
  const [previousOnlineStatus, setPreviousOnlineStatus] = useState(
    networkStatus.isOnline
  );
  const [previousPendingCount, setPreviousPendingCount] = useState(
    state.queueStats.pending
  );

  // Track network status changes
  useEffect(() => {
    if (previousOnlineStatus !== networkStatus.isOnline) {
      if (networkStatus.isOnline) {
        // Just came online
        if (enableToasts) {
          toast({
            title: "Connection Restored",
            description:
              state.queueStats.pending > 0
                ? `Syncing ${state.queueStats.pending} pending actions...`
                : "All data is up to date",
            action:
              state.queueStats.pending > 0 ? (
                <ToastAction
                  altText="Sync now"
                  onClick={() => actions.syncNow(true)}
                >
                  Sync Now
                </ToastAction>
              ) : undefined,
          });
        }

        addMessage({
          type: "success",
          title: "Back Online",
          description:
            state.queueStats.pending > 0
              ? `Syncing ${state.queueStats.pending} pending actions`
              : "All data synchronized",
          autoHide: true,
          duration: 5000,
        });
      } else {
        // Just went offline
        if (enableToasts) {
          toast({
            title: "Connection Lost",
            description:
              "You can continue working offline. Actions will sync when connection returns.",
            variant: "destructive",
          });
        }

        addMessage({
          type: "warning",
          title: "Working Offline",
          description:
            "You can still check in and out. Actions will sync automatically.",
          autoHide: false,
        });
      }
      setPreviousOnlineStatus(networkStatus.isOnline);
    }
  }, [
    networkStatus.isOnline,
    state.queueStats.pending,
    enableToasts,
    toast,
    actions,
  ]);

  // Track sync completion
  useEffect(() => {
    if (
      previousPendingCount > 0 &&
      state.queueStats.pending === 0 &&
      networkStatus.isOnline
    ) {
      if (enableToasts) {
        toast({
          title: "Sync Complete",
          description: `Successfully synced ${previousPendingCount} actions`,
        });
      }

      addMessage({
        type: "success",
        title: "Sync Completed",
        description: `${previousPendingCount} actions synchronized successfully`,
        autoHide: true,
        duration: 3000,
      });
    }
    setPreviousPendingCount(state.queueStats.pending);
  }, [
    state.queueStats.pending,
    networkStatus.isOnline,
    previousPendingCount,
    enableToasts,
    toast,
  ]);

  // Track sync errors
  useEffect(() => {
    if (state.syncError) {
      if (enableToasts) {
        toast({
          title: "Sync Error",
          description: state.syncError,
          variant: "destructive",
          action: (
            <ToastAction altText="Retry" onClick={() => actions.syncNow(true)}>
              Retry
            </ToastAction>
          ),
        });
      }

      addMessage({
        type: "error",
        title: "Sync Failed",
        description: state.syncError,
        action: {
          label: "Retry",
          handler: () => actions.syncNow(true),
        },
        autoHide: false,
      });
    }
  }, [state.syncError, enableToasts, toast, actions]);

  // Browser notifications (if enabled and permissions granted)
  useEffect(() => {
    if (enableNotifications && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, [enableNotifications]);

  const addMessage = (
    messageData: Omit<OfflineMessage, "id" | "timestamp">
  ) => {
    const message: OfflineMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...messageData,
    };

    setMessages((prev) => {
      const newMessages = [message, ...prev].slice(0, maxMessages);

      // Auto-hide message if specified
      if (message.autoHide) {
        setTimeout(() => {
          removeMessage(message.id);
        }, message.duration || 5000);
      }

      return newMessages;
    });

    // Show browser notification if enabled
    if (
      enableNotifications &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification(message.title, {
        body: message.description,
        icon: "/icon-192.png",
        tag: `offline-message-${message.type}`,
      });
    }
  };

  const removeMessage = (id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  };

  const clearAllMessages = () => {
    setMessages([]);
  };

  return (
    <ToastProvider>
      {children}
      <ToastViewport />
    </ToastProvider>
  );
}

// Message display component for showing persistent messages
export function OfflineMessageList({
  className,
  maxVisible = 3,
}: {
  className?: string;
  maxVisible?: number;
}) {
  const networkStatus = useNetworkStatus();
  const { state, actions } = useEnhancedOfflineQueue();

  const getRelevantMessages = (): OfflineMessage[] => {
    const messages: OfflineMessage[] = [];

    // Offline status message
    if (!networkStatus.isOnline) {
      messages.push({
        id: "offline-status",
        type: "warning",
        title: "Working Offline",
        description: `You can continue working. ${state.queueStats.pending} actions will sync when connected.`,
        timestamp: Date.now(),
      });
    }

    // Unstable connection message
    if (networkStatus.isOnline && networkStatus.isUnstable) {
      messages.push({
        id: "unstable-connection",
        type: "warning",
        title: "Unstable Connection",
        description: "Some features may be limited due to poor connectivity.",
        timestamp: Date.now(),
      });
    }

    // Pending actions message
    if (state.queueStats.pending > 0 && networkStatus.isOnline) {
      messages.push({
        id: "pending-sync",
        type: "info",
        title: "Syncing Actions",
        description: `${state.queueStats.pending} actions waiting to sync`,
        action: {
          label: "Sync Now",
          handler: () => actions.syncNow(true),
        },
        timestamp: Date.now(),
      });
    }

    // Failed actions message
    if (state.queueStats.failed > 0) {
      messages.push({
        id: "failed-actions",
        type: "error",
        title: "Sync Failed",
        description: `${state.queueStats.failed} actions failed to sync`,
        action: {
          label: "Retry",
          handler: () => actions.syncNow(true),
        },
        timestamp: Date.now(),
      });
    }

    // Sync recommendations message
    if (!state.syncRecommendations.shouldSync && state.queueStats.pending > 0) {
      messages.push({
        id: "sync-delayed",
        type: "info",
        title: "Sync Delayed",
        description: state.syncRecommendations.reason,
        timestamp: Date.now(),
      });
    }

    return messages.slice(0, maxVisible);
  };

  const messages = getRelevantMessages();

  if (messages.length === 0) {
    return null;
  }

  const getIcon = (type: OfflineMessage["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      case "error":
        return <X className="h-4 w-4" />;
      case "info":
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getVariant = (type: OfflineMessage["type"]) => {
    switch (type) {
      case "error":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <div className={className}>
      {messages.map((message) => (
        <Alert
          key={message.id}
          variant={getVariant(message.type)}
          className="mb-2"
        >
          {getIcon(message.type)}
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{message.title}</div>
                <div className="text-sm">{message.description}</div>
              </div>
              {message.action && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={message.action.handler}
                  className="ml-4"
                >
                  {message.action.label}
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

// Hook for programmatic message management
export function useOfflineMessaging() {
  const networkStatus = useNetworkStatus();
  const { state, actions } = useEnhancedOfflineQueue();
  const { toast } = useToast();

  const showConnectivityMessage = (type: "online" | "offline" | "unstable") => {
    switch (type) {
      case "online":
        toast({
          title: "Connected",
          description: "Connection restored successfully",
        });
        break;
      case "offline":
        toast({
          title: "Offline",
          description: "Working offline - actions will sync when connected",
          variant: "destructive",
        });
        break;
      case "unstable":
        toast({
          title: "Poor Connection",
          description: "Connection is unstable - some features may be limited",
        });
        break;
    }
  };

  const showSyncMessage = (
    type: "started" | "completed" | "failed",
    details?: string
  ) => {
    switch (type) {
      case "started":
        toast({
          title: "Syncing...",
          description: details || "Synchronizing offline actions",
        });
        break;
      case "completed":
        toast({
          title: "Sync Complete",
          description: details || "All actions synchronized successfully",
        });
        break;
      case "failed":
        toast({
          title: "Sync Failed",
          description: details || "Failed to sync some actions",
          variant: "destructive",
          action: (
            <ToastAction altText="Retry" onClick={() => actions.syncNow(true)}>
              Retry
            </ToastAction>
          ),
        });
        break;
    }
  };

  const showActionMessage = (
    action: "check-in" | "check-out",
    success: boolean,
    offline: boolean
  ) => {
    const actionName = action === "check-in" ? "Check-in" : "Check-out";

    if (success) {
      toast({
        title: `${actionName} ${offline ? "Queued" : "Successful"}`,
        description: offline
          ? `${actionName} saved offline - will sync when connected`
          : `${actionName} completed successfully`,
      });
    } else {
      toast({
        title: `${actionName} Failed`,
        description: `Failed to ${action.replace("-", " ")} - please try again`,
        variant: "destructive",
      });
    }
  };

  return {
    showConnectivityMessage,
    showSyncMessage,
    showActionMessage,
    networkStatus,
    queueState: state,
    queueActions: actions,
  };
}
