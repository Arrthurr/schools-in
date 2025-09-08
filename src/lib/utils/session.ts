// Session management utilities and business logic

import { Timestamp } from 'firebase/firestore';
import { Coordinates } from './location';

export interface SessionData {
  id?: string;
  userId: string;
  schoolId: string;
  checkInTime: Timestamp;
  checkOutTime?: Timestamp;
  checkInLocation: Coordinates;
  checkOutLocation?: Coordinates;
  status: 'active' | 'completed' | 'error';
  duration?: number;
  notes?: string;
}

// Calculate session duration in minutes
export const calculateSessionDuration = (checkInTime: Timestamp, checkOutTime?: Timestamp): number => {
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
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
};

// Format session time for display
export const formatSessionTime = (timestamp: Timestamp): string => {
  return timestamp.toDate().toLocaleString();
};

// Get session status color for UI
export const getSessionStatusColor = (status: string): string => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'completed':
      return 'bg-blue-100 text-blue-800';
    case 'error':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// Validate session data
export const validateSessionData = (sessionData: Partial<SessionData>): string[] => {
  const errors: string[] = [];
  
  if (!sessionData.userId) {
    errors.push('User ID is required');
  }
  
  if (!sessionData.schoolId) {
    errors.push('School ID is required');
  }
  
  if (!sessionData.checkInLocation) {
    errors.push('Check-in location is required');
  }
  
  if (!sessionData.checkInTime) {
    errors.push('Check-in time is required');
  }
  
  return errors;
};

// Check if session is still active (within reasonable time limit)
export const isSessionStillActive = (checkInTime: Timestamp, maxHours: number = 12): boolean => {
  const now = Date.now();
  const checkInMs = checkInTime.toMillis();
  const maxDurationMs = maxHours * 60 * 60 * 1000; // Convert hours to milliseconds
  
  return (now - checkInMs) <= maxDurationMs;
};

// Create session summary for reports
export const createSessionSummary = (sessions: SessionData[]): {
  totalSessions: number;
  totalDuration: number;
  averageDuration: number;
  activeSessions: number;
  completedSessions: number;
} => {
  const totalSessions = sessions.length;
  const activeSessions = sessions.filter(s => s.status === 'active').length;
  const completedSessions = sessions.filter(s => s.status === 'completed').length;
  
  const totalDuration = sessions
    .filter(s => s.duration)
    .reduce((sum, s) => sum + (s.duration || 0), 0);
  
  const averageDuration = completedSessions > 0 ? Math.round(totalDuration / completedSessions) : 0;
  
  return {
    totalSessions,
    totalDuration,
    averageDuration,
    activeSessions,
    completedSessions
  };
};
