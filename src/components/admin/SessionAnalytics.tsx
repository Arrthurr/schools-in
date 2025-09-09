"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Clock,
  Users,
  School,
  Calendar,
  AlertCircle,
} from "lucide-react";
import {
  formatDuration,
  getSessionStatusConfig,
  calculateSessionDuration,
} from "@/lib/utils/session";
import { SessionData } from "@/lib/utils/session";
import { getCollection, COLLECTIONS } from "@/lib/firebase/firestore";

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

interface ChartFilters {
  dateRange: "week" | "month" | "quarter" | "year";
  chartType: "volume" | "duration" | "providers" | "schools" | "status" | "trends";
}

interface SessionVolumeData {
  date: string;
  sessions: number;
  duration: number;
}

interface ProviderPerformanceData {
  name: string;
  sessions: number;
  duration: number;
  avgDuration: number;
}

interface SchoolActivityData {
  name: string;
  sessions: number;
  providers: number;
  avgDuration: number;
}

interface StatusDistributionData {
  status: string;
  count: number;
  percentage: number;
}

interface HourlyTrendData {
  hour: string;
  sessions: number;
  avgDuration: number;
}

export function SessionAnalytics() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [providers, setProviders] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ChartFilters>({
    dateRange: "month",
    chartType: "volume",
  });

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [schoolsData, usersData, sessionsData] = await Promise.all([
          getCollection(COLLECTIONS.LOCATIONS),
          getCollection(COLLECTIONS.USERS),
          getCollection(COLLECTIONS.SESSIONS),
        ]);

        setSchools(schoolsData as School[]);
        setProviders(
          (usersData as User[]).filter((user: User) => user.role === "provider")
        );
        setSessions(sessionsData as SessionData[]);
      } catch (err) {
        console.error("Error loading analytics data:", err);
        setError("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Filter sessions by date range
  const filteredSessions = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (filters.dateRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return sessions.filter(session => 
      session.checkInTime.toDate() >= startDate
    );
  }, [sessions, filters.dateRange]);

  // Get school name by ID
  const getSchoolName = (schoolId: string) => {
    const school = schools.find(s => s.id === schoolId);
    return school?.name || "Unknown School";
  };

  // Get provider name by ID
  const getProviderName = (userId: string) => {
    const provider = providers.find(p => p.id === userId);
    return provider?.displayName || provider?.email || "Unknown Provider";
  };

  // Session Volume Data
  const sessionVolumeData = useMemo(() => {
    const dateMap = new Map<string, { sessions: number; duration: number }>();
    
    filteredSessions.forEach(session => {
      const date = session.checkInTime.toDate().toISOString().split('T')[0];
      const existing = dateMap.get(date) || { sessions: 0, duration: 0 };
      
      existing.sessions += 1;
      if (session.checkOutTime) {
        existing.duration += calculateSessionDuration(session.checkInTime, session.checkOutTime);
      }
      
      dateMap.set(date, existing);
    });

    return Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString(),
        sessions: data.sessions,
        duration: data.duration,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30); // Last 30 data points
  }, [filteredSessions]);

  // Provider Performance Data
  const providerPerformanceData = useMemo(() => {
    const providerMap = new Map<string, { sessions: number; duration: number }>();
    
    filteredSessions.forEach(session => {
      const existing = providerMap.get(session.userId) || { sessions: 0, duration: 0 };
      existing.sessions += 1;
      if (session.checkOutTime) {
        existing.duration += calculateSessionDuration(session.checkInTime, session.checkOutTime);
      }
      providerMap.set(session.userId, existing);
    });

    return Array.from(providerMap.entries())
      .map(([userId, data]) => ({
        name: getProviderName(userId).split(' ')[0] || getProviderName(userId).substring(0, 10),
        sessions: data.sessions,
        duration: data.duration,
        avgDuration: data.sessions > 0 ? Math.round(data.duration / data.sessions) : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10); // Top 10 providers
  }, [filteredSessions, providers]);

  // School Activity Data
  const schoolActivityData = useMemo(() => {
    const schoolMap = new Map<string, { sessions: number; providers: Set<string>; duration: number }>();
    
    filteredSessions.forEach(session => {
      const existing = schoolMap.get(session.schoolId) || { 
        sessions: 0, 
        providers: new Set<string>(), 
        duration: 0 
      };
      existing.sessions += 1;
      existing.providers.add(session.userId);
      if (session.checkOutTime) {
        existing.duration += calculateSessionDuration(session.checkInTime, session.checkOutTime);
      }
      schoolMap.set(session.schoolId, existing);
    });

    return Array.from(schoolMap.entries())
      .map(([schoolId, data]) => ({
        name: getSchoolName(schoolId).substring(0, 15),
        sessions: data.sessions,
        providers: data.providers.size,
        avgDuration: data.sessions > 0 ? Math.round(data.duration / data.sessions) : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10); // Top 10 schools
  }, [filteredSessions, schools]);

  // Status Distribution Data
  const statusDistributionData = useMemo(() => {
    const statusMap = new Map<string, number>();
    
    filteredSessions.forEach(session => {
      const count = statusMap.get(session.status) || 0;
      statusMap.set(session.status, count + 1);
    });

    const total = filteredSessions.length;
    return Array.from(statusMap.entries())
      .map(([status, count]) => ({
        status: getSessionStatusConfig(status).label,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredSessions]);

  // Hourly Trends Data
  const hourlyTrendsData = useMemo(() => {
    const hourMap = new Map<number, { sessions: number; duration: number }>();
    
    filteredSessions.forEach(session => {
      const hour = session.checkInTime.toDate().getHours();
      const existing = hourMap.get(hour) || { sessions: 0, duration: 0 };
      existing.sessions += 1;
      if (session.checkOutTime) {
        existing.duration += calculateSessionDuration(session.checkInTime, session.checkOutTime);
      }
      hourMap.set(hour, existing);
    });

    return Array.from({ length: 24 }, (_, hour) => {
      const data = hourMap.get(hour) || { sessions: 0, duration: 0 };
      return {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        sessions: data.sessions,
        avgDuration: data.sessions > 0 ? Math.round(data.duration / data.sessions) : 0,
      };
    });
  }, [filteredSessions]);

  // Chart Colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  // Handle filter changes
  const handleFilterChange = (key: keyof ChartFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Render chart based on selected type
  const renderChart = () => {
    switch (filters.chartType) {
      case "volume":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={sessionVolumeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="sessions" 
                stackId="1" 
                stroke="#8884d8" 
                fill="#8884d8" 
                name="Sessions"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "duration":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={sessionVolumeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [formatDuration(Number(value)), "Total Duration"]} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="duration" 
                stroke="#82ca9d" 
                strokeWidth={3}
                name="Duration (minutes)"
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "providers":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={providerPerformanceData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={80} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sessions" fill="#8884d8" name="Sessions" />
            </BarChart>
          </ResponsiveContainer>
        );

      case "schools":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={schoolActivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sessions" fill="#0088FE" name="Sessions" />
              <Bar dataKey="providers" fill="#00C49F" name="Providers" />
            </BarChart>
          </ResponsiveContainer>
        );

      case "status":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={statusDistributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.status}: ${entry.percentage}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="count"
              >
                {statusDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case "trends":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={hourlyTrendsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="sessions" 
                stroke="#8884d8" 
                strokeWidth={2}
                name="Sessions"
              />
            </LineChart>
          </ResponsiveContainer>
        );

      default:
        return <div>Select a chart type</div>;
    }
  };

  // Get chart title and description
  const getChartInfo = () => {
    switch (filters.chartType) {
      case "volume":
        return {
          title: "Session Volume Over Time",
          description: "Daily session counts showing activity levels"
        };
      case "duration":
        return {
          title: "Session Duration Trends",
          description: "Total session duration per day"
        };
      case "providers":
        return {
          title: "Top Provider Performance",
          description: "Most active providers by session count"
        };
      case "schools":
        return {
          title: "School Activity Analysis",
          description: "Session and provider distribution across schools"
        };
      case "status":
        return {
          title: "Session Status Distribution",
          description: "Breakdown of session statuses"
        };
      case "trends":
        return {
          title: "Hourly Activity Trends",
          description: "Session patterns throughout the day"
        };
      default:
        return { title: "Analytics", description: "Select a chart type" };
    }
  };

  const chartInfo = getChartInfo();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Session Analytics & Visualization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Visual analytics and insights for session data, provider performance, and activity trends.
          </p>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Analytics Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dateRange">Date Range</Label>
              <Select
                options={[
                  { value: "week", label: "Last 7 Days" },
                  { value: "month", label: "Last 30 Days" },
                  { value: "quarter", label: "Last 90 Days" },
                  { value: "year", label: "Last Year" },
                ]}
                value={filters.dateRange}
                onValueChange={(value) => handleFilterChange("dateRange", value)}
                placeholder="Select date range"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chartType">Chart Type</Label>
              <Select
                options={[
                  { value: "volume", label: "Session Volume" },
                  { value: "duration", label: "Duration Trends" },
                  { value: "providers", label: "Provider Performance" },
                  { value: "schools", label: "School Activity" },
                  { value: "status", label: "Status Distribution" },
                  { value: "trends", label: "Hourly Trends" },
                ]}
                value={filters.chartType}
                onValueChange={(value) => handleFilterChange("chartType", value)}
                placeholder="Select chart type"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSessions.length}</div>
            <p className="text-xs text-muted-foreground">
              In selected period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Providers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(filteredSessions.map(s => s.userId)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Unique providers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Schools Visited</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(filteredSessions.map(s => s.schoolId)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Unique schools
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredSessions.length > 0 
                ? formatDuration(
                    Math.round(
                      filteredSessions
                        .filter(s => s.checkOutTime)
                        .reduce((sum, s) => sum + calculateSessionDuration(s.checkInTime, s.checkOutTime!), 0) 
                      / filteredSessions.filter(s => s.checkOutTime).length
                    )
                  )
                : "0m"
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Per session
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {filters.chartType === "volume" && <TrendingUp className="h-5 w-5" />}
            {filters.chartType === "duration" && <Clock className="h-5 w-5" />}
            {filters.chartType === "providers" && <Users className="h-5 w-5" />}
            {filters.chartType === "schools" && <School className="h-5 w-5" />}
            {filters.chartType === "status" && <PieChartIcon className="h-5 w-5" />}
            {filters.chartType === "trends" && <Calendar className="h-5 w-5" />}
            {chartInfo.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {chartInfo.description}
          </p>
          {loading ? (
            <div className="flex items-center justify-center h-[400px]">
              <div className="text-muted-foreground">Loading chart data...</div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex items-center justify-center h-[400px]">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No data available for the selected period</p>
              </div>
            </div>
          ) : (
            renderChart()
          )}
        </CardContent>
      </Card>

      {/* Quick Insights */}
      {filteredSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-medium">Most Active Day</h4>
                <p className="text-sm text-muted-foreground">
                  {sessionVolumeData.length > 0
                    ? sessionVolumeData.reduce((max, current) => 
                        current.sessions > max.sessions ? current : max
                      ).date
                    : "No data"
                  }
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Peak Hour</h4>
                <p className="text-sm text-muted-foreground">
                  {hourlyTrendsData.length > 0
                    ? hourlyTrendsData.reduce((max, current) => 
                        current.sessions > max.sessions ? current : max
                      ).hour
                    : "No data"
                  }
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Completion Rate</h4>
                <p className="text-sm text-muted-foreground">
                  {filteredSessions.length > 0
                    ? `${Math.round(
                        (filteredSessions.filter(s => s.status === "completed").length / filteredSessions.length) * 100
                      )}%`
                    : "0%"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
