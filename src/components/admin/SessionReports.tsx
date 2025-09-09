"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CalendarDays,
  Download,
  Filter,
  BarChart3,
  Users,
  Clock,
  TrendingUp,
  School,
  AlertCircle,
  FileDown,
} from "lucide-react";
import { formatDuration, getSessionStatusConfig, calculateSessionDuration } from "@/lib/utils/session";
import { SessionData } from "@/lib/utils/session";
import { getCollection, COLLECTIONS } from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";

interface School {
  id: string;
  name: string;
  address: string;
}

interface User {
  id: string;
  email: string;
  displayName?: string;
  role: "provider" | "admin";
}

interface ReportFilters {
  dateRange: "today" | "week" | "month" | "custom";
  startDate?: Date;
  endDate?: Date;
  providerId?: string;
  schoolId?: string;
  status?: "active" | "completed" | "error" | "paused" | "cancelled" | "";
}

interface ReportSummary {
  totalSessions: number;
  totalDuration: number;
  averageSessionDuration: number;
  completionRate: number;
  activeSessionsCount: number;
  completedSessionsCount: number;
}

export function SessionReports() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [providers, setProviders] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: "month",
  });
  const [summary, setSummary] = useState<ReportSummary>({
    totalSessions: 0,
    totalDuration: 0,
    averageSessionDuration: 0,
    completionRate: 0,
    activeSessionsCount: 0,
    completedSessionsCount: 0,
  });

  // Calculate date range based on filter selection
  const getDateRange = useCallback(
    (range: ReportFilters["dateRange"]) => {
      const now = new Date();
      let startDate: Date;
      let endDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59
      );

      switch (range) {
        case "today":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0,
            0,
            0
          );
          break;
        case "week":
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          startDate = new Date(
            weekStart.getFullYear(),
            weekStart.getMonth(),
            weekStart.getDate(),
            0,
            0,
            0
          );
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
          break;
        case "custom":
          return { startDate: filters.startDate, endDate: filters.endDate };
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      }

      return { startDate, endDate };
    },
    [filters.startDate, filters.endDate]
  );

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load schools and providers for filter options
        const [schoolsData, usersData] = await Promise.all([
          getCollection(COLLECTIONS.LOCATIONS),
          getCollection(COLLECTIONS.USERS),
        ]);

        setSchools(schoolsData as School[]);
        setProviders(
          (usersData as User[]).filter((user: User) => user.role === "provider")
        );
      } catch (err) {
        console.error("Error loading initial data:", err);
        setError("Failed to load filter data");
      }
    };

    loadInitialData();
  }, []);

  // Load sessions based on filters
  const loadSessions = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      // Get all sessions first, then filter client-side
      // In a production app, you'd want to implement server-side filtering
      const allSessions = await getCollection(COLLECTIONS.SESSIONS);

      // Apply filters
      let filteredSessions = allSessions as SessionData[];

      // Date range filter
      const dateRange = getDateRange(filters.dateRange);
      if (dateRange.startDate && dateRange.endDate) {
        filteredSessions = filteredSessions.filter((session) => {
          const sessionDate = session.checkInTime.toDate();
          return (
            sessionDate >= dateRange.startDate! &&
            sessionDate <= dateRange.endDate!
          );
        });
      }

      // Provider filter
      if (filters.providerId) {
        filteredSessions = filteredSessions.filter(
          (session) => session.userId === filters.providerId
        );
      }

      // School filter
      if (filters.schoolId) {
        filteredSessions = filteredSessions.filter(
          (session) => session.schoolId === filters.schoolId
        );
      }

      // Status filter
      if (filters.status) {
        filteredSessions = filteredSessions.filter(
          (session) => session.status === filters.status
        );
      }

      // Calculate summary statistics
      const totalSessions = filteredSessions.length;
      const completedSessions = filteredSessions.filter(
        (s) => s.status === "completed"
      );
      const activeSessions = filteredSessions.filter(
        (s) => s.status === "active"
      );

      const totalDuration = completedSessions.reduce((sum, session) => {
        if (session.checkInTime && session.checkOutTime) {
          const duration = Math.round(
            (session.checkOutTime.toMillis() - session.checkInTime.toMillis()) /
              (1000 * 60)
          );
          return sum + duration;
        }
        return sum;
      }, 0);

      const averageSessionDuration =
        completedSessions.length > 0
          ? Math.round(totalDuration / completedSessions.length)
          : 0;

      const completionRate =
        totalSessions > 0
          ? Math.round((completedSessions.length / totalSessions) * 100)
          : 0;

      setSummary({
        totalSessions,
        totalDuration,
        averageSessionDuration,
        completionRate,
        activeSessionsCount: activeSessions.length,
        completedSessionsCount: completedSessions.length,
      });

      setSessions(filteredSessions);
    } catch (err) {
      console.error("Error loading sessions:", err);
      setError("Failed to load session data");
    } finally {
      setLoading(false);
    }
  }, [filters, loading, getDateRange]);

  // Load sessions when filters change
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Get school name by ID
  const getSchoolName = (schoolId: string) => {
    const school = schools.find((s) => s.id === schoolId);
    return school?.name || "Unknown School";
  };

  // Get provider name by ID
  const getProviderName = (userId: string) => {
    const provider = providers.find((p) => p.id === userId);
    return provider?.displayName || provider?.email || "Unknown Provider";
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof ReportFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle date input changes
  const handleDateChange = (type: "startDate" | "endDate", value: string) => {
    const date = value ? new Date(value) : undefined;
    setFilters((prev) => ({
      ...prev,
      [type]: date,
    }));
  };

  // CSV Export functionality
  const exportToCSV = () => {
    if (sessions.length === 0) {
      setError("No data to export");
      return;
    }

    const headers = [
      "Session ID",
      "Provider Name",
      "School Name",
      "Check In Time",
      "Check Out Time",
      "Duration",
      "Status",
      "Check In Location",
      "Check Out Location"
    ];

    const csvData = sessions.map((session) => [
      session.id || "N/A",
      getProviderName(session.userId),
      getSchoolName(session.schoolId),
      session.checkInTime ? new Date(session.checkInTime.toDate()).toLocaleString() : "N/A",
      session.checkOutTime ? new Date(session.checkOutTime.toDate()).toLocaleString() : "N/A",
      session.checkInTime && session.checkOutTime
        ? formatDuration(calculateSessionDuration(session.checkInTime, session.checkOutTime))
        : "N/A",
      getSessionStatusConfig(session.status).label,
      session.checkInLocation ? `${session.checkInLocation.latitude}, ${session.checkInLocation.longitude}` : "N/A",
      session.checkOutLocation ? `${session.checkOutLocation.latitude}, ${session.checkOutLocation.longitude}` : "N/A"
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `session-report-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label htmlFor="dateRange">Date Range</Label>
              <Select
                options={[
                  { value: "today", label: "Today" },
                  { value: "week", label: "This Week" },
                  { value: "month", label: "This Month" },
                  { value: "custom", label: "Custom Range" },
                ]}
                value={filters.dateRange}
                onValueChange={(value) =>
                  handleFilterChange("dateRange", value)
                }
                placeholder="Select date range"
              />
            </div>

            {/* Provider Filter */}
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                options={[
                  { value: "", label: "All Providers" },
                  ...providers.map((provider) => ({
                    value: provider.id,
                    label: provider.displayName || provider.email,
                  })),
                ]}
                value={filters.providerId || ""}
                onValueChange={(value) =>
                  handleFilterChange("providerId", value || undefined)
                }
                placeholder="All Providers"
              />
            </div>

            {/* School Filter */}
            <div className="space-y-2">
              <Label htmlFor="school">School</Label>
              <Select
                options={[
                  { value: "", label: "All Schools" },
                  ...schools.map((school) => ({
                    value: school.id,
                    label: school.name,
                  })),
                ]}
                value={filters.schoolId || ""}
                onValueChange={(value) =>
                  handleFilterChange("schoolId", value || undefined)
                }
                placeholder="All Schools"
              />
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "active", label: "Active" },
                  { value: "completed", label: "Completed" },
                  { value: "paused", label: "Paused" },
                  { value: "error", label: "Error" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
                value={filters.status || ""}
                onValueChange={(value) =>
                  handleFilterChange("status", value || undefined)
                }
                placeholder="All Statuses"
              />
            </div>
          </div>

          {/* Custom Date Range */}
          {filters.dateRange === "custom" && (
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={
                    filters.startDate
                      ? filters.startDate.toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) =>
                    handleDateChange("startDate", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={
                    filters.endDate
                      ? filters.endDate.toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) => handleDateChange("endDate", e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button onClick={loadSessions} disabled={loading}>
              {loading ? "Loading..." : "Apply Filters"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFilters({ dateRange: "month" });
                setSessions([]);
                setError(null);
              }}
            >
              Reset Filters
            </Button>
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={sessions.length === 0}
              className="flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Sessions
                </p>
                <p className="text-2xl font-bold">{summary.totalSessions}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Duration
                </p>
                <p className="text-2xl font-bold">
                  {formatDuration(summary.totalDuration)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Avg Session
                </p>
                <p className="text-2xl font-bold">
                  {formatDuration(summary.averageSessionDuration)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Completion Rate
                </p>
                <p className="text-2xl font-bold">{summary.completionRate}%</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Session Data ({sessions.length} sessions)
            </span>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">
                Loading sessions...
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">
                No sessions found for the selected filters
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => {
                    const duration =
                      session.checkInTime && session.checkOutTime
                        ? Math.round(
                            (session.checkOutTime.toMillis() -
                              session.checkInTime.toMillis()) /
                              (1000 * 60)
                          )
                        : 0;

                    const statusStyle = getSessionStatusConfig(session.status);

                    return (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">
                          {getProviderName(session.userId)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <School className="h-4 w-4 text-muted-foreground" />
                            {getSchoolName(session.schoolId)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {session.checkInTime.toDate().toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {session.checkOutTime
                            ? session.checkOutTime.toDate().toLocaleString()
                            : "--"}
                        </TableCell>
                        <TableCell>
                          {duration > 0 ? formatDuration(duration) : "--"}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusStyle.color}>
                            {statusStyle.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
