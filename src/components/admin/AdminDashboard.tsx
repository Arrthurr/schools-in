"use client";

import { useState, useEffect } from "react";
import { useCachedAuth } from "@/lib/hooks/useCachedAuth";
import { useAdminMetrics } from "@/lib/hooks/useAdminMetrics";
import { Button } from "@/components/ui/button";
import {
  Users,
  School,
  Clock,
  TrendingUp,
  Settings,
  MapPin,
  Activity,
  Calendar,
} from "lucide-react";
import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-empty-states";
import {
  PageHeader,
  StatCard,
  SectionCard,
  ActivityList,
  AlertCallout,
} from "@/components/dashboard";
import { ActiveSessionsModal } from "@/components/admin/ActiveSessionsModal";
import { AdminManualCheckInOut } from "@/components/admin/AdminManualCheckInOut";

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
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);

  // Accessibility hooks
  // const { announce } = useAnnouncement();

  useEffect(() => {
    if (!loading && !error) {
      // announce("Dashboard data loaded successfully", "polite");
    }
  }, [loading, error]);

  // Load total schools
  useEffect(() => {
    let cancelled = false;
    async function loadSchools() {
      try {
        const { CachedSchoolService } = await import(
          "@/lib/services/cachedSchoolService"
        );
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
        return MapPin;
      case "check-out":
        return Clock;
      case "school-added":
        return School;
      case "provider-assigned":
        return Users;
      default:
        return Activity;
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
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SkeletonCard showImage={false} />
          </div>
          <div className="lg:col-span-1">
            <SkeletonCard showImage={false} />
          </div>
        </div>
      </div>
    );
  }

  // Transform recent activities for ActivityList component
  const activityItems = recent.map((activity) => {
    const message =
      activity.type === "check-in"
        ? `${activity.providerName || activity.userId} checked in at ${
            activity.locationName || activity.locationId
          }`
        : activity.type === "check-out"
        ? `${activity.providerName || activity.userId} checked out from ${
            activity.locationName || activity.locationId
          }`
        : activity.message || "Unknown activity";

    return {
      id: activity.id,
      icon: getActivityIcon(activity.type),
      title: message,
      timestamp: formatRelativeTime(activity.timestamp as any),
    };
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <PageHeader
        title="Admin Dashboard"
        description={`Welcome back, ${user?.displayName || user?.email}`}
        actions={
          <>
            <Button variant="outline" size="sm" className="touch-target">
              <Calendar className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">This Week</span>
              <span className="sm:hidden">Week</span>
            </Button>
            <Button variant="outline" size="sm" className="touch-target">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </>
        }
      />

      {/* Stats Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Schools"
          value={totalSchools ?? "—"}
          description="+2 from last month"
          icon={School}
        />
        <StatCard
          title="Active Providers"
          value={stats?.activeProviders ?? 0}
          description={`${stats?.activeSessions ?? 0} currently checked in`}
          icon={Users}
        />
        <StatCard
          title="Today's Check-ins"
          value={stats?.todayCheckIns ?? 0}
          description={
            stats
              ? `${stats.percentChange >= 0 ? "+" : ""}${
                  stats.percentChange
                }% from yesterday`
              : "—"
          }
          icon={TrendingUp}
          trend={
            stats && stats.percentChange !== undefined
              ? {
                  value: `${stats.percentChange >= 0 ? "+" : ""}${
                    stats.percentChange
                  }%`,
                  isPositive: stats.percentChange >= 0,
                }
              : undefined
          }
        />
        <StatCard
          title="Avg Session Duration"
          value={`${stats?.avgSessionDurationHours ?? 0}h`}
          description={`From ${stats?.totalSessions ?? 0} total sessions`}
          icon={Clock}
        />
      </div>

      {/* Active Sessions Alert - Responsive Design */}
      {stats?.activeSessions && stats.activeSessions > 0 && (
        <AlertCallout
          title="Active Sessions"
          description={`${stats.activeSessions} provider${
            stats.activeSessions !== 1 ? "s are" : " is"
          } currently checked in`}
          variant="warning"
          action={{
            label: "View Active Sessions",
            onClick: () => {
              setIsSessionsModalOpen(true);
            },
            icon: Activity,
          }}
        />
      )}

      {/* Main Content Grid - Responsive Layout */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Recent Activity - Takes more space on larger screens */}
        <SectionCard
          title="Recent Activity"
          description="Latest check-ins, check-outs, and system updates"
          className="lg:col-span-2"
        >
          <ActivityList
            items={activityItems}
            emptyMessage="No recent activity to show"
          />
        </SectionCard>

        {/* Admin Manual Check-In/Out */}
        <AdminManualCheckInOut />
      </div>

      {/* Active Sessions Modal */}
      <ActiveSessionsModal
        isOpen={isSessionsModalOpen}
        onClose={() => setIsSessionsModalOpen(false)}
      />
    </div>
  );
}
