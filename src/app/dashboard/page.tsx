"use client";

import { ProtectedRoute } from "../../components/auth/ProtectedRoute";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useProviderMetrics } from "@/lib/hooks/useProviderMetrics";
import { SchoolList } from "../../components/provider/SchoolList";
import { SessionStatus } from "../../components/provider/SessionStatus";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../../firebase.config";
import { getAssignedLocations } from "@/lib/services/locationService";
import { Logo } from "../../components/ui/logo";
import { CachedSessionService } from "@/lib/services/cachedSessionService";
import { Session } from "@/lib/firebase/types";
import { SkeletonList } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { user } = useCachedAuth();
  const metrics = useProviderMetrics();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assignedSchoolsCount, setAssignedSchoolsCount] = useState(0);

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
        locations.forEach(loc => {
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
              const sessions = await CachedSessionService.getUserSessions(user.uid, {}, { limit: 7 });
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
      const date = new Date(typeof dateString.toDate === 'function' ? dateString.toDate() : dateString);
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

  const handleEndSession = async (_sessionId: string) => {
    try {
      await metrics.endSession();
    } catch (err) {
      console.error("Error ending session:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navigationItems = [
    { name: "Dashboard", href: "/dashboard", icon: Home, current: true },
    {
      name: "Session History",
      href: "/dashboard/history",
      icon: History,
      current: false,
    },
    { name: "Profile", href: "/profile", icon: User, current: false },
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
      current: false,
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">Completed</Badge>;
      case "paused":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Paused</Badge>;
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
                <a
                  key={item.name}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    console.log(`Navigating to ${item.href}`);
                  }}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
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
                </a>
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
                  <Button variant="ghost" size="sm">
                    <Bell className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <main className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Welcome back,{" "}
                      {user?.displayName?.split(" ")[0] || "Provider"}!
                    </h2>
                    <p className="mt-1 text-muted-foreground">
                      Here's what's happening with your schools today.
                    </p>
                  </div>
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
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Current Status
                    </CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metrics.isSessionActive ? "Active" : "Not Active"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {metrics.isSessionActive
                        ? `At ${metrics.currentSession?.locationId ?? ""}`
                        : "No current session"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Assigned Schools
                    </CardTitle>
                    <School className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {assignedSchoolsCount}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Active assignments
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      This Week
                    </CardTitle>
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metrics.weeklyMetrics?.weeklySessionsCount || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sessions completed
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Hours
                    </CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(metrics.weeklyMetrics?.weeklyTotalHours || 0).toFixed(
                        1
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">This week</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <SessionStatus
                  currentSession={metrics.currentSession || metrics.lastCompletedSession}
                  onEndSession={handleEndSession}
                />

                <SchoolList 
                  showCheckInButtons={true}
                  currentSessionLocationId={metrics.currentSession?.locationId}
                />

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>
                      Your recent check-ins and sessions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingRecent ? (
                      <SkeletonList items={3} />
                    ) : recentSessions.length > 0 ? (
                      <div className="space-y-4">
                        {recentSessions.map((session) => (
                          <div
                            key={session.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex items-start gap-4">
                              <div className="mt-1 p-2 bg-secondary rounded-full">
                                <History className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">
                                  {locationsMap[session.locationId] || "Unknown Location"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {getRelativeTime(session.startTime)}
                                </p>
                              </div>
                            </div>
                            <div>
                              {getStatusBadge(session.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          No recent activity. Your session history will appear
                          here once you start checking in.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
