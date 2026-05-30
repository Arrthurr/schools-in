"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/select";
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
  Calendar,
  Users,
  TrendingUp,
  School,
  AlertCircle,
  UserCheck,
  MapPin,
  BarChart3,
} from "lucide-react";
import {
  formatDuration,
  calculateSessionDuration,
  getSessionLocationId,
  getSessionCheckInTimestamp,
  getSessionCheckOutTimestamp,
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

interface AttendanceFilters {
  dateRange: "today" | "week" | "month" | "quarter" | "custom";
  startDate?: Date;
  endDate?: Date;
  providerId?: string;
  schoolId?: string;
}

interface ProviderAttendance {
  providerId: string;
  providerName: string;
  totalDays: number;
  totalSessions: number;
  totalDuration: number;
  averageSessionDuration: number;
  schoolsVisited: string[];
  attendanceRate: number;
  lastSession?: Date;
}

interface SchoolAttendance {
  schoolId: string;
  schoolName: string;
  totalProviders: number;
  totalSessions: number;
  totalDuration: number;
  averageSessionDuration: number;
  providersVisited: string[];
  coverageRate: number;
}

interface AttendanceSummaryData {
  providerSummaries: ProviderAttendance[];
  schoolSummaries: SchoolAttendance[];
  overallStats: {
    totalProviders: number;
    totalSchools: number;
    averageAttendanceRate: number;
    totalSessionDays: number;
    mostActiveProvider: string;
    mostVisitedSchool: string;
  };
}

export function AttendanceSummary() {
  const [_sessions, setSessions] = useState<SessionData[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [providers, setProviders] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AttendanceFilters>({
    dateRange: "month",
  });
  const [attendanceData, setAttendanceData] = useState<AttendanceSummaryData>({
    providerSummaries: [],
    schoolSummaries: [],
    overallStats: {
      totalProviders: 0,
      totalSchools: 0,
      averageAttendanceRate: 0,
      totalSessionDays: 0,
      mostActiveProvider: "",
      mostVisitedSchool: "",
    },
  });

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [schoolsData, usersData] = await Promise.all([
          getCollection(COLLECTIONS.LOCATIONS),
          getCollection(COLLECTIONS.USERS),
        ]);

        setSchools(schoolsData as School[]);
        const users = usersData as User[];
        setAllUsers(users);
        setProviders(
          users.filter((user: User) => user.role === "provider")
        );
      } catch (err) {
        console.error("Error loading initial data:", err);
        setError("Failed to load initial data");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Get date range for filtering
  const getDateRange = useCallback(
    (range: AttendanceFilters["dateRange"]) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (range) {
        case "today":
          return {
            startDate: today,
            endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          };
        case "week":
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 7);
          return { startDate: startOfWeek, endDate: endOfWeek };
        case "month":
          const startOfMonth = new Date(
            today.getFullYear(),
            today.getMonth(),
            1
          );
          const endOfMonth = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            1
          );
          return { startDate: startOfMonth, endDate: endOfMonth };
        case "quarter":
          const currentQuarter = Math.floor(today.getMonth() / 3);
          const startOfQuarter = new Date(
            today.getFullYear(),
            currentQuarter * 3,
            1
          );
          const endOfQuarter = new Date(
            today.getFullYear(),
            (currentQuarter + 1) * 3,
            1
          );
          return { startDate: startOfQuarter, endDate: endOfQuarter };
        case "custom":
          return {
            startDate: filters.startDate,
            endDate: filters.endDate,
          };
        default:
          return { startDate: null, endDate: null };
      }
    },
    [filters.startDate, filters.endDate]
  );

  // Load attendance data
  const loadAttendanceData = useCallback(async () => {
    // Wait until initial schools and users are loaded
    if (allUsers.length === 0 && schools.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      // Get all sessions from Firestore
      const sessionsData = await getCollection(COLLECTIONS.SESSIONS);
      let filteredSessions = sessionsData as SessionData[];

      // Apply date filtering
      const dateRange = getDateRange(filters.dateRange);
      if (dateRange.startDate && dateRange.endDate) {
        filteredSessions = filteredSessions.filter((session) => {
          const ts = getSessionCheckInTimestamp(session);
          if (!ts) return false;
          const sessionDate = ts.toDate();
          return (
            sessionDate >= dateRange.startDate! &&
            sessionDate <= dateRange.endDate!
          );
        });
      }

      // Apply provider filtering
      if (filters.providerId) {
        filteredSessions = filteredSessions.filter(
          (session) => session.userId === filters.providerId
        );
      }

      // Apply school filtering
      if (filters.schoolId) {
        filteredSessions = filteredSessions.filter(
          (session) => getSessionLocationId(session) === filters.schoolId
        );
      }

      // Calculate provider attendance summaries
      const providerSummaries = calculateProviderAttendance(filteredSessions, allUsers);

      // Calculate school attendance summaries
      const schoolSummaries = calculateSchoolAttendance(filteredSessions, schools, allUsers);

      // Calculate overall statistics
      const overallStats = calculateOverallStats(
        providerSummaries,
        schoolSummaries,
        allUsers
      );

      setAttendanceData({
        providerSummaries,
        schoolSummaries,
        overallStats,
      });

      setSessions(filteredSessions);
    } catch (err) {
      console.error("Error loading attendance data:", err);
      setError("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }, [filters, getDateRange, allUsers, schools]);

  // Calculate provider attendance data
  const calculateProviderAttendance = (
    sessions: SessionData[],
    allUsers: User[]
  ): ProviderAttendance[] => {
    // Internal accumulating types — Sets stored as Sets, not as `any`
    interface ProviderAccum {
      providerId: string;
      providerName: string;
      totalDays: Set<string>;
      totalSessions: number;
      totalDuration: number;
      schoolsVisited: Set<string>;
      lastSession?: Date;
    }

    const providerMap = new Map<string, ProviderAccum>();

    sessions.forEach((session) => {
      const providerId = session.userId;
      const cin = getSessionCheckInTimestamp(session);
      if (!cin) return;

      const sessionDate = cin.toDate().toDateString();

      if (!providerMap.has(providerId)) {
        providerMap.set(providerId, {
          providerId,
          providerName: getUserDisplay(providerId, allUsers),
          totalDays: new Set<string>(),
          totalSessions: 0,
          totalDuration: 0,
          schoolsVisited: new Set<string>(),
          lastSession: undefined,
        });
      }

      const provider = providerMap.get(providerId)!;
      provider.totalDays.add(sessionDate);
      provider.totalSessions++;

      const cout = getSessionCheckOutTimestamp(session);
      const duration = calculateSessionDuration(
        cin,
        cout ?? undefined,
        session.durationMinutes
      );
      provider.totalDuration += duration;

      const locationId = getSessionLocationId(session);
      if (locationId) {
        provider.schoolsVisited.add(locationId);
      }

      const sessionDateTime = cin.toDate();
      if (!provider.lastSession || sessionDateTime > provider.lastSession) {
        provider.lastSession = sessionDateTime;
      }
    });

    // Convert sets to values and calculate derived metrics
    return Array.from(providerMap.values()).map((provider) => ({
      providerId: provider.providerId,
      providerName: provider.providerName,
      totalDays: provider.totalDays.size,
      totalSessions: provider.totalSessions,
      totalDuration: provider.totalDuration,
      averageSessionDuration:
        provider.totalSessions > 0
          ? Math.round(provider.totalDuration / provider.totalSessions)
          : 0,
      schoolsVisited: Array.from(provider.schoolsVisited),
      attendanceRate: calculateAttendanceRate(provider.totalDays, filters),
      lastSession: provider.lastSession,
    }));
  };

  // Calculate school attendance data
  const calculateSchoolAttendance = (
    sessions: SessionData[],
    schools: School[],
    allUsers: User[]
  ): SchoolAttendance[] => {
    const providerUsers = allUsers.filter((u) => u.role === "provider");

    interface SchoolAccum {
      schoolId: string;
      schoolName: string;
      totalProviders: Set<string>;
      totalSessions: number;
      totalDuration: number;
      providersVisited: Set<string>;
    }

    const schoolMap = new Map<string, SchoolAccum>();

    sessions.forEach((session) => {
      const locationId = getSessionLocationId(session);
      const schoolId = locationId || "__unknown__";

      if (!schoolMap.has(schoolId)) {
        schoolMap.set(schoolId, {
          schoolId,
          schoolName: getSchoolName(schoolId, schools),
          totalProviders: new Set<string>(),
          totalSessions: 0,
          totalDuration: 0,
          providersVisited: new Set<string>(),
        });
      }

      const school = schoolMap.get(schoolId)!;
      school.totalSessions++;

      const cin = getSessionCheckInTimestamp(session);
      const cout = getSessionCheckOutTimestamp(session);
      if (cin) {
        const duration = calculateSessionDuration(
          cin,
          cout ?? undefined,
          session.durationMinutes
        );
        school.totalDuration += duration;
      }

      // Provider-specific metrics: exclude admin users
      const user = allUsers.find((u) => u.id === session.userId);
      if (user?.role === "provider") {
        school.totalProviders.add(session.userId);
        school.providersVisited.add(session.userId);
      }
    });

    return Array.from(schoolMap.values()).map((school) => ({
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      totalProviders: school.totalProviders.size,
      totalSessions: school.totalSessions,
      totalDuration: school.totalDuration,
      averageSessionDuration:
        school.totalSessions > 0
          ? Math.round(school.totalDuration / school.totalSessions)
          : 0,
      providersVisited: Array.from(school.providersVisited),
      coverageRate:
        providerUsers.length > 0
          ? Math.round(
              (school.totalProviders.size / providerUsers.length) * 100
            )
          : 0,
    }));
  };

  // Calculate overall statistics
  const calculateOverallStats = (
    providerSummaries: ProviderAttendance[],
    schoolSummaries: SchoolAttendance[],
    allUsers: User[]
  ) => {
    const providerOnlySummaries = providerSummaries.filter((ps) => {
      const user = allUsers.find((u) => u.id === ps.providerId);
      return user?.role === "provider";
    });

    const totalProviders = providerOnlySummaries.length;
    const totalSchools = schoolSummaries.length;
    const averageAttendanceRate =
      totalProviders > 0
        ? Math.round(
            providerOnlySummaries.reduce((sum, p) => sum + p.attendanceRate, 0) /
              totalProviders
          )
        : 0;
    const totalSessionDays = providerOnlySummaries.reduce(
      (sum, p) => sum + p.totalDays,
      0
    );

    const mostActiveProvider =
      providerOnlySummaries.length > 0
        ? providerOnlySummaries.reduce((most, current) =>
            current.totalSessions > most.totalSessions ? current : most
          ).providerName
        : "";

    const mostVisitedSchool =
      schoolSummaries.length > 0
        ? schoolSummaries.reduce((most, current) =>
            current.totalSessions > most.totalSessions ? current : most
          ).schoolName
        : "";

    return {
      totalProviders,
      totalSchools,
      averageAttendanceRate,
      totalSessionDays,
      mostActiveProvider,
      mostVisitedSchool,
    };
  };

  // Calculate attendance rate based on expected working days
  const calculateAttendanceRate = (
    totalDays: Set<string>,
    filters: AttendanceFilters
  ): number => {
    const dateRange = getDateRange(filters.dateRange);
    if (!dateRange.startDate || !dateRange.endDate) return 0;

    const totalWorkingDays = getWorkingDaysBetween(
      dateRange.startDate,
      dateRange.endDate
    );
    return totalWorkingDays > 0
      ? Math.round((totalDays.size / totalWorkingDays) * 100)
      : 0;
  };

  // Get working days between two dates (excluding weekends)
  const getWorkingDaysBetween = (startDate: Date, endDate: Date): number => {
    let workingDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Not Sunday (0) or Saturday (6)
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  };

  // Load attendance data when filters change
  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  // Get school name by ID
  const getSchoolName = (schoolId: string, schoolsList: School[]) => {
    const school = schoolsList.find((s) => s.id === schoolId);
    return school?.name || "Unknown School";
  };

  // Get display label for any user (provider or admin)
  const getUserDisplay = (userId: string, users: User[]) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return "Unknown Provider";
    if (user.role === "admin") {
      return `Admin (${user.displayName || user.email})`;
    }
    return user.displayName || user.email;
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof AttendanceFilters, value: any) => {
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

  return (
    <div className="space-y-6">
      {/* Attendance Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance Summary Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label htmlFor="dateRange">Date Range</Label>
              <SimpleSelect
                id="dateRange"
                options={[
                  { value: "today", label: "Today" },
                  { value: "week", label: "This Week" },
                  { value: "month", label: "This Month" },
                  { value: "quarter", label: "This Quarter" },
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
              <SimpleSelect
                id="provider"
                options={[
                  { value: "__all__", label: "All Providers" },
                  ...providers.map((provider) => ({
                    value: provider.id,
                    label: provider.displayName || provider.email,
                  })),
                ]}
                value={filters.providerId || "__all__"}
                onValueChange={(value) =>
                  handleFilterChange("providerId", value === "__all__" ? undefined : value)
                }
                placeholder="All Providers"
              />
            </div>

            {/* School Filter */}
            <div className="space-y-2">
              <Label htmlFor="school">School</Label>
              <SimpleSelect
                id="school"
                options={[
                  { value: "__all__", label: "All Schools" },
                  ...schools.map((school) => ({
                    value: school.id,
                    label: school.name,
                  })),
                ]}
                value={filters.schoolId || "__all__"}
                onValueChange={(value) =>
                  handleFilterChange("schoolId", value === "__all__" ? undefined : value)
                }
                placeholder="All Schools"
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
            <Button onClick={loadAttendanceData} disabled={loading}>
              {loading ? "Loading..." : "Apply Filters"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFilters({ dateRange: "month" });
                setError(null);
              }}
            >
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Overall Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Providers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {attendanceData.overallStats.totalProviders}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {attendanceData.overallStats.totalSchools}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Attendance Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {attendanceData.overallStats.averageAttendanceRate}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Session Days
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {attendanceData.overallStats.totalSessionDays}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider Attendance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {(() => {
              const adminSummaries = attendanceData.providerSummaries.filter(
                (ps) => {
                  const user = allUsers.find((u) => u.id === ps.providerId);
                  return user?.role === "admin";
                }
              );
              const providerSummariesOnly =
                attendanceData.providerSummaries.length -
                adminSummaries.length;
              return (
                <>
                  Provider Attendance Summary ({providerSummariesOnly}{" "}
                  providers
                  {adminSummaries.length > 0 && (
                    <> + {adminSummaries.length} admin user{adminSummaries.length !== 1 ? "s" : ""}</>
                  )}
                  )
                </>
              );
            })()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceData.providerSummaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No provider attendance data found for the selected filters
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Days Attended</TableHead>
                    <TableHead>Total Sessions</TableHead>
                    <TableHead>Total Duration</TableHead>
                    <TableHead>Avg Session</TableHead>
                    <TableHead>Schools Visited</TableHead>
                    <TableHead>Attendance Rate</TableHead>
                    <TableHead>Last Session</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.providerSummaries.map((provider) => (
                    <TableRow key={provider.providerId}>
                      <TableCell className="font-medium">
                        {provider.providerName}
                      </TableCell>
                      <TableCell>{provider.totalDays}</TableCell>
                      <TableCell>{provider.totalSessions}</TableCell>
                      <TableCell>
                        {formatDuration(provider.totalDuration)}
                      </TableCell>
                      <TableCell>
                        {formatDuration(provider.averageSessionDuration)}
                      </TableCell>
                      <TableCell>{provider.schoolsVisited.length}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            provider.attendanceRate >= 80
                              ? "default"
                              : provider.attendanceRate >= 60
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {provider.attendanceRate}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {provider.lastSession
                          ? provider.lastSession.toLocaleDateString()
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* School Attendance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            School Coverage Summary ({
              attendanceData.schoolSummaries.length
            }{" "}
            schools)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceData.schoolSummaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No school coverage data found for the selected filters
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead>Providers</TableHead>
                    <TableHead>Total Sessions</TableHead>
                    <TableHead>Total Duration</TableHead>
                    <TableHead>Avg Session</TableHead>
                    <TableHead>Coverage Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.schoolSummaries.map((school) => (
                    <TableRow key={school.schoolId}>
                      <TableCell className="font-medium">
                        {school.schoolName}
                      </TableCell>
                      <TableCell>{school.totalProviders}</TableCell>
                      <TableCell>{school.totalSessions}</TableCell>
                      <TableCell>
                        {formatDuration(school.totalDuration)}
                      </TableCell>
                      <TableCell>
                        {formatDuration(school.averageSessionDuration)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            school.coverageRate >= 50
                              ? "default"
                              : school.coverageRate >= 25
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {school.coverageRate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Insights */}
      {(attendanceData.overallStats.mostActiveProvider ||
        attendanceData.overallStats.mostVisitedSchool) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {attendanceData.overallStats.mostActiveProvider && (
                <div className="space-y-2">
                  <h4 className="font-medium">Most Active Provider</h4>
                  <p className="text-sm text-muted-foreground">
                    {attendanceData.overallStats.mostActiveProvider}
                  </p>
                </div>
              )}
              {attendanceData.overallStats.mostVisitedSchool && (
                <div className="space-y-2">
                  <h4 className="font-medium">Most Visited School</h4>
                  <p className="text-sm text-muted-foreground">
                    {attendanceData.overallStats.mostVisitedSchool}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
