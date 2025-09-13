// Comprehensive offline messaging demo page
// Demonstrates all offline status indicators and messaging features for Task 11.6

import React, { useState } from "react";
import { OfflineStatusIndicator } from "@/components/offline/OfflineStatusIndicator";
import {
  OfflineMessagingProvider,
  OfflineMessageList,
  useOfflineMessaging,
} from "@/components/offline/OfflineMessaging";
import { OfflineStatusBar } from "@/components/offline/OfflineStatusBar";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Wifi,
  WifiOff,
  Info,
  MessageSquare,
  Bell,
  Activity,
  Settings,
  Monitor,
} from "lucide-react";

function OfflineMessagingDemoContent() {
  const networkStatus = useNetworkStatus();
  const { state, actions } = useEnhancedOfflineQueue();
  const messaging = useOfflineMessaging();

  const [demoUserId] = useState("demo-user-456");
  const [demoSchoolId] = useState("demo-school-789");
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  // Mock location for demo
  const demoLocation = {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 10,
  };

  const handleDemoCheckIn = async () => {
    const result = await actions.checkIn(
      demoSchoolId,
      demoUserId,
      demoLocation
    );
    messaging.showActionMessage("check-in", result.success, !!result.offline);
    if (result.success) {
      setIsCheckedIn(true);
    }
  };

  const handleDemoCheckOut = async () => {
    // For demo purposes, create a mock session ID
    const mockSessionId = "demo-session-123";
    const result = await actions.checkOut(
      mockSessionId,
      demoUserId,
      demoLocation
    );
    messaging.showActionMessage("check-out", result.success, !!result.offline);
    if (result.success) {
      setIsCheckedIn(false);
    }
  };

  const handleTestConnectivityMessages = () => {
    if (networkStatus.isOnline) {
      messaging.showConnectivityMessage("offline");
    } else {
      messaging.showConnectivityMessage("online");
    }
  };

  const handleTestSyncMessages = () => {
    messaging.showSyncMessage("started", "Testing sync messages...");
    setTimeout(() => {
      if (Math.random() > 0.5) {
        messaging.showSyncMessage(
          "completed",
          "Demo sync completed successfully"
        );
      } else {
        messaging.showSyncMessage("failed", "Demo sync failed for testing");
      }
    }, 2000);
  };

  const getNetworkStatusBadge = () => {
    if (!networkStatus.isOnline) {
      return <Badge variant="destructive">Offline</Badge>;
    }
    if (networkStatus.isUnstable) {
      return <Badge variant="secondary">Unstable</Badge>;
    }
    return <Badge variant="default">Online</Badge>;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">
          Task 11.6: Offline Status & Messaging
        </h1>
        <p className="text-muted-foreground">
          Comprehensive demonstration of offline status indicators and user
          messaging system
        </p>
      </div>

      {/* Current Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Current Status Overview
          </CardTitle>
          <CardDescription>
            Real-time status of network connectivity and offline queue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded">
              <span className="font-medium">Network Status</span>
              <div className="flex items-center gap-2">
                {getNetworkStatusBadge()}
                {networkStatus.isOnline ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-600" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded">
              <span className="font-medium">Pending Actions</span>
              <Badge
                variant={state.queueStats.pending > 0 ? "secondary" : "default"}
              >
                {state.queueStats.pending}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded">
              <span className="font-medium">Connectivity Score</span>
              <Badge variant="outline">
                {networkStatus.connectivityScore}/100
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="indicators" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="indicators">Status Indicators</TabsTrigger>
          <TabsTrigger value="messages">Message System</TabsTrigger>
          <TabsTrigger value="statusbar">Status Bars</TabsTrigger>
          <TabsTrigger value="demo">Interactive Demo</TabsTrigger>
        </TabsList>

        {/* Status Indicators Tab */}
        <TabsContent value="indicators" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status Indicator Variants</CardTitle>
              <CardDescription>
                Different display modes for showing offline status and queue
                information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Compact Variant */}
              <div>
                <h4 className="font-medium mb-2">Compact Variant</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Minimal display suitable for headers and toolbars
                </p>
                <div className="p-3 border rounded bg-gray-50 dark:bg-gray-900">
                  <OfflineStatusIndicator variant="compact" />
                </div>
              </div>

              <Separator />

              {/* Banner Variant */}
              <div>
                <h4 className="font-medium mb-2">Banner Variant</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Full-width banner for important status updates
                </p>
                <div className="border rounded">
                  <OfflineStatusIndicator variant="banner" />
                </div>
              </div>

              <Separator />

              {/* Full Variant */}
              <div>
                <h4 className="font-medium mb-2">Full Variant</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Detailed status display with all information and controls
                </p>
                <div className="p-4 border rounded">
                  <OfflineStatusIndicator
                    variant="full"
                    showSyncButton={true}
                    showQueueInfo={true}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Message System Tab */}
        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Messaging System
              </CardTitle>
              <CardDescription>
                Toast notifications and persistent message display
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Test Message Buttons */}
              <div>
                <h4 className="font-medium mb-3">Test Messages</h4>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleTestConnectivityMessages}
                    variant="outline"
                    size="sm"
                  >
                    Test Connectivity Messages
                  </Button>
                  <Button
                    onClick={handleTestSyncMessages}
                    variant="outline"
                    size="sm"
                  >
                    Test Sync Messages
                  </Button>
                  <Button
                    onClick={() =>
                      messaging.showActionMessage("check-in", true, true)
                    }
                    variant="outline"
                    size="sm"
                  >
                    Test Offline Check-in
                  </Button>
                  <Button
                    onClick={() =>
                      messaging.showActionMessage("check-out", false, false)
                    }
                    variant="outline"
                    size="sm"
                  >
                    Test Failed Check-out
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Current Messages */}
              <div>
                <h4 className="font-medium mb-3">Current Messages</h4>
                <OfflineMessageList maxVisible={5} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status Bars Tab */}
        <TabsContent value="statusbar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status Bar Variants</CardTitle>
              <CardDescription>
                Layout-integrated status bars for different use cases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Minimal Status Bar */}
              <div>
                <h4 className="font-medium mb-2">Minimal Status Bar</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Minimal status bar for compact layouts
                </p>
                <div className="border rounded overflow-hidden">
                  <OfflineStatusBar variant="minimal" />
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 text-center text-sm text-muted-foreground">
                    Main content area
                  </div>
                </div>
              </div>

              <Separator />

              {/* Compact Status Bar */}
              <div>
                <h4 className="font-medium mb-2">Compact Status Bar</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Standard status bar with essential information
                </p>
                <div className="border rounded overflow-hidden">
                  <OfflineStatusBar variant="compact" />
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 text-center text-sm text-muted-foreground">
                    Main content area
                  </div>
                </div>
              </div>

              <Separator />

              {/* Full Status Bar */}
              <div>
                <h4 className="font-medium mb-2">Full Status Bar</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Comprehensive status display with all features
                </p>
                <div className="border rounded overflow-hidden">
                  <OfflineStatusBar variant="full" />
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 text-center text-sm text-muted-foreground">
                    Main content area
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interactive Demo Tab */}
        <TabsContent value="demo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Interactive Demo
              </CardTitle>
              <CardDescription>
                Test offline functionality and messaging with real actions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Demo Actions */}
              <div>
                <h4 className="font-medium mb-3">Demo Actions</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Perform check-in/out actions to see offline messaging in
                  action
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={handleDemoCheckIn}
                    disabled={isCheckedIn || state.isSyncing}
                    className="flex-1"
                  >
                    Demo Check In
                  </Button>
                  <Button
                    onClick={handleDemoCheckOut}
                    disabled={!isCheckedIn || state.isSyncing}
                    variant="outline"
                    className="flex-1"
                  >
                    Demo Check Out
                  </Button>
                </div>

                {isCheckedIn && (
                  <Alert className="mt-4">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Currently checked in for demo purposes
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Separator />

              {/* Sync Controls */}
              <div>
                <h4 className="font-medium mb-3">Sync Controls</h4>
                <div className="flex gap-2">
                  <Button
                    onClick={() => actions.syncNow(true)}
                    disabled={state.isSyncing}
                    variant="outline"
                    size="sm"
                  >
                    Force Sync Now
                  </Button>
                  <Button
                    onClick={() => actions.triggerRestoration("manual-demo")}
                    disabled={state.isRestoring}
                    variant="outline"
                    size="sm"
                  >
                    Trigger Restoration
                  </Button>
                  <Button
                    onClick={() => actions.refreshStats()}
                    variant="outline"
                    size="sm"
                  >
                    Refresh Stats
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Current State */}
              <div>
                <h4 className="font-medium mb-3">Current State</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Network:</span>{" "}
                    {networkStatus.isOnline ? "Online" : "Offline"}
                  </div>
                  <div>
                    <span className="font-medium">Quality Score:</span>{" "}
                    {networkStatus.connectivityScore}/100
                  </div>
                  <div>
                    <span className="font-medium">Pending Actions:</span>{" "}
                    {state.queueStats.pending}
                  </div>
                  <div>
                    <span className="font-medium">Syncing:</span>{" "}
                    {state.isSyncing ? "Yes" : "No"}
                  </div>
                  <div>
                    <span className="font-medium">Restoring:</span>{" "}
                    {state.isRestoring ? "Yes" : "No"}
                  </div>
                  <div>
                    <span className="font-medium">Should Sync:</span>{" "}
                    {state.syncRecommendations.shouldSync ? "Yes" : "No"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function OfflineMessagingDemo() {
  return (
    <OfflineMessagingProvider
      maxMessages={5}
      enableToasts={true}
      enableNotifications={false}
    >
      <OfflineMessagingDemoContent />
    </OfflineMessagingProvider>
  );
}
