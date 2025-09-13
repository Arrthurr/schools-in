// Offline status bar component for layout integration
// Provides persistent offline status information across the application

import React from "react";
import { OfflineStatusIndicator } from "./OfflineStatusIndicator";
import { OfflineMessageList } from "./OfflineMessaging";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { useEnhancedOfflineQueue } from "@/lib/hooks/useEnhancedOfflineQueue";
import { cn } from "@/lib/utils";

export interface OfflineStatusBarProps {
  variant?: "minimal" | "compact" | "full";
  position?: "top" | "bottom";
  showMessages?: boolean;
  className?: string;
}

export function OfflineStatusBar({
  variant = "compact",
  position = "top",
  showMessages = true,
  className,
}: OfflineStatusBarProps) {
  const networkStatus = useNetworkStatus();
  const { state } = useEnhancedOfflineQueue();

  // Only show the status bar when offline or when there are pending/failed actions
  const shouldShow =
    !networkStatus.isOnline ||
    state.queueStats.pending > 0 ||
    state.queueStats.failed > 0 ||
    networkStatus.isUnstable;

  if (!shouldShow && variant !== "full") {
    return null;
  }

  const getStatusBarContent = () => {
    switch (variant) {
      case "minimal":
        return (
          <div className="flex items-center justify-between">
            <OfflineStatusIndicator
              variant="compact"
              className="flex-shrink-0"
            />
            {(state.queueStats.pending > 0 || state.queueStats.failed > 0) && (
              <div className="text-xs text-muted-foreground ml-2">
                {state.queueStats.pending > 0 &&
                  `${state.queueStats.pending} pending`}
                {state.queueStats.pending > 0 &&
                  state.queueStats.failed > 0 &&
                  ", "}
                {state.queueStats.failed > 0 &&
                  `${state.queueStats.failed} failed`}
              </div>
            )}
          </div>
        );

      case "compact":
        return (
          <div className="space-y-2">
            <OfflineStatusIndicator
              variant="banner"
              showSyncButton={true}
              showQueueInfo={false}
            />
            {showMessages && <OfflineMessageList maxVisible={1} />}
          </div>
        );

      case "full":
        return (
          <div className="space-y-3">
            <OfflineStatusIndicator
              variant="full"
              showSyncButton={true}
              showQueueInfo={true}
            />
            {showMessages && <OfflineMessageList maxVisible={3} />}
          </div>
        );

      default:
        return null;
    }
  };

  const positionClasses = {
    top: "top-0",
    bottom: "bottom-0",
  };

  return (
    <div
      className={cn(
        "w-full z-40",
        variant === "full"
          ? "relative p-4 bg-background border-b"
          : `sticky ${positionClasses[position]} bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2`,
        className
      )}
    >
      {getStatusBarContent()}
    </div>
  );
}

export default OfflineStatusBar;
