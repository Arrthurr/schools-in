"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
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
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalSchools: 0,
    activeProviders: 0,
    activeSessions: 0,
    todayCheckIns: 0,
    totalSessions: 0,
    avgSessionDuration: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // TODO: Replace with actual Firestore queries
      // Mock data for now
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setStats({
        totalSchools: 15,
        activeProviders: 8,
        activeSessions: 3,
        todayCheckIns: 12,
        totalSessions: 156,
        avgSessionDuration: 4.2,
      });

      setRecentActivity([
        {
          id: "1",
          type: "check-in",
          message: "John Doe checked in at Walter Payton HS",
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          providerName: "John Doe",
          schoolName: "Walter Payton HS",
        },
        {
          id: "2",
          type: "check-out",
          message: "Jane Smith checked out from Estrella Foothills HS",
          timestamp: new Date(Date.now() - 45 * 60 * 1000),
          providerName: "Jane Smith",
          schoolName: "Estrella Foothills HS",
        },
        {
          id: "3",
          type: "school-added",
          message: "New school added: Cambridge School",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          schoolName: "Cambridge School",
        },
      ]);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

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
        return <Clock className="h-4 w-4 text-blue-600" />;
      case "school-added":
        return <School className="h-4 w-4 text-purple-600" />;
      case "provider-assigned":
        return <Users className="h-4 w-4 text-orange-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.displayName || user?.email}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            This Week
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSchools}</div>
            <p className="text-xs text-muted-foreground">+2 from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Providers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeProviders}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeSessions} currently checked in
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Check-ins
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayCheckIns}</div>
            <p className="text-xs text-muted-foreground">+15% from yesterday</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Session Duration
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgSessionDuration}h
            </div>
            <p className="text-xs text-muted-foreground">
              From {stats.totalSessions} total sessions
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest check-ins, check-outs, and system updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {activity.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No recent activity to show
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Frequently used administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/schools" className="w-full">
              <Button variant="outline" className="w-full justify-start">
                <School className="h-4 w-4 mr-2" />
                Manage Schools
              </Button>
            </Link>
            <Link href="/admin/reports" className="w-full">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                View Reports
              </Button>
            </Link>
            <Button variant="outline" className="w-full justify-start">
              <Users className="h-4 w-4 mr-2" />
              Manage Users
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <AlertCircle className="h-4 w-4 mr-2" />
              System Health
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions Alert */}
      {stats.activeSessions > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800">Active Sessions</CardTitle>
            <CardDescription className="text-orange-700">
              {stats.activeSessions} provider
              {stats.activeSessions !== 1 ? "s are" : " is"} currently checked
              in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              className="text-orange-800 border-orange-300"
            >
              View Active Sessions
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
