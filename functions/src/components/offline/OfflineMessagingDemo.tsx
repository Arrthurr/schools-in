// Demo component for offline messaging and status indicators
// Showcases Task 11.6: Add offline status indicators and user messaging

"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { OfflineStatusIndicator } from "./OfflineStatusIndicator";
import { OfflineMessageList, useOfflineMessaging } from "./OfflineMessaging";
import { OfflineStatusBar } from "./OfflineStatusBar";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { useEnhancedOfflineQueue } from "@/lib/hooks/useEnhancedOfflineQueue";

const DemoControls: React.FC = () => {
  const messaging = useOfflineMessaging();
  const { state: queueState } = useEnhancedOfflineQueue();
  const networkStatus = useNetworkStatus();

  const handleConnectivityDemo = (type: "online" | "offline" | "unstable") => {
    messaging.showConnectivityMessage(type);
  };

  const handleSyncDemo = (
    type: "started" | "completed" | "failed" | "delayed"
  ) => {
    const messages = {
      started: "Synchronizing your actions...",
      completed: "All actions synchronized successfully",
      failed: "Sync failed due to network error",
      delayed: "Sync delayed - poor connection quality",
    };

    if (type === "delayed") {
      // Show a custom message for delayed sync
      messaging.showConnectivityMessage("unstable");
    } else {
      messaging.showSyncMessage(type, messages[type]);
    }
  };

  const handleActionDemo = (
    action: "check-in" | "check-out",
    success: boolean
  ) => {
    messaging.showActionMessage(action, success, false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-2">Connectivity Messages</h4>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleConnectivityDemo("online")}
          >
            Show Online
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleConnectivityDemo("offline")}
          >
            Show Offline
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleConnectivityDemo("unstable")}
          >
            Show Unstable
          </Button>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Sync Messages</h4>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSyncDemo("started")}
          >
            Sync Started
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSyncDemo("completed")}
          >
            Sync Complete
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSyncDemo("failed")}
          >
            Sync Failed
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSyncDemo("delayed")}
          >
            Sync Delayed
          </Button>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Action Messages</h4>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleActionDemo("check-in", true)}
          >
            Check-in Success
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleActionDemo("check-in", false)}
          >
            Check-in Failed
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleActionDemo("check-out", true)}
          >
            Check-out Success
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleActionDemo("check-out", false)}
          >
            Check-out Failed
          </Button>
        </div>
      </div>
    </div>
  );
};

const StatusInfo: React.FC = () => {
  const networkStatus = useNetworkStatus();
  const { state: queueState } = useEnhancedOfflineQueue();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Current Network Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Connection:</span>
              <Badge
                variant={networkStatus.isOnline ? "default" : "destructive"}
              >
                {networkStatus.isOnline ? "Online" : "Offline"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Quality:</span>
              <span>{networkStatus.connectivityScore}/100</span>
            </div>
            <div className="flex justify-between">
              <span>Stable:</span>
              <Badge
                variant={networkStatus.isUnstable ? "secondary" : "default"}
              >
                {networkStatus.isUnstable ? "Unstable" : "Stable"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Queue Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total:</span>
              <span>{queueState.queueStats.total}</span>
            </div>
            <div className="flex justify-between">
              <span>Pending:</span>
              <Badge
                variant={
                  queueState.queueStats.pending > 0 ? "secondary" : "default"
                }
              >
                {queueState.queueStats.pending}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Syncing:</span>
              <span>{queueState.queueStats.syncing}</span>
            </div>
            <div className="flex justify-between">
              <span>Failed:</span>
              <Badge
                variant={
                  queueState.queueStats.failed > 0 ? "destructive" : "default"
                }
              >
                {queueState.queueStats.failed}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const OfflineMessagingDemo: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState("indicators");

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Offline Messaging System Demo</h1>
        <p className="text-muted-foreground">
          Task 11.6: Comprehensive offline status indicators and user messaging
        </p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="indicators">Status Indicators</TabsTrigger>
          <TabsTrigger value="messages">Message List</TabsTrigger>
          <TabsTrigger value="status-bars">Status Bars</TabsTrigger>
          <TabsTrigger value="controls">Demo Controls</TabsTrigger>
        </TabsList>

        <TabsContent value="indicators" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Offline Status Indicators</CardTitle>
              <CardDescription>
                Different variants for various UI contexts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-medium mb-3">Compact Variant</h4>
                <div className="flex items-center gap-4">
                  <OfflineStatusIndicator variant="compact" />
                  <span className="text-sm text-muted-foreground">
                    Minimal indicator for headers/toolbars
                  </span>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3">Banner Variant</h4>
                <OfflineStatusIndicator
                  variant="banner"
                  showSyncButton={true}
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Shows when offline or issues exist
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3">Full Variant</h4>
                <OfflineStatusIndicator
                  variant="full"
                  showQueueInfo={true}
                  showSyncButton={true}
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Complete status information with detailed metrics
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StatusInfo />
          </div>
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Message List Component</CardTitle>
              <CardDescription>
                Persistent messages that provide ongoing feedback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Current Messages:</h4>
                <div className="min-h-[200px] border rounded-md p-4">
                  <OfflineMessageList />
                </div>
                <p className="text-sm text-muted-foreground">
                  Messages appear here based on connection status and queue
                  state. Use the demo controls to trigger different message
                  types.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status-bars" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status Bar Components</CardTitle>
              <CardDescription>
                Persistent status bars for different layout contexts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-medium mb-3">Minimal Variant</h4>
                <OfflineStatusBar variant="minimal" />
                <p className="text-sm text-muted-foreground mt-2">
                  Shows only when there are issues to report
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3">Compact Variant</h4>
                <OfflineStatusBar variant="compact" />
                <p className="text-sm text-muted-foreground mt-2">
                  Balanced information display
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3">Full Variant</h4>
                <OfflineStatusBar variant="full" />
                <p className="text-sm text-muted-foreground mt-2">
                  Always visible with complete status information
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Demo Controls</CardTitle>
              <CardDescription>
                Test different messaging scenarios and UI feedback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DemoControls />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integration Examples</CardTitle>
              <CardDescription>
                How offline messaging integrates with existing components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-md">
                  <h4 className="text-sm font-medium mb-2">
                    Check-in Button Example
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Shows how action feedback is integrated into existing
                    components
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        // This would be handled by the component's own messaging hook
                        console.log(
                          "Check-in button clicked - messaging handled by component"
                        );
                      }}
                    >
                      Check In
                    </Button>
                    <OfflineStatusIndicator variant="compact" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
