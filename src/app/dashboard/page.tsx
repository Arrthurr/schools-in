"use client";

import { ProtectedRoute } from "../../components/auth/ProtectedRoute";
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
import {
  MapPin,
  Clock,
  School,
  LogOut,
  User,
  Bell,
  Menu,
  X,
  Home,
  History,
  Settings,
  MessageSquare,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "../../../firebase.config";
import { getAssignedLocations } from "@/lib/services/locationService";
import { Logo } from "../../components/ui/logo";
import { CachedSessionService } from "@/lib/services/cachedSessionService";
import { Session } from "@/lib/firebase/types";
import { SkeletonList } from "@/components/ui/skeleton";
import { useAutoGeofencePreference } from "@/lib/hooks/useAutoGeofencePreference";
import { useAutoGeofenceCheck } from "@/lib/hooks/useAutoGeofenceCheck";

export default function DashboardPage() {
  const { user } = useCachedAuth();
  const metrics = useProviderMetrics();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assignedSchoolsCount, setAssignedSchoolsCount] = useState(0);
  const { enabled: autoGeofenceEnabled } = useAutoGeofencePreference();
  const autoGeofence = useAutoGeofenceCheck();

  // New state for recent activity
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [locationsMap, setLocationsMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadSchools = async () => {
      if (!user?.uid) return;

      try {
        const locations = await getAssignedLocations(user.uid);
        setAssignedSchoolsCount(locations.length);

        // Create a map of location IDs to names
        const map: Record<string, string> = {};
        locations.forEach((loc) => {
          map[loc.id] = loc.name;
        });
        setLocationsMap(map);
      } catch (error) {
        console.error("Error loading schools:", error);
      }
    };

    loadSchools();
  }, [user?.uid]);

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

  // Note: Manual end session removed for providers - auto check-out handles this via geofence

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navigationItems = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    {
      name: "Session History",
      href: "/dashboard/history",
      icon: History,
    },
    { name: "Profile", href: "/profile", icon: User },
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
    },
    {
      name: "Feedback",
      href: "/provider/feedback",
      icon: MessageSquare,
    },
  ].map((item) => ({
    ...item,
    current: pathname === item.href,
  }));

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

  return (
    <ProtectedRoute roles={["provider", "admin"]}>
      <div className="min-h-screen bg-background">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b">
              <Logo size="sm" priority />
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4 border-b">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-brand-primary flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-foreground">
                    {user?.displayName || user?.email || "Provider User"}
                  </p>
                  <Badge variant="secondary" className="text-xs mt-1">
                    {user?.role || "Provider"}
                  </Badge>
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-1 px-2 py-4">
              {navigationItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href as any)}
                  className={`group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    item.current
                      ? "bg-brand-primary text-white"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      item.current
                        ? "text-white"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  />
                  {item.name}
                </button>
              ))}
            </nav>

            <div className="p-4 border-t">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleSignOut}
              >
                <LogOut className="mr-3 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>

        <div className="md:ml-64">
          <div className="sticky top-0 z-40 bg-card shadow-sm border-b">
            <div className="flex h-16 items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6">
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                <div className="flex flex-1 items-center">
                  <h1 className="text-xl font-semibold text-foreground">
                    Provider Dashboard
                  </h1>
                </div>
                <div className="flex items-center gap-x-4 lg:gap-x-6">
                  {autoGeofenceEnabled && (
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
                  )}
                  <Button variant="ghost" size="sm">
                    <Bell className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <main className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
