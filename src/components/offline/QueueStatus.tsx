// Queue status component for monitoring offline actions
// Shows pending, failed, and synced actions with management controls

"use client";

import { useState, useEffect } from "react";
import { useOfflineQueue, QUEUE_STATUS } from "@/lib/hooks/useOfflineQueue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  Trash2,
  RotateCcw,
  Activity,
  Database,
  TrendingUp,
  Users,
  MapPin,
} from "lucide-react";

interface QueueStatusProps {
  userId?: string;
  autoSync?: boolean;
  showDetails?: boolean;
  compact?: boolean;
}

export function QueueStatus({
  userId,
  autoSync = true,
  showDetails = false,
  compact = false,
}: QueueStatusProps) {
  const {
    isInitialized,
    pendingActions,
    stats,
    isProcessing,
    lastSyncTime,
    error,
    isOnline,
    hasPendingActions,
    hasFailedActions,
    syncQueue,
    retryQueuedAction,
    cancelQueuedAction,
    clearCompletedActions,
    refreshQueue,
  } = useOfflineQueue(userId, autoSync);

  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      refreshQueue();
    }, 30000);

    return () => clearInterval(interval);
  }, [isInitialized, refreshQueue]);

  const handleSyncNow = async () => {
    const result = await syncQueue();
    if (result) {
      console.log("Manual sync completed:", result);
    }
  };

  const handleRetryAction = async (actionId: string) => {
    const success = await retryQueuedAction(actionId);
    if (success) {
      console.log("Action retry initiated:", actionId);
    }
  };

  const handleCancelAction = async (actionId: string) => {
    const success = await cancelQueuedAction(actionId);
    if (success) {
      console.log("Action cancelled:", actionId);
    }
  };

  const handleClearCompleted = async () => {
    const removedCount = await clearCompletedActions();
    console.log(`Cleared ${removedCount} completed actions`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case QUEUE_STATUS.PENDING:
        return <Clock className="h-4 w-4 text-orange-500" />;
      case QUEUE_STATUS.SYNCING:
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case QUEUE_STATUS.SYNCED:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case QUEUE_STATUS.FAILED:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case QUEUE_STATUS.CANCELLED:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case QUEUE_STATUS.PENDING:
        return "secondary";
      case QUEUE_STATUS.SYNCING:
        return "default";
      case QUEUE_STATUS.SYNCED:
        return "default";
      case QUEUE_STATUS.FAILED:
        return "destructive";
      case QUEUE_STATUS.CANCELLED:
        return "outline";
      default:
        return "secondary";
    }
  };

  const formatActionType = (type: string) => {
    switch (type) {
      case "check_in":
        return "Check In";
      case "check_out":
        return "Check Out";
      case "session_update":
        return "Session Update";
      case "location_update":
        return "Location Update";
      default:
        return type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getTimeSince = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  if (!isInitialized) {
    return (
      <Card className={compact ? "p-4" : ""}>
        <CardContent className={compact ? "p-0" : ""}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Initializing queue...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        {/* Network Status */}
        <div className="flex items-center gap-1">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <span className="text-xs text-muted-foreground">
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>

        {/* Queue Status */}
        {(hasPendingActions || hasFailedActions) && (
          <div className="flex items-center gap-2">
            {hasPendingActions && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {stats.pending} pending
              </Badge>
            )}
            {hasFailedActions && (
              <Badge variant="destructive" className="text-xs">
                <XCircle className="h-3 w-3 mr-1" />
                {stats.failed} failed
              </Badge>
            )}
          </div>
        )}

        {/* Sync Button */}
        {isOnline && hasPendingActions && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncNow}
            disabled={isProcessing}
            className="h-6 px-2 text-xs"
          >
            {isProcessing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle className="text-lg">Offline Queue Status</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge variant="default" className="flex items-center gap-1">
                <Wifi className="h-3 w-3" />
                Online
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>
        <CardDescription>
          Monitor and manage offline actions queue
          {lastSyncTime && (
            <span className="block text-xs mt-1">
              Last sync: {formatTimestamp(lastSyncTime)}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Queue Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {stats.pending}
            </div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {stats.syncing}
            </div>
            <div className="text-xs text-muted-foreground">Syncing</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {stats.synced}
            </div>
            <div className="text-xs text-muted-foreground">Synced</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {stats.failed}
            </div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={handleSyncNow}
            disabled={!isOnline || isProcessing || !hasPendingActions}
            className="flex items-center gap-1"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync Now
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={refreshQueue}
            className="flex items-center gap-1"
          >
            <Database className="h-4 w-4" />
            Refresh
          </Button>

          {stats.synced > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearCompleted}
              className="flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Clear Completed
            </Button>
          )}
        </div>

        {/* Detailed Action List */}
        {isExpanded && showDetails && pendingActions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Recent Actions</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pendingActions.slice(0, 10).map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(action.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {formatActionType(action.type)}
                          </span>
                          <Badge
                            variant={getStatusBadgeVariant(action.status)}
                            className="text-xs"
                          >
                            {action.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getTimeSince(action.timestamp)}
                          {action.schoolId && (
                            <span className="ml-2">
                              • School: {action.schoolId}
                            </span>
                          )}
                          {action.retryCount > 0 && (
                            <span className="ml-2">
                              • Retries: {action.retryCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {action.status === QUEUE_STATUS.FAILED && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetryAction(action.id)}
                          className="h-6 px-2"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                      {(action.status === QUEUE_STATUS.PENDING ||
                        action.status === QUEUE_STATUS.FAILED) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancelAction(action.id)}
                          className="h-6 px-2"
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* No Actions Message */}
        {pendingActions.length === 0 && stats.total === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No queued actions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
