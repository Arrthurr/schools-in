"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../lib/hooks/useAuth";
import { School } from "../../lib/services/schoolService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Clock,
  MapPin,
  Play,
  Square,
  Timer,
  AlertCircle,
  CheckCircle,
  School as SchoolIcon,
} from "lucide-react";

interface SessionData {
  id: string;
  schoolId: string;
  schoolName: string;
  startTime: Date;
  status: "active" | "paused" | "completed";
  duration: number; // in minutes
  location: {
    latitude: number;
    longitude: number;
  };
}

interface SessionStatusProps {
  currentSession?: SessionData | null;
  onEndSession?: (sessionId: string) => void;
  onPauseSession?: (sessionId: string) => void;
  onResumeSession?: (sessionId: string) => void;
  className?: string;
}

export const SessionStatus: React.FC<SessionStatusProps> = ({
  currentSession,
  onEndSession,
  onPauseSession,
  onResumeSession,
  className = "",
}) => {
  const { user } = useAuth();
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Update elapsed time every second for active sessions
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (currentSession && currentSession.status === "active") {
      setIsRunning(true);
      interval = setInterval(() => {
        const now = new Date();
        const startTime = new Date(currentSession.startTime);
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000 / 60); // in minutes
        setElapsedTime(elapsed);
      }, 60000); // Update every minute
    } else {
      setIsRunning(false);
      if (currentSession) {
        setElapsedTime(currentSession.duration);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentSession]);

  // Format duration for display
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Format time for display
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Get status badge
  const getStatusBadge = () => {
    if (!currentSession) return null;

    switch (currentSession.status) {
      case "active":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
            <Play className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case "paused":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-200">
            <Square className="w-3 h-3 mr-1" />
            Paused
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      default:
        return null;
    }
  };

  // Handle session actions
  const handleEndSession = () => {
    if (currentSession && onEndSession) {
      onEndSession(currentSession.id);
    }
  };

  const handlePauseSession = () => {
    if (currentSession && onPauseSession) {
      onPauseSession(currentSession.id);
    }
  };

  const handleResumeSession = () => {
    if (currentSession && onResumeSession) {
      onResumeSession(currentSession.id);
    }
  };

  // No active session
  if (!currentSession) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Timer className="h-5 w-5 mr-2 text-[#154690]" />
            Current Session
          </CardTitle>
          <CardDescription>No active session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Clock className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-600 mb-4">
              You're not currently checked in at any school
            </p>
            <p className="text-sm text-gray-500">
              Check in at a school to start tracking your session
            </p>
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
            <CardTitle className="flex items-center text-lg">
              <Timer className="h-5 w-5 mr-2 text-[#154690]" />
              Current Session
            </CardTitle>
            <CardDescription>
              Started at {formatTime(new Date(currentSession.startTime))}
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* School Information */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <SchoolIcon className="h-5 w-5 text-[#154690]" />
          <div>
            <p className="font-medium text-gray-900">{currentSession.schoolName}</p>
            <div className="flex items-center text-sm text-gray-600 mt-1">
              <MapPin className="h-3 w-3 mr-1" />
              <span>
                {currentSession.location.latitude.toFixed(4)}, {currentSession.location.longitude.toFixed(4)}
              </span>
            </div>
          </div>
        </div>

        {/* Session Timer */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-[#154690] rounded-full mb-4">
            <div className="text-center text-white">
              <div className="text-2xl font-bold">
                {formatDuration(elapsedTime)}
              </div>
              <div className="text-xs opacity-80">
                {isRunning ? "ACTIVE" : currentSession.status.toUpperCase()}
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Session duration
          </p>
        </div>

        {/* Session Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">
              {formatTime(new Date(currentSession.startTime))}
            </div>
            <div className="text-sm text-gray-600">Start Time</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">
              {currentSession.status === "completed" ? "Ended" : "Ongoing"}
            </div>
            <div className="text-sm text-gray-600">Status</div>
          </div>
        </div>

        {/* Action Buttons */}
        {currentSession.status !== "completed" && (
          <div className="flex gap-3">
            {currentSession.status === "active" ? (
              <>
                <Button
                  onClick={handlePauseSession}
                  variant="outline"
                  className="flex-1"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button
                  onClick={handleEndSession}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  End Session
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleResumeSession}
                  className="flex-1 bg-[#154690] hover:bg-[#0f3a7a]"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
                <Button
                  onClick={handleEndSession}
                  variant="outline"
                  className="flex-1"
                >
                  End Session
                </Button>
              </>
            )}
          </div>
        )}

        {/* Warning for paused sessions */}
        {currentSession.status === "paused" && (
          <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-yellow-900 mb-1">Session Paused</p>
              <p className="text-yellow-800 text-sm">
                Remember to resume your session when you return to work.
                Paused sessions don't count toward your active time.
              </p>
            </div>
          </div>
        )}

        {/* Session completed info */}
        {currentSession.status === "completed" && (
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-900 mb-1">Session Completed</p>
              <p className="text-blue-800 text-sm">
                This session has been completed and the time has been recorded.
                Total duration: {formatDuration(currentSession.duration)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionStatus;
