"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../lib/hooks/useAuth";
import { useSession } from "../../lib/hooks/useSession";
import { SchoolService } from "../../lib/services/schoolService";
import { formatDuration, formatSessionTime } from "../../lib/utils/session";
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
import {
  Clock,
  MapPin,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Calendar,
} from "lucide-react";

interface SessionHistoryProps {
  className?: string;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({
  className = "",
}) => {
  const { user } = useAuth();
  const { sessions, loading, error, loadSessions } = useSession();
  const [schoolNames, setSchoolNames] = useState<Map<string, string>>(new Map());

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

  // Load sessions on component mount
  useEffect(() => {
    if (user?.uid) {
      loadSessions(user.uid);
    }
  }, [user?.uid, loadSessions]);

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "active":
        return <Badge variant="default" className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />Active</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Filter out active sessions for history view
  const completedSessions = sessions.filter(session => session.status === "completed");

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Session History
          </CardTitle>
          <CardDescription>
            View your past check-in sessions
          </CardDescription>
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
          <CardDescription>
            View your past check-in sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-red-600">
            <AlertCircle className="w-6 h-6 mr-2" />
            Error loading sessions: {error}
          </div>
          <div className="flex justify-center mt-4">
            <Button onClick={() => user?.uid && loadSessions(user.uid)} variant="outline">
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
              View your past check-in sessions ({completedSessions.length} total)
            </CardDescription>
          </div>
          <Button
            onClick={() => user?.uid && loadSessions(user.uid)}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {completedSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No completed sessions yet</p>
            <p className="text-sm">Your session history will appear here after you check out from schools</p>
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
                    {session.checkOutTime ? formatSessionTime(session.checkOutTime) : "N/A"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                      {session.duration ? formatDuration(session.duration) : "N/A"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(session.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
