import { Timestamp, GeoPoint } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'provider' | 'admin';
  assignedLocations?: string[];
  phoneNumber?: string | null;
  isActive?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  gpsCoordinates: GeoPoint;
  radius: number; // in meters
  region?: string;
  isActive?: boolean;
  assignedProviders?: string[];
  latitude?: number;
  longitude?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Session {
  id: string;
  userId: string;
  locationId: string;
  checkInTime: Timestamp;
  checkOutTime: Timestamp | null;
  status: 'active' | 'completed';
  duration?: number; // in minutes
}

// Additional utility types
export interface UserFilters {
  role?: 'provider' | 'admin';
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
