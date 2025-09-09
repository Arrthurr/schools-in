"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, RefreshCw, Upload, Wifi, AlertCircle } from "lucide-react";
import { useOffline } from "@/lib/hooks/useOffline";

export function OfflineNotification() {
  const { isOnline, syncInProgress, lastSyncTime } = useOffline();
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    // Show notification when offline or syncing
    setShowNotification(!isOnline || syncInProgress);
  }, [isOnline, syncInProgress]);

  if (!showNotification) {
    return null;
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isOnline ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <RefreshCw className={`h-5 w-5 ${syncInProgress ? 'animate-spin' : ''} text-blue-500`} />
            )}
            <div>
              <p className="font-medium">
                {!isOnline ? 'Working Offline' : 'Syncing Data'}
              </p>
              <p className="text-sm text-muted-foreground">
                {!isOnline 
                  ? 'Actions will sync when connection is restored'
                  : 'Synchronizing with server...'
                }
              </p>
            </div>
          </div>
          <Badge variant={!isOnline ? "destructive" : "secondary"}>
            {!isOnline ? 'Offline' : 'Syncing'}
          </Badge>
        </div>
        
        {lastSyncTime && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              Last sync: {lastSyncTime.toLocaleTimeString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
