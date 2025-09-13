import { Timestamp, GeoPoint } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'provider' | 'admin';
  assignedLocations?: string[];
}

export interface Location {
  id: string;
  name: string;
  address: string;
  gpsCoordinates: GeoPoint;
  radius: number; // in meters
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
