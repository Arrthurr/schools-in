import { GeoPoint } from 'firebase/firestore';

// Earth's radius in meters
const EARTH_RADIUS_METERS = 6371000;

/**
 * Haversine distance between two lat/lng pairs in meters
 * This is the primary function for calculating distance between coordinates
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculate distance between two GeoPoint objects
 * This is the Firebase-friendly version for working with Firestore GeoPoints
 */
export function calculateDistanceBetweenGeoPoints(
  point1: GeoPoint,
  point2: GeoPoint
): number {
  return haversineDistance(
    point1.latitude,
    point1.longitude,
    point2.latitude,
    point2.longitude
  );
}

/**
 * Calculate distance between a user's current position and a location's center
 * Returns distance in meters
 */
export function calculateDistanceToLocation(
  userLatitude: number,
  userLongitude: number,
  locationGeo: GeoPoint
): number {
  return haversineDistance(
    userLatitude,
    userLongitude,
    locationGeo.latitude,
    locationGeo.longitude
  );
}

/**
 * Check if a position is within a specified radius of a location
 * Returns true if within radius, false otherwise
 */
export function withinRadius(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusMeters: number
): boolean {
  return haversineDistance(lat1, lon1, lat2, lon2) <= radiusMeters;
}

/**
 * Check if a user's position is within the geofence of a location
 * This is the primary geofencing function for check-in validation
 */
export function isWithinGeofence(
  userLatitude: number,
  userLongitude: number,
  locationGeo: GeoPoint,
  radiusMeters: number = 100 // Default radius from PRD
): boolean {
  const distance = calculateDistanceToLocation(userLatitude, userLongitude, locationGeo);
  return distance <= radiusMeters;
}

/**
 * Get the distance and whether a user is within the geofence
 * Returns an object with both pieces of information for check-in validation
 */
export function validateGeofence(
  userLatitude: number,
  userLongitude: number,
  locationGeo: GeoPoint,
  radiusMeters: number = 100
): {
  distance: number;
  isWithinGeofence: boolean;
} {
  const distance = calculateDistanceToLocation(userLatitude, userLongitude, locationGeo);
  return {
    distance,
    isWithinGeofence: distance <= radiusMeters
  };
}

/**
 * Create a GeoPoint from latitude and longitude
 * Utility function for creating Firebase GeoPoint objects
 */
export function createGeoPoint(latitude: number, longitude: number): GeoPoint {
  return new GeoPoint(latitude, longitude);
}

/**
 * Validate that coordinates are valid latitude and longitude values
 */
export function areValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !isNaN(latitude) &&
    !isNaN(longitude)
  );
}

/**
 * Get the user's current position using the Geolocation API
 * Returns a Promise that resolves with coordinates or rejects with error
 */
export function getCurrentPosition(options?: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
        ...options
      }
    );
  });
}

/**
 * Get user coordinates and validate against a location's geofence
 * This is a convenience function that combines position getting and validation
 */
export async function validateCurrentPositionAgainstGeofence(
  locationGeo: GeoPoint,
  radiusMeters: number = 100
): Promise<{
  latitude: number;
  longitude: number;
  distance: number;
  isWithinGeofence: boolean;
}> {
  const position = await getCurrentPosition();
  const { latitude, longitude } = position.coords;
  
  if (!areValidCoordinates(latitude, longitude)) {
    throw new Error('Invalid coordinates received from device');
  }
  
  const validation = validateGeofence(latitude, longitude, locationGeo, radiusMeters);
  
  return {
    latitude,
    longitude,
    ...validation
  };
}
