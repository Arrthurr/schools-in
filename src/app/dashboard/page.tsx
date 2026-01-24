"use client";

import { ProtectedRoute } from "../../components/auth/ProtectedRoute";
import { ProviderNavigation } from "../../components/provider/ProviderNavigation";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useProviderMetrics } from "@/lib/hooks/useProviderMetrics";
import { SchoolList } from "../../components/provider/SchoolList";
import { SessionStatus } from "../../components/provider/SessionStatus";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PageHeader,
  StatCard,
  SectionCard,
  ActivityList,
} from "@/components/dashboard";
import { MapPin, Clock, School, History } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CachedSessionService } from "@/lib/services/cachedSessionService";
import { Session } from "@/lib/firebase/types";
import { SkeletonList } from "@/components/ui/skeleton";
import { useAutoGeofencePreference } from "@/lib/hooks/useAutoGeofencePreference";
import { useAutoGeofenceCheck } from "@/lib/hooks/useAutoGeofenceCheck";
import { useProviderLocations } from "@/lib/hooks/useProviderLocations";

export default function DashboardPage() {
  const { user } = useCachedAuth();
  const metrics = useProviderMetrics();
  const router = useRouter();
  const { locations: providerLocations } = useProviderLocations(user?.uid);
  const [assignedSchoolsCount, setAssignedSchoolsCount] = useState(0);
  const { enabled: autoGeofenceEnabled } = useAutoGeofencePreference();
  const autoGeofence = useAutoGeofenceCheck();

  // New state for recent activity
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [locationsMap, setLocationsMap] = useState<Record<string, string>>({});

  useEffect(() => {
    setAssignedSchoolsCount(providerLocations?.length || 0);

    const map: Record<string, string> = {};
    (providerLocations || []).forEach((loc) => {
      map[loc.id] = loc.name;
    });
    setLocationsMap(map);
  }, [providerLocations]);

  // Fetch recent sessions
  useEffect(() => {
    const fetchRecentActivity = async () => {
      if (!user?.uid) return;

      setLoadingRecent(true);
      try {
        const sessions = await CachedSessionService.getUserSessions(
          user.uid,
          {},
          { limit: 7 }
        );
        setRecentSessions(sessions);
      } catch (error) {
        console.error("Error fetching recent activity:", error);
      } finally {
        setLoadingRecent(false);
      }
    };

    fetchRecentActivity();
  }, [user?.uid]);

  // Helper for relative time
  const getRelativeTime = (dateString: any) => {
    if (!dateString) return "";
    const date = new Date(
      typeof dateString.toDate === "function" ? dateString.toDate() : dateString
    );
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) return `${diffDay}d ago`;
    if (diffHour > 0) return `${diffHour}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return "Just now";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Active
          </Badge>
        );
      case "completed":
        return (
          <Badge
            variant="outline"
            className="bg-gray-100 text-gray-800 border-gray-200"
          >
            Completed
          </Badge>
        );
      case "paused":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 border-yellow-200"
          >
            Paused
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const autoCheckBadge = autoGeofenceEnabled ? (
    <Badge
      variant={
        autoGeofence.locationPermission === "denied" ||
        autoGeofence.locationPermission === "unavailable"
          ? "destructive"
          : autoGeofence.pausedReason
            ? "destructive"
            : autoGeofence.locationPermission === "granted"
              ? "secondary"
              : "outline"
      }
      className="flex items-center gap-2"
    >
      <MapPin className="h-4 w-4" />
      {autoGeofence.locationPermission === "denied"
        ? "Location Access Denied"
        : autoGeofence.locationPermission === "unavailable"
          ? "Location Unavailable"
          : autoGeofence.locationPermission !== "granted"
            ? "Enable Location"
            : autoGeofence.pausedReason
              ? "Auto Check Paused (GPS)"
              : autoGeofence.isPolling
                ? "Auto Check Active"
                : "Auto Check Ready"}
    </Badge>
  ) : null;

  return (
    <ProtectedRoute roles={["provider", "admin"]}>
      <ProviderNavigation headerStatus={autoCheckBadge}>
        <div className="mx-auto max-w-7xl">
          {/* Mobile-first: Header with date */}
          <PageHeader
            title={`Welcome back, ${user?.displayName?.split(" ")[0] || "Provider"}!`}
            description="Here's what's happening with your schools today."
            actions={
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-lg font-semibold text-foreground">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            }
          />

          {/* Mobile-first: Priority order - Current Session & Assigned Schools first */}
          <div className="space-y-6 mb-8">
            {/* Current Session Card - Top priority on mobile */}
            {/* Note: onEndSession removed - providers use automatic check-out via geofence */}
            <SessionStatus
              currentSession={
                metrics.currentSession || metrics.lastCompletedSession
              }
            />

            {/* Assigned Schools - Second priority on mobile */}
            {/* Note: showCheckInButtons removed - providers use automatic check-in via geofence */}
            <SchoolList
              showCheckInButtons={false}
              currentSessionLocationId={metrics.currentSession?.locationId}
            />
          </div>

          {/* Metrics Row - Scrollable on mobile, grid on larger screens */}
          <div className="mb-8">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto sm:overflow-visible">
              <StatCard
                title="Current Status"
                value={metrics.isSessionActive ? "Active" : "Not Active"}
                description={
                  metrics.isSessionActive
                    ? `At ${metrics.currentSession?.locationId ?? ""}`
                    : "No current session"
                }
                icon={Clock}
              />
              <StatCard
                title="Assigned Schools"
                value={assignedSchoolsCount}
                description="Active assignments"
                icon={School}
              />
              <StatCard
                title="This Week"
                value={metrics.weeklyMetrics?.weeklySessionsCount || 0}
                description="Sessions completed"
                icon={MapPin}
              />
              <StatCard
                title="Total Hours"
                value={`${(metrics.weeklyMetrics?.weeklyTotalHours || 0).toFixed(1)}`}
                description="This week"
                icon={Clock}
              />
            </div>
          </div>

          {/* Recent Activity - Bottom of page */}
          <SectionCard
            title="Recent Activity"
            description="Your recent check-ins and sessions"
            headerActions={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard/history")}
              >
                View all
              </Button>
            }
          >
            {loadingRecent ? (
              <SkeletonList items={3} />
            ) : (
              <ActivityList
                items={recentSessions.map((session) => ({
                  id: session.id,
                  icon: History,
                  title:
                    locationsMap[session.locationId] || "Unknown Location",
                  timestamp: getRelativeTime(session.startTime),
                  metadata: getStatusBadge(session.status),
                }))}
                emptyMessage="No recent activity. Your session history will appear here once you start checking in."
              />
            )}
          </SectionCard>
        </div>
      </ProviderNavigation>
    </ProtectedRoute>
  );
}
