// Offline status indicator component with user messaging
// Provides visual feedback about connectivity status and offline capabilities

import React from "react";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { useEnhancedOfflineQueue } from "@/lib/hooks/useEnhancedOfflineQueue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  CheckCircle,
  RefreshCw,
  Signal,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface OfflineStatusIndicatorProps {
  variant?: "compact" | "full" | "banner";
  showSyncButton?: boolean;
  showQueueInfo?: boolean;
  className?: string;
}

export function OfflineStatusIndicator({
  variant = "compact",
  showSyncButton = true,
  showQueueInfo = true,
  className,
}: OfflineStatusIndicatorProps) {
  const networkStatus = useNetworkStatus();
  const { state, actions } = useEnhancedOfflineQueue({
    enableDebugLogs: false,
  });

  const getStatusIcon = () => {
    if (!networkStatus.isOnline) {
      return <WifiOff className="h-4 w-4" />;
    }
    if (networkStatus.isUnstable) {
      return <AlertTriangle className="h-4 w-4" />;
    }
    return <Wifi className="h-4 w-4" />;
  };

  const getStatusColor = () => {
    if (!networkStatus.isOnline) return "text-red-600";
    if (networkStatus.isUnstable) return "text-yellow-600";
    if (networkStatus.connectivityScore >= 80) return "text-green-600";
    if (networkStatus.connectivityScore >= 60) return "text-blue-600";
    return "text-gray-600";
  };

  const getStatusText = () => {
    if (!networkStatus.isOnline) return "Offline";
    if (networkStatus.isUnstable) return "Unstable";
    if (networkStatus.connectivityScore >= 80) return "Excellent";
    if (networkStatus.connectivityScore >= 60) return "Good";
    if (networkStatus.connectivityScore >= 40) return "Fair";
    return "Poor";
  };

  const getQueueStatusText = () => {
    const { queueStats } = state;
    if (queueStats.pending > 0) {
      return `${queueStats.pending} pending actions`;
    }
    if (queueStats.syncing > 0) {
      return `${queueStats.syncing} syncing`;
    }
    if (queueStats.failed > 0) {
      return `${queueStats.failed} failed`;
    }
    return "All synced";
  };

  const handleSyncNow = async () => {
    try {
      await actions.syncNow(true);
    } catch (error) {
      console.error("Manual sync failed:", error);
    }
  };

  // Compact variant - just icon and basic status
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <div className={cn("flex items-center", getStatusColor())}>
          {getStatusIcon()}
        </div>
        {state.queueStats.pending > 0 && (
          <Badge variant="secondary" className="text-xs">
            {state.queueStats.pending}
          </Badge>
        )}
      </div>
    );
  }

  // Banner variant - full width status bar
  if (variant === "banner") {
    if (
      networkStatus.isOnline &&
      !networkStatus.isUnstable &&
      state.queueStats.pending === 0
    ) {
      return null; // Hide banner when online, stable, and everything is synced
    }

    return (
      <Alert className={cn("mb-4", className)}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div className={getStatusColor()}>{getStatusIcon()}</div>
            <div>
              <AlertDescription className="m-0">
                {!networkStatus.isOnline ? (
                  <>
                    <span className="font-medium">Working offline</span>
                    {state.queueStats.pending > 0 && (
                      <span className="ml-2">
                        • {state.queueStats.pending} actions will sync when
                        connected
                      </span>
                    )}
                  </>
                ) : networkStatus.isUnstable ? (
                  <>
                    <span className="font-medium">Connection unstable</span>
                    <span className="ml-2">• Some features may be limited</span>
                  </>
                ) : state.queueStats.pending > 0 ? (
                  <>
                    <span className="font-medium">Syncing pending actions</span>
                    <span className="ml-2">
                      • {state.queueStats.pending} remaining
                    </span>
                  </>
                ) : null}
              </AlertDescription>
            </div>
          </div>

          {showSyncButton &&
            state.queueStats.pending > 0 &&
            networkStatus.isOnline && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncNow}
                disabled={state.isSyncing}
                className="ml-4"
              >
                {state.isSyncing ? (
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Sync Now
              </Button>
            )}
        </div>
      </Alert>
    );
  }

  // Full variant - detailed status display
  return (
    <div className={cn("space-y-3", className)}>
      {/* Connection Status */}
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center", getStatusColor())}>
            {getStatusIcon()}
          </div>
          <div>
            <div className="font-medium">
              {networkStatus.isOnline ? "Online" : "Offline"}
            </div>
            <div className="text-sm text-muted-foreground">
              Connection: {getStatusText()}
            </div>
          </div>
        </div>

        {networkStatus.isOnline && (
          <div className="text-right">
            <div className="text-sm font-medium">
              {networkStatus.connectivityScore}/100
            </div>
            <div className="text-xs text-muted-foreground">Quality Score</div>
          </div>
        )}
      </div>

      {/* Quality Progress Bar (only when online) */}
      {networkStatus.isOnline && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Connection Quality</span>
            <span className="text-muted-foreground">
              {networkStatus.connectivityScore}%
            </span>
          </div>
          <Progress value={networkStatus.connectivityScore} className="h-2" />
        </div>
      )}

      {/* Queue Status */}
      {showQueueInfo && (
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center text-blue-600">
              {state.isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : state.queueStats.pending > 0 ? (
                <Clock className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
            </div>
            <div>
              <div className="font-medium">Queue Status</div>
              <div className="text-sm text-muted-foreground">
                {getQueueStatusText()}
              </div>
            </div>
          </div>

          {showSyncButton &&
            state.queueStats.pending > 0 &&
            networkStatus.isOnline && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncNow}
                disabled={state.isSyncing}
              >
                {state.isSyncing ? (
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Sync
              </Button>
            )}
        </div>
      )}

      {/* Sync Recommendations */}
      {!state.syncRecommendations.shouldSync &&
        state.queueStats.pending > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Sync delayed:</strong> {state.syncRecommendations.reason}
              {state.syncRecommendations.recommendedDelay && (
                <span className="ml-1">
                  (Recommended wait:{" "}
                  {Math.round(
                    state.syncRecommendations.recommendedDelay / 1000
                  )}
                  s)
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

      {/* Offline Message */}
      {!networkStatus.isOnline && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Working offline:</strong> You can still check in and out.
            Actions will sync automatically when connection returns.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default OfflineStatusIndicator;
