// Session management utilities and business logic

import { Timestamp } from "firebase/firestore";
import { Coordinates } from "./location";

export interface SessionData {
  id?: string;
  userId: string;
  schoolId: string;
  checkInTime: Timestamp;
  checkOutTime?: Timestamp;
  checkInLocation: Coordinates;
  checkOutLocation?: Coordinates;
  status: "active" | "completed" | "error" | "paused" | "cancelled";
  duration?: number;
  notes?: string;
}

// Calculate session duration in minutes
export const calculateSessionDuration = (
  checkInTime: Timestamp,
  checkOutTime?: Timestamp
): number => {
  if (!checkOutTime) return 0;

  const checkInMs = checkInTime.toMillis();
  const checkOutMs = checkOutTime.toMillis();

  return Math.round((checkOutMs - checkInMs) / (1000 * 60)); // Convert to minutes
};

// Format duration for display
export const formatDuration = (minutes: number): string => {
  if (minutes <= 0) {
    return "0m";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
};

// Format duration in a more detailed way for modals/details
export const formatDurationDetailed = (minutes: number): string => {
  if (minutes <= 0) {
    return "0 minutes";
  }

  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  return `${hours} hour${hours !== 1 ? "s" : ""} ${remainingMinutes} minute${
    remainingMinutes !== 1 ? "s" : ""
  }`;
};

// Format session time for display
export const formatSessionTime = (timestamp: Timestamp): string => {
  return timestamp.toDate().toLocaleString();
};

// Get session status color for UI
export const getSessionStatusColor = (status: string): string => {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 border-green-200";
    case "completed":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "paused":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "error":
      return "bg-red-100 text-red-800 border-red-200";
    case "cancelled":
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

// Get session status configuration
export const getSessionStatusConfig = (status: string) => {
  switch (status) {
    case "active":
      return {
        label: "Active",
        color: "bg-green-100 text-green-800 border-green-200",
        icon: "Clock",
        description: "Session is currently in progress"
      };
    case "completed":
      return {
        label: "Completed",
        color: "bg-blue-100 text-blue-800 border-blue-200",
        icon: "CheckCircle",
        description: "Session has been completed successfully"
      };
    case "paused":
      return {
        label: "Paused",
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        icon: "Pause",
        description: "Session is temporarily paused"
      };
    case "error":
      return {
        label: "Error",
        color: "bg-red-100 text-red-800 border-red-200",
        icon: "AlertCircle",
        description: "Session encountered an error"
      };
    case "cancelled":
      return {
        label: "Cancelled",
        color: "bg-gray-100 text-gray-800 border-gray-200",
        icon: "X",
        description: "Session was cancelled"
      };
    default:
      return {
        label: status,
        color: "bg-gray-100 text-gray-800 border-gray-200",
        icon: "HelpCircle",
        description: "Unknown status"
      };
  }
};

// Validate session data
export const validateSessionData = (
  sessionData: Partial<SessionData>
): string[] => {
  const errors: string[] = [];

  if (!sessionData.userId) {
    errors.push("User ID is required");
  }

  if (!sessionData.schoolId) {
    errors.push("School ID is required");
  }

  if (!sessionData.checkInLocation) {
    errors.push("Check-in location is required");
  }

  if (!sessionData.checkInTime) {
    errors.push("Check-in time is required");
  }

  return errors;
};

// Check if session is still active (within reasonable time limit)
export const isSessionStillActive = (
  checkInTime: Timestamp,
  maxHours: number = 12
): boolean => {
  const now = Date.now();
  const checkInMs = checkInTime.toMillis();
  const maxDurationMs = maxHours * 60 * 60 * 1000; // Convert hours to milliseconds

  return now - checkInMs <= maxDurationMs;
};

// Create session summary for reports
export const createSessionSummary = (
  sessions: SessionData[]
): {
  totalSessions: number;
  totalDuration: number;
  averageDuration: number;
  activeSessions: number;
  completedSessions: number;
} => {
  const totalSessions = sessions.length;
  const activeSessions = sessions.filter((s) => s.status === "active").length;
  const completedSessions = sessions.filter(
    (s) => s.status === "completed"
  ).length;

  const totalDuration = sessions
    .filter((s) => s.duration)
    .reduce((sum, s) => sum + (s.duration || 0), 0);

  const averageDuration =
    completedSessions > 0 ? Math.round(totalDuration / completedSessions) : 0;

  return {
    totalSessions,
    totalDuration,
    averageDuration,
    activeSessions,
    completedSessions,
  };
};
