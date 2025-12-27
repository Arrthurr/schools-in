import { Timestamp, GeoPoint } from "firebase/firestore";

export interface User {
  uid: string;
  role: "provider" | "admin";
  displayName: string;
  email: string;
  photoURL?: string;
  disabled?: boolean;
  isActive?: boolean;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  phoneNumber?: string | null;
  updatedAt?: Timestamp;
  // Opt-in flag for automatic geofence-based check-in/out
  autoGeofenceCheckEnabled?: boolean;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  geo: GeoPoint;
  radiusMeters?: number; // default 100
  timezone?: string; // default "America/Chicago"
  active?: boolean; // default true
  assignedProviders: string[]; // array of userIds - authoritative for RBAC
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Legacy fields for backward compatibility
  gpsCoordinates?: GeoPoint;
  radius?: number;
  region?: string;
  isActive?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface Session {
  id: string;
  userId: string;
  locationId: string;
  startTime: Timestamp;
  endTime?: Timestamp; // optional until completed
  status: "active" | "paused" | "completed" | "cancelled" | "error";
  durationMinutes?: number; // derived on completion; excludes paused time
  checkInMethod: "geo" | "manual" | "offline-sync";
  distanceFromCenterAtCheckIn: number; // in meters
  dayKey: string; // YYYY-MM-DD for America/Chicago, computed from startTime
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Legacy compatibility fields (read-only usage)
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp | null;
  duration?: number; // legacy total minutes
}

export interface Feedback {
  id: string;
  providerId: string;
  providerEmail?: string;
  providerName?: string;
  category: "bug" | "feature_request" | "general" | "other";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  url?: string;
  userAgent?: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Service {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Schedule {
  id: string;
  providerId: string;
  locationId: string;
  serviceId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// Additional utility types
export interface UserFilters {
  role?: "provider" | "admin";
  search?: string;
  isActive?: boolean;
}

export interface LocationFilters {
  searchTerm?: string;
  region?: string;
  isActive?: boolean;
  hasProviders?: boolean;
}

export interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  providerCount: number;
  adminCount: number;
}

export interface LocationStatistics {
  totalSchools: number;
  activeSchools: number;
  schoolsWithProviders: number;
  schoolsWithoutProviders: number;
  averageDistance?: number;
}

export interface ProviderWithSchools extends User {
  assignedSchoolsCount: number;
  assignedSchools: Location[];
}

// Dashboard-specific types for metrics
export interface ProviderMetrics {
  currentSession: Session | null;
  weeklySessionsCount: number;
  weeklyTotalHours: number;
}

export interface AdminMetrics {
  activeProviders: number;
  activeSessions: number;
  todaysCheckIns: number;
  yesterdaysCheckIns: number;
  checkInChangePercentage: number;
  avgSessionDurationHours: number;
  recentActivity: SessionActivity[];
}

export interface SessionActivity {
  id: string;
  type: "check-in" | "check-out" | "pause" | "resume";
  timestamp: Timestamp;
  userId: string;
  userName: string;
  locationId: string;
  locationName: string;
}

// CSV Export types
export interface SessionExportData {
  user: string;
  location: string;
  startTime: string;
  endTime: string;
  status: string;
  durationMinutes: number;
  checkInMethod: string;
  distanceFromCenterAtCheckIn: number;
  notes: string;
}

export interface ExportDateRange {
  startDate: string; // YYYY-MM-DD in America/Chicago
  endDate: string; // YYYY-MM-DD in America/Chicago
}

export interface ReportSchedule {
  id: string;
  name: string;
  description: string;
  reportType: "sessions" | "attendance" | "analytics" | "management";
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  deliveryTime: string;
  recipients: string[];
  filters: {
    dateRange?: string;
    providers?: string[];
    schools?: string[];
    status?: string[];
  };
  format: "pdf" | "csv" | "excel";
  isActive: boolean;
  lastRun?: Timestamp;
  nextRun?: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
}
