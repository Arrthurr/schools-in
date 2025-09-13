// Example component demonstrating Task 11.5: Sync mechanism for when connectivity returns
// Shows intelligent sync management with network awareness and priority handling

import React, { useState } from "react";
import { useEnhancedOfflineQueue } from "@/lib/hooks/useEnhancedOfflineQueue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Wifi,
  WifiOff,
  RotateCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Signal,
  RefreshCw,
} from "lucide-react";

export function OfflineSyncDemo() {
  const { state, actions } = useEnhancedOfflineQueue({
    enableDebugLogs: true,
    autoRefreshInterval: 3000,
    restorationConfig: {
      enableAutoSync: true,
      enableGradualSync: true,
      stabilityWaitMs: 2000,
      maxSyncAttempts: 3,
      enableSyncNotifications: true,
      debugMode: true,
    },
  });

  const [demoUserId] = useState("demo-user-123");
  const [demoSchoolId] = useState("demo-school-456");
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>();

  // Mock location for demo
  const demoLocation = {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 10,
  };

  const handleCheckIn = async () => {
    const result = await actions.checkIn(
      demoSchoolId,
      demoUserId,
      demoLocation
    );

    if (result.success) {
      setIsCheckedIn(true);
      if (result.sessionId) {
        setCurrentSessionId(result.sessionId);
      }
    }
  };

  const handleCheckOut = async () => {
    if (!currentSessionId) return;

    const result = await actions.checkOut(
      currentSessionId,
      demoUserId,
      demoLocation
    );

    if (result.success) {
      setIsCheckedIn(false);
      setCurrentSessionId(undefined);
    }
  };

  const getNetworkStatusIcon = () => {
    if (!state.isOnline) return <WifiOff className="h-4 w-4 text-red-500" />;
    if (state.isUnstable)
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <Wifi className="h-4 w-4 text-green-500" />;
  };

  const getNetworkStatusColor = () => {
    if (!state.isOnline) return "destructive";
    if (state.isUnstable) return "secondary";
    return "default";
  };

  const getConnectivityQuality = () => {
    if (state.connectivityScore >= 80) return "Excellent";
    if (state.connectivityScore >= 60) return "Good";
    if (state.connectivityScore >= 40) return "Fair";
    if (state.connectivityScore >= 20) return "Poor";
    return "Very Poor";
  };

  const getSyncStatusIcon = () => {
    if (state.isSyncing || state.isRestoring)
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (state.lastSyncResult?.success)
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (state.syncError) return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">
          Task 11.5: Intelligent Sync Demo
        </h1>
        <p className="text-muted-foreground">
          Demonstrates sync mechanism for when connectivity returns with
          network-aware strategies
        </p>
      </div>

      {/* Network Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getNetworkStatusIcon()}
            Network Status
          </CardTitle>
          <CardDescription>
            Real-time network connectivity and quality assessment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium">Connection</p>
              <Badge variant={getNetworkStatusColor()}>
                {state.isOnline ? "Online" : "Offline"}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Stability</p>
              <Badge variant={state.isUnstable ? "secondary" : "default"}>
                {state.isUnstable ? "Unstable" : "Stable"}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium">Quality</p>
              <p className="text-sm text-muted-foreground">
                {getConnectivityQuality()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Score</p>
              <p className="text-sm text-muted-foreground">
                {state.connectivityScore}/100
              </p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Connectivity Score</span>
              <span>{state.connectivityScore}%</span>
            </div>
            <Progress value={state.connectivityScore} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Sync Recommendations Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Sync Recommendations
          </CardTitle>
          <CardDescription>
            AI-powered sync strategy recommendations based on network conditions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Should Sync:</span>
              <Badge
                variant={
                  state.syncRecommendations.shouldSync ? "default" : "secondary"
                }
              >
                {state.syncRecommendations.shouldSync ? "Yes" : "No"}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Reason:</span>
              <p className="text-sm text-muted-foreground mt-1">
                {state.syncRecommendations.reason}
              </p>
            </div>
            {state.syncRecommendations.recommendedDelay && (
              <div>
                <span className="font-medium">Recommended Delay:</span>
                <p className="text-sm text-muted-foreground">
                  {Math.round(
                    state.syncRecommendations.recommendedDelay / 1000
                  )}
                  s
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Queue Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Signal className="h-4 w-4" />
            Queue Status
          </CardTitle>
          <CardDescription>
            Offline action queue statistics and sync status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{state.queueStats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {state.queueStats.pending}
              </p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {state.queueStats.syncing}
              </p>
              <p className="text-sm text-muted-foreground">Syncing</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {state.queueStats.synced}
              </p>
              <p className="text-sm text-muted-foreground">Synced</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {state.queueStats.failed}
              </p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">
                {state.queueStats.cancelled}
              </p>
              <p className="text-sm text-muted-foreground">Cancelled</p>
            </div>
          </div>

          {/* Sync Status */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getSyncStatusIcon()}
                <span className="font-medium">
                  {state.isSyncing
                    ? "Syncing..."
                    : state.isRestoring
                    ? "Restoring connectivity..."
                    : "Ready"}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => actions.syncNow(true)}
                  disabled={state.isSyncing || state.isRestoring}
                  size="sm"
                  variant="outline"
                >
                  <RotateCw className="h-4 w-4 mr-1" />
                  Force Sync
                </Button>
                <Button
                  onClick={() => actions.triggerRestoration("manual")}
                  disabled={state.isSyncing || state.isRestoring}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Restore
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demo Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Demo Actions</CardTitle>
          <CardDescription>
            Test offline queue and sync functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={handleCheckIn}
              disabled={isCheckedIn || state.isSyncing}
              className="flex-1"
            >
              Check In
            </Button>
            <Button
              onClick={handleCheckOut}
              disabled={!isCheckedIn || state.isSyncing}
              variant="outline"
              className="flex-1"
            >
              Check Out
            </Button>
          </div>

          {isCheckedIn && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Currently checked in{" "}
                {currentSessionId && `(Session: ${currentSessionId})`}
              </AlertDescription>
            </Alert>
          )}

          {state.syncError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{state.syncError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Last Sync Result */}
      {state.lastSyncResult && (
        <Card>
          <CardHeader>
            <CardTitle>Last Sync Result</CardTitle>
            <CardDescription>
              Details from the most recent sync operation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium">Strategy</p>
                <Badge variant="outline">{state.lastSyncResult.strategy}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Processed</p>
                <p className="text-sm text-muted-foreground">
                  {state.lastSyncResult.processed}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Synced</p>
                <p className="text-sm text-muted-foreground">
                  {state.lastSyncResult.synced}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Failed</p>
                <p className="text-sm text-muted-foreground">
                  {state.lastSyncResult.failed}
                </p>
              </div>
            </div>

            {state.lastSyncResult.errors &&
              state.lastSyncResult.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Errors:</p>
                  <div className="space-y-1">
                    {state.lastSyncResult.errors.map((error, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertDescription>
                          Action {error.actionId}: {error.error}
                          {error.willRetry && " (Will retry)"}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Pending Actions */}
      {state.pendingActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Actions</CardTitle>
            <CardDescription>
              Actions waiting to be synchronized
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {state.pendingActions.slice(0, 5).map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div>
                    <p className="font-medium">{action.type}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(action.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      action.status === "pending"
                        ? "secondary"
                        : action.status === "syncing"
                        ? "default"
                        : action.status === "synced"
                        ? "default"
                        : action.status === "failed"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {action.status}
                  </Badge>
                </div>
              ))}
              {state.pendingActions.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  ... and {state.pendingActions.length - 5} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
