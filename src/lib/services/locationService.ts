/**
 * Location Service - Firestore-backed location operations
 * 
 * This service replaces the mock schoolService.ts with real Firestore queries.
 * Uses Location.assignedProviders as the single source of truth for assignments.
 */

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "../firebase/firestore";
import { Location } from "../firebase/types";

export interface LocationWithDistance extends Location {
  distance?: number; // in meters
}

/**
 * Get all locations (admin only)
 */
export async function getAllLocations(): Promise<Location[]> {
  const q = query(
    collection(db, COLLECTIONS.LOCATIONS),
    where("active", "==", true),
    orderBy("name")
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Location[];
}

/**
 * Get locations assigned to a specific provider
 * This is the PRIMARY query for providers to see their schools
 */
export async function getAssignedLocations(providerId: string): Promise<Location[]> {
  const q = query(
    collection(db, COLLECTIONS.LOCATIONS),
    where("assignedProviders", "array-contains", providerId),
    where("active", "==", true),
    orderBy("name")
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Location[];
}

/**
 * Get a single location by ID
 */
export async function getLocationById(locationId: string): Promise<Location | null> {
  const docRef = doc(db, COLLECTIONS.LOCATIONS, locationId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return {
    id: docSnap.id,
    ...docSnap.data()
  } as Location;
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Check if coordinates are within a location's allowed radius
 */
export function isWithinRadius(
  userLat: number,
  userLon: number,
  location: Location
): boolean {
  const distance = calculateDistance(
    userLat,
    userLon,
    location.geo.latitude,
    location.geo.longitude
  );
  
  const allowedRadius = location.radiusMeters ?? 100; // Default 100m
  return distance <= allowedRadius;
}

/**
 * Add distances to locations based on user's current position
 */
export function addDistances(
  locations: Location[],
  userLat: number,
  userLon: number
): LocationWithDistance[] {
  return locations.map(location => ({
    ...location,
    distance: calculateDistance(
      userLat,
      userLon,
      location.geo.latitude,
      location.geo.longitude
    )
  }));
}

/**
 * Sort locations by distance (nearest first)
 */
export function sortByDistance(
  locations: LocationWithDistance[]
): LocationWithDistance[] {
  return [...locations].sort((a, b) => {
    if (a.distance === undefined) return 1;
    if (b.distance === undefined) return -1;
    return a.distance - b.distance;
  });
}

/**
 * Get locations with distances, sorted by proximity
 */
export async function getAssignedLocationsWithDistance(
  providerId: string,
  userLat: number,
  userLon: number
): Promise<LocationWithDistance[]> {
  const locations = await getAssignedLocations(providerId);
  const withDistances = addDistances(locations, userLat, userLon);
  return sortByDistance(withDistances);
}

/**
 * Assign a provider to a location (admin only)
 */
export async function assignProviderToLocation(
  providerId: string,
  locationId: string
): Promise<void> {
  const locationRef = doc(db, COLLECTIONS.LOCATIONS, locationId);
  await updateDoc(locationRef, {
    assignedProviders: arrayUnion(providerId),
    updatedAt: Timestamp.now()
  });
}

/**
 * Remove a provider from a location (admin only)
 */
export async function removeProviderFromLocation(
  providerId: string,
  locationId: string
): Promise<void> {
  const locationRef = doc(db, COLLECTIONS.LOCATIONS, locationId);
  await updateDoc(locationRef, {
    assignedProviders: arrayRemove(providerId),
    updatedAt: Timestamp.now()
  });
}

/**
 * Replace all providers for a location (admin only)
 */
export async function replaceLocationProviders(
  locationId: string,
  providerIds: string[]
): Promise<void> {
  const locationRef = doc(db, COLLECTIONS.LOCATIONS, locationId);
  await updateDoc(locationRef, {
    assignedProviders: providerIds,
    updatedAt: Timestamp.now()
  });
}

/**
 * Get count of locations assigned to a provider
 */
export async function getAssignedLocationCount(providerId: string): Promise<number> {
  const locations = await getAssignedLocations(providerId);
  return locations.length;
}

/**
 * Check if a provider is assigned to a specific location
 */
export async function isProviderAssigned(
  providerId: string,
  locationId: string
): Promise<boolean> {
  const location = await getLocationById(locationId);
  if (!location) return false;
  return location.assignedProviders.includes(providerId);
}
