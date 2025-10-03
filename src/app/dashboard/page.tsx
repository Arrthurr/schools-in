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

export default function DashboardPage() {
  const { user } = useCachedAuth();
  const metrics = useProviderMetrics();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assignedSchoolsCount, setAssignedSchoolsCount] = useState(0);

  useEffect(() => {
    const loadSchoolsCount = async () => {
      if (!user?.uid) return;

      try {
        const locations = await getAssignedLocations(user.uid);
        setAssignedSchoolsCount(locations.length);
      } catch (error) {
        console.error("Error loading schools count:", error);
      }
    };

    loadSchoolsCount();
  }, [user?.uid]);

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

  return (
    <ProtectedRoute roles={["provider", "admin"]}>
      <div className="min-h-screen bg-gray-50">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
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
                  <p className="text-sm font-medium text-gray-900">
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
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      item.current
                        ? "text-white"
                        : "text-gray-400 group-hover:text-gray-500"
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
          <div className="sticky top-0 z-40 bg-white shadow-sm border-b">
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
                  <h1 className="text-xl font-semibold text-gray-900">
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
                    <h2 className="text-2xl font-bold text-gray-900">
                      Welcome back,{" "}
                      {user?.displayName?.split(" ")[0] || "Provider"}!
                    </h2>
                    <p className="mt-1 text-gray-600">
                      Here's what's happening with your schools today.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Today</p>
                    <p className="text-lg font-semibold text-gray-900">
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
                  currentSession={metrics.currentSession as any}
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
                    <div className="text-center py-8">
                      <History className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-gray-600">
                        No recent activity. Your session history will appear
                        here once you start checking in.
                      </p>
                    </div>
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
