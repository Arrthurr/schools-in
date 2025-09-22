"use client";

import { useState, useEffect } from "react";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useAdminMetrics } from "@/lib/hooks/useAdminMetrics";
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
  Users,
  School,
  Clock,
  TrendingUp,
  Settings,
  FileText,
  MapPin,
  Activity,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/error-empty-states";
import { useAnnouncement, ScreenReaderOnly, ARIA } from "@/lib/accessibility";
import Link from "next/link";

interface DashboardStats {
  totalSchools: number;
  activeProviders: number;
  activeSessions: number;
  todayCheckIns: number;
  totalSessions: number;
  avgSessionDuration: number;
}

interface RecentActivity {
  id: string;
  type: "check-in" | "check-out" | "school-added" | "provider-assigned";
  message: string;
  timestamp: Date;
  providerName?: string;
  schoolName?: string;
}

export function AdminDashboard() {
  const { user } = useCachedAuth();
  const { stats, recent, loading, error } = useAdminMetrics();
  const [totalSchools, setTotalSchools] = useState<number | null>(null);

  // Accessibility hooks
  const { announce } = useAnnouncement();

  useEffect(() => {
    if (!loading && !error) {
      announce("Dashboard data loaded successfully", "polite");
    }
  }, [loading, error, announce]);

  // Load total schools
  useEffect(() => {
    let cancelled = false;
    async function loadSchools() {
      try {
        const { CachedSchoolService } = await import("@/lib/services/cachedSchoolService");
        const s = await CachedSchoolService.getSchoolStats();
        if (!cancelled) setTotalSchools(s.totalSchools);
      } catch {
        if (!cancelled) setTotalSchools(null);
      }
    }
    loadSchools();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getActivityIcon = (type: RecentActivity["type"]) => {
    switch (type) {
      case "check-in":
        return <MapPin className="h-4 w-4 text-green-600" />;
      case "check-out":
        return <Clock className="h-4 w-4 text-brand-primary" />;
      case "school-added":
        return <School className="h-4 w-4 text-purple-600" />;
      case "provider-assigned":
        return <Users className="h-4 w-4 text-orange-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (error) {
    return (
      <ErrorState
        type="generic"
        title="Failed to load dashboard"
        message={error}
        onAction={() => window.location.reload()}
        actionLabel="Retry"
        className="max-w-md mx-auto mt-8"
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fadeInUp">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="micro-skeleton-wave">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <SkeletonCard showImage={false} />
          <SkeletonCard showImage={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Welcome back, {user?.displayName || user?.email}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2">
          <Button variant="outline" size="sm" className="touch-target">
            <Calendar className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">This Week</span>
            <span className="sm:hidden">Week</span>
          </Button>
          <Button variant="outline" size="sm" className="touch-target">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="touch-target">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
            <School className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSchools ?? '—'}</div>
            <p className="text-xs text-muted-foreground">+2 from last month</p>
          </CardContent>
        </Card>

        <Card className="touch-target">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Providers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeProviders ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeSessions ?? 0} currently checked in
            </p>
          </CardContent>
        </Card>

        <Card className="touch-target">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Check-ins
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayCheckIns ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats ? `${stats.percentChange >= 0 ? '+' : ''}${stats.percentChange}% from yesterday` : '—'}
            </p>
          </CardContent>
        </Card>

        <Card className="touch-target">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Session Duration
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avgSessionDurationHours ?? 0}h
            </div>
            <p className="text-xs text-muted-foreground">
              From {stats?.totalSessions ?? 0} total sessions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid - Responsive Layout */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Recent Activity - Takes more space on larger screens */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              Recent Activity
            </CardTitle>
            <CardDescription className="text-sm">
              Latest check-ins, check-outs, and system updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 sm:space-y-4">
              {recent.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getActivityIcon(activity.type as any)}
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="text-sm font-medium leading-none break-words">
                      {activity.type === 'check-in'
                        ? `${activity.providerName || activity.userId} checked in at ${activity.locationName || activity.locationId}`
                        : `${activity.providerName || activity.userId} checked out from ${activity.locationName || activity.locationId}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(activity.timestamp as any)}
                    </p>
                  </div>
                </div>
              ))}
              {recent.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No recent activity to show
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions - Responsive Button Layout */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Quick Actions</CardTitle>
            <CardDescription className="text-sm">
              Frequently used administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/schools" className="w-full">
              <Button
                variant="outline"
                className="w-full justify-start touch-target"
              >
                <School className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Manage Schools</span>
              </Button>
            </Link>
            <Link href="/admin/reports" className="w-full">
              <Button
                variant="outline"
                className="w-full justify-start touch-target"
              >
                <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">View Reports</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              className="w-full justify-start touch-target"
            >
              <Users className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">Manage Users</span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start touch-target"
            >
              <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">System Health</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions Alert - Responsive Design */}
      {stats.activeSessions > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 text-lg">
              Active Sessions
            </CardTitle>
            <CardDescription className="text-orange-700 text-sm">
              {stats.activeSessions} provider
              {stats.activeSessions !== 1 ? "s are" : " is"} currently checked
              in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="touch-target w-full sm:w-auto"
              onClick={() => {
                // TODO: Navigate to active sessions view
              }}
            >
              <Activity className="h-4 w-4 mr-2" />
              View Active Sessions
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
