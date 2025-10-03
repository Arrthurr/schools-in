"use client";

import React from "react";
import {
  Clock,
  MapPin,
  TrendingUp,
  Activity,
  Play,
  Pause,
  Square,
  Timer,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { useProviderMetrics } from "../../lib/hooks/useProviderMetrics";
import { formatDuration } from "../../lib/utils/time";

interface ProviderDashboardCardsProps {
  onStartSession?: (locationId: string) => void;
  onSelectLocation?: () => void;
  availableLocations?: Array<{ id: string; name: string }>;
}

/**
 * Provider Dashboard Cards - Real-time metrics and session management
 * Displays current session status and weekly metrics for providers
 */
export function ProviderDashboardCards({
  onStartSession,
  onSelectLocation,
  availableLocations = [],
}: ProviderDashboardCardsProps) {
  const {
    currentSession,
    weeklyMetrics,
    isLoading,
    error,
    startSession,
    endSession,
    pauseSession,
    resumeSession,
    isSessionActive,
    sessionDuration,
    canStartSession,
    canEndSession,
    refresh,
  } = useProviderMetrics();

  const handleStartSession = async () => {
    if (availableLocations.length === 1) {
      // If only one location, start session immediately
      try {
        await startSession(availableLocations[0].id);
      } catch (error) {
        console.error("Failed to start session:", error);
      }
    } else if (onSelectLocation) {
      // Multiple locations - show selection dialog
      onSelectLocation();
    } else if (onStartSession && availableLocations.length > 0) {
      // Fallback to prop handler
      onStartSession(availableLocations[0].id);
    }
  };

  const getCurrentSessionLocationName = () => {
    if (!currentSession) return null;
    const location = availableLocations.find(
      (loc) => loc.id === currentSession.locationId
    );
    return location?.name || "Unknown Location";
  };

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertDescription>
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Current Session Card */}
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Current Session</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {currentSession ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {formatDuration(sessionDuration)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    at {getCurrentSessionLocationName()}
                  </p>
                </div>
                <Badge
                  variant={isSessionActive ? "default" : "secondary"}
                  className="capitalize"
                >
                  {currentSession.status}
                </Badge>
              </div>

              <div className="flex gap-2">
                {isSessionActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={pauseSession}
                    disabled={isLoading}
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </Button>
                )}

                {currentSession.status === "paused" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resumeSession}
                    disabled={isLoading}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </Button>
                )}

                {canEndSession && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      try {
                        console.log("Ending session...");
                        await endSession();
                        console.log("Session ended successfully");
                      } catch (err: any) {
                        console.error("Error ending session:", err);
                        alert(`Failed to end session: ${err?.message || "Unknown error"}`);
                      }
                    }}
                    disabled={isLoading}
                  >
                    <Square className="h-4 w-4 mr-1" />
                    End Session
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-2xl font-bold">No Active Session</p>
                <p className="text-xs text-muted-foreground">
                  Ready to start a new session
                </p>
              </div>

              {canStartSession && availableLocations.length > 0 && (
                <Button
                  onClick={handleStartSession}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Session
                </Button>
              )}

              {availableLocations.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No locations available
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Sessions Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {weeklyMetrics.weeklySessionsCount}
          </div>
          <p className="text-xs text-muted-foreground">completed sessions</p>
          <div className="mt-2 text-sm text-muted-foreground">
            {weeklyMetrics.weeklyTotalHours.toFixed(1)} hours total
          </div>
        </CardContent>
      </Card>

      {/* Locations Visited Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Locations</CardTitle>
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {weeklyMetrics.locationsVisited}
          </div>
          <p className="text-xs text-muted-foreground">visited this week</p>
          {weeklyMetrics.mostVisitedLocation && (
            <div className="mt-2 text-sm text-muted-foreground">
              Most visited:{" "}
              {availableLocations.find(
                (loc) => loc.id === weeklyMetrics.mostVisitedLocation
              )?.name || "Unknown"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Average Session Duration Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
          <Timer className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatDuration(weeklyMetrics.averageSessionDuration)}
          </div>
          <p className="text-xs text-muted-foreground">per session</p>
          <div className="mt-2 text-sm text-muted-foreground">
            {weeklyMetrics.completionRate.toFixed(0)}% completion rate
          </div>
        </CardContent>
      </Card>

      {/* Completion Rate Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Performance</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {weeklyMetrics.completionRate.toFixed(0)}%
          </div>
          <p className="text-xs text-muted-foreground">completion rate</p>
          <div className="mt-2 space-y-1">
            <div className="text-sm text-muted-foreground">
              Longest: {formatDuration(weeklyMetrics.longestSessionDuration)}
            </div>
            {weeklyMetrics.shortestSessionDuration > 0 && (
              <div className="text-sm text-muted-foreground">
                Shortest:{" "}
                {formatDuration(weeklyMetrics.shortestSessionDuration)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProviderDashboardCards;
