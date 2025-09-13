import { z } from 'zod';
import { GeoPoint, Timestamp } from 'firebase/firestore';

// Zod schema for GeoPoint
const geoPointSchema = z.custom<GeoPoint>(val => val instanceof GeoPoint, {
  message: 'Invalid GeoPoint',
});

// Zod schema for Timestamp
const timestampSchema = z.custom<Timestamp>(val => val instanceof Timestamp, {
  message: 'Invalid Timestamp',
});

// User validation schema
export const userSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  role: z.enum(['provider', 'admin']),
  assignedLocations: z.array(z.string()).optional(),
});

// Location validation schema
export const locationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  gpsCoordinates: geoPointSchema,
  radius: z.number().positive('Radius must be a positive number'),
});

// Session validation schema
export const sessionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  locationId: z.string().min(1),
  checkInTime: timestampSchema,
  checkOutTime: timestampSchema.nullable(),
  status: z.enum(['active', 'completed']),
  duration: z.number().positive().optional(),
});
