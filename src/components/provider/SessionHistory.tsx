"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../lib/hooks/useAuth";
import { useSession } from "../../lib/hooks/useSession";
import { SchoolService } from "../../lib/services/schoolService";
import { formatDuration, formatSessionTime, calculateSessionDuration } from "../../lib/utils/session";
import { SessionData } from "../../lib/utils/session";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";
import { Select, SelectOption } from "../ui/select";
import { DatePicker } from "../ui/date-picker";
import { SessionDetailModal } from "./SessionDetailModal";
import {
  Clock,
  MapPin,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Calendar,
  Filter,
  Eye,
} from "lucide-react";

interface SessionHistoryProps {
  className?: string;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({
  className = "",
}) => {
  const { user } = useAuth();
  const { sessions, loading, error, loadSessions, totalSessions, hasMore } =
    useSession();
  const [schoolNames, setSchoolNames] = useState<Map<string, string>>(
    new Map()
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Filtering state
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [realTimeDurations, setRealTimeDurations] = useState<Map<string, number>>(
    new Map()
  );

  // Create school options for filter dropdown
  const schoolOptions = useMemo((): SelectOption[] => {
    const uniqueSchools = new Map<string, string>();

    sessions.forEach((session) => {
      if (!uniqueSchools.has(session.schoolId)) {
        const schoolName =
          schoolNames.get(session.schoolId) || "Unknown School";
        uniqueSchools.set(session.schoolId, schoolName);
      }
    });

    const options: SelectOption[] = [{ value: "", label: "All Schools" }];
    uniqueSchools.forEach((name, id) => {
      options.push({ value: id, label: name });
    });

    return options;
  }, [sessions, schoolNames]);

  // Load school names for sessions
  useEffect(() => {
    const loadSchoolNames = async () => {
      const names = new Map<string, string>();

      for (const session of sessions) {
        if (!names.has(session.schoolId)) {
          try {
            const school = await SchoolService.getSchoolById(session.schoolId);
            if (school) {
              names.set(session.schoolId, school.name);
            } else {
              names.set(session.schoolId, "Unknown School");
            }
          } catch (err) {
            names.set(session.schoolId, "Unknown School");
          }
        }
      }

      setSchoolNames(names);
    };

    if (sessions.length > 0) {
      loadSchoolNames();
    }
  }, [sessions]);

  // Load sessions on component mount and when page changes
  useEffect(() => {
    if (user?.uid) {
      const filters = {
        ...(selectedSchoolId && { schoolId: selectedSchoolId }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      };
      loadSessions(user.uid, currentPage, pageSize, filters);
    }
  }, [
    user?.uid,
    loadSessions,
    currentPage,
    pageSize,
    selectedSchoolId,
    startDate,
    endDate,
  ]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSchoolId, startDate, endDate]);

  // Update real-time durations for active sessions
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const updates = new Map<string, number>();

      sessions.forEach((session) => {
        if (session.status === "active" && session.checkInTime) {
          const duration = Math.floor(
            (now.getTime() - session.checkInTime.toDate().getTime()) / (1000 * 60)
          );
          updates.set(session.id!, duration);
        }
      });

      setRealTimeDurations(updates);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [sessions]);

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "active":
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Filter out active sessions for history view
  const completedSessions = sessions.filter(
    (session) => session.status === "completed"
  );

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Session History
          </CardTitle>
          <CardDescription>View your past check-in sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading session history...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Session History
          </CardTitle>
          <CardDescription>View your past check-in sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-red-600">
            <AlertCircle className="w-6 h-6 mr-2" />
            Error loading sessions: {error}
          </div>
          <div className="flex justify-center mt-4">
            <Button
              onClick={() => user?.uid && loadSessions(user.uid)}
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Session History
            </CardTitle>
            <CardDescription>
              View your past check-in sessions ({totalSessions} total, page{" "}
              {currentPage} of {Math.ceil(totalSessions / pageSize)})
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              size="sm"
            >
              <Filter className="w-4 h-4 mr-2" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </Button>
            <Button
              onClick={() => {
                setCurrentPage(1);
                setSelectedSchoolId("");
                setStartDate(undefined);
                setEndDate(undefined);
                user?.uid && loadSessions(user.uid, 1, pageSize);
              }}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filtering Controls */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  School
                </label>
                <Select
                  options={schoolOptions}
                  value={selectedSchoolId}
                  onValueChange={setSelectedSchoolId}
                  placeholder="Select school..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Select start date..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="Select end date..."
                />
              </div>
            </div>
            {(selectedSchoolId || startDate || endDate) && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Filters applied: {selectedSchoolId && "School, "}
                  {startDate && "Start Date, "}
                  {endDate && "End Date"}
                </div>
                <Button
                  onClick={() => {
                    setSelectedSchoolId("");
                    setStartDate(undefined);
                    setEndDate(undefined);
                    setCurrentPage(1);
                  }}
                  variant="ghost"
                  size="sm"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {completedSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No completed sessions yet</p>
            <p className="text-sm">
              Your session history will appear here after you check out from
              schools
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Check-in Time</TableHead>
                <TableHead>Check-out Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedSessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                      {schoolNames.get(session.schoolId) || "Loading..."}
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatSessionTime(session.checkInTime)}
                  </TableCell>
                  <TableCell>
                    {session.checkOutTime
                      ? formatSessionTime(session.checkOutTime)
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                      {(() => {
                        if (session.status === "active") {
                          const realTimeDuration = realTimeDurations.get(session.id!);
                          return realTimeDuration !== undefined
                            ? formatDuration(realTimeDuration)
                            : "Calculating...";
                        }
                        return session.duration
                          ? formatDuration(session.duration)
                          : "N/A";
                      })()}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(session.status)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedSession(session);
                        setIsModalOpen(true);
                      }}
                      className="h-8 px-2"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination Controls */}
        {completedSessions.length > 0 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing{" "}
              {Math.min((currentPage - 1) * pageSize + 1, totalSessions)} to{" "}
              {Math.min(currentPage * pageSize, totalSessions)} of{" "}
              {totalSessions} sessions
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {Math.ceil(totalSessions / pageSize)}
              </span>
              <Button
                onClick={() => setCurrentPage((prev) => prev + 1)}
                disabled={!hasMore}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Session Detail Modal */}
      <SessionDetailModal
        session={selectedSession}
        schoolName={
          selectedSession
            ? schoolNames.get(selectedSession.schoolId)
            : undefined
        }
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSession(null);
        }}
      />
    </Card>
  );
};
