/**
 * Cached School Service - Enhanced performance for location/school data operations
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { Location } from "@/lib/firebase/types";
import { FirebaseCache, CacheTracker } from "@/lib/cache/FirebaseCache";
import {
  getCachedLocationsByProvider,
  getCachedCollection,
} from "@/lib/firebase/cachedFirestore";

export interface SchoolFilters {
  providerId?: string;
  status?: "active" | "inactive";
  hasProvider?: boolean;
  searchTerm?: string;
  region?: string;
}

export interface SchoolStats {
  totalSchools: number;
  activeSchools: number;
  schoolsWithProviders: number;
  schoolsWithoutProviders: number;
  averageDistance?: number;
  lastUpdated: Date;
}

export class CachedSchoolService {
  // Get all schools with caching and filtering
  static async getAllSchools(
    filters: SchoolFilters = {},
    options: {
      forceRefresh?: boolean;
      limit?: number;
      orderBy?: { field: string; direction: "asc" | "desc" };
    } = {}
  ): Promise<Location[]> {
    const {
      forceRefresh = false,
      limit: limitCount,
      orderBy: orderByOptions,
    } = options;

    const cacheKey = FirebaseCache.generateQueryKey(
      "schools_filtered",
      filters,
      orderByOptions
        ? `${orderByOptions.field}_${orderByOptions.direction}`
        : "name",
      limitCount
    );

    return FirebaseCache.cacheLocationData(
      cacheKey,
      async () => {
        const q = collection(db, COLLECTIONS.LOCATIONS);
        let queryRef: any = q;

        // Apply provider filter
        if (filters.providerId) {
          queryRef = query(
            queryRef,
            where("assignedProviders", "array-contains", filters.providerId)
          );
        }

        // Apply status filter
        if (filters.status) {
          queryRef = query(
            queryRef,
            where("isActive", "==", filters.status === "active")
          );
        }

        // Apply provider assignment filter
        if (filters.hasProvider !== undefined) {
          if (filters.hasProvider) {
            queryRef = query(queryRef, where("assignedProviders", "!=", []));
          } else {
            queryRef = query(queryRef, where("assignedProviders", "==", []));
          }
        }

        // Apply region filter
        if (filters.region) {
          queryRef = query(queryRef, where("region", "==", filters.region));
        }

        // Apply ordering
        const orderField = orderByOptions?.field || "name";
        const orderDirection = orderByOptions?.direction || "asc";
        queryRef = query(queryRef, orderBy(orderField, orderDirection));

        // Apply limit
        if (limitCount) {
          queryRef = query(queryRef, limit(limitCount));
        }

        const snapshot = await getDocs(queryRef);
        let schools = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...(doc.data() as object),
            } as Location)
        );

        // Apply search filter (client-side)
        if (filters.searchTerm) {
          const searchTerm = filters.searchTerm.toLowerCase();
          schools = schools.filter(
            (school) =>
              (school.name || "").toLowerCase().includes(searchTerm) ||
              (school.address || "").toLowerCase().includes(searchTerm) ||
              (school.region || "").toLowerCase().includes(searchTerm)
          );
        }

        return schools;
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Get schools by provider with caching
  static async getSchoolsByProvider(
    providerId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<Location[]> {
    return getCachedLocationsByProvider(providerId, options);
  }

  // Get school by ID with caching
  static async getSchoolById(
    schoolId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<Location | null> {
    const { forceRefresh = false } = options;

    return FirebaseCache.cacheLocationData(
      `school_${schoolId}`,
      async () => {
        const { getDocument } = await import("@/lib/firebase/firestore");
        return await getDocument<Location>(COLLECTIONS.LOCATIONS, schoolId);
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Search schools with caching
  static async searchSchools(
    searchTerm: string,
    filters: Omit<SchoolFilters, "searchTerm"> = {},
    options: { forceRefresh?: boolean } = {}
  ): Promise<Location[]> {
    if (!searchTerm.trim()) {
      return this.getAllSchools(filters, options);
    }

    const searchKey = `school_search_${searchTerm.toLowerCase()}_${JSON.stringify(
      filters
    )}`;

    return FirebaseCache.cacheSearchResults(
      searchKey,
      async () => {
        // Get all schools matching filters first
        const schools = await this.getAllSchools(filters, {
          forceRefresh: true,
        });

        // Perform client-side search
        const searchTermLower = searchTerm.toLowerCase();
        return schools.filter((school) => {
          const matchesName = (school.name || "")
            .toLowerCase()
            .includes(searchTermLower);
          const matchesAddress = (school.address || "")
            .toLowerCase()
            .includes(searchTermLower);
          const matchesRegion = (school.region || "")
            .toLowerCase()
            .includes(searchTermLower);

          return matchesName || matchesAddress || matchesRegion;
        });
      },
      {
        forceRefresh: options.forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Get school statistics with caching
  static async getSchoolStats(
    options: { forceRefresh?: boolean } = {}
  ): Promise<SchoolStats> {
    const { forceRefresh = false } = options;

    return FirebaseCache.cacheStats(
      "school_stats",
      async () => {
        // Get all schools
        const allSchools = await this.getAllSchools({}, { forceRefresh: true });

        const totalSchools = allSchools.length;
        const activeSchools = allSchools.filter(
          (school) => school.isActive !== false
        ).length;
        const schoolsWithProviders = allSchools.filter(
          (school) =>
            school.assignedProviders && school.assignedProviders.length > 0
        ).length;
        const schoolsWithoutProviders = totalSchools - schoolsWithProviders;

        // Calculate average distance between schools (simplified)
        let averageDistance: number | undefined;
        if (allSchools.length > 1) {
          // This would require implementing distance calculation
          // For now, we'll leave it undefined
        }

        return {
          totalSchools,
          activeSchools,
          schoolsWithProviders,
          schoolsWithoutProviders,
          averageDistance,
          lastUpdated: new Date(),
        };
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Get nearby schools with caching
  static async getNearbySchools(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
    options: { forceRefresh?: boolean; limit?: number } = {}
  ): Promise<Array<Location & { distance: number }>> {
    const { forceRefresh = false, limit: limitCount = 20 } = options;

    const cacheKey = `nearby_schools_${latitude.toFixed(3)}_${longitude.toFixed(
      3
    )}_${radiusKm}_${limitCount}`;

    return FirebaseCache.cacheLocationData(
      cacheKey,
      async () => {
        // Get all schools (ideally you'd use geohash queries for better performance)
        const allSchools = await this.getAllSchools({}, { forceRefresh: true });

        // Calculate distances and filter
        const schoolsWithDistance = allSchools
          .map((school) => {
            if (!school.latitude || !school.longitude) {
              return null;
            }

            // Calculate distance using Haversine formula
            const distance = calculateDistance(
              latitude,
              longitude,
              school.latitude,
              school.longitude
            );

            return {
              ...school,
              distance,
            };
          })
          .filter(
            (school): school is Location & { distance: number } =>
              school !== null && school.distance <= radiusKm
          )
          .sort((a, b) => a.distance - b.distance);

        return limitCount
          ? schoolsWithDistance.slice(0, limitCount)
          : schoolsWithDistance;
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Get schools by region with caching
  static async getSchoolsByRegion(
    region: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<Location[]> {
    return this.getAllSchools({ region }, options);
  }

  // Create school with cache invalidation
  static async createSchool(schoolData: Omit<Location, "id">): Promise<string> {
    const docRef = await addDoc(
      collection(db, COLLECTIONS.LOCATIONS),
      schoolData
    );

    // Invalidate related cache
    await FirebaseCache.invalidateCache([
      "schools_filtered",
      "school_stats",
      "nearby_schools_",
      "location_",
    ]);

    return docRef.id;
  }

  // Update school with cache invalidation
  static async updateSchool(
    schoolId: string,
    updates: Partial<Location>
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.LOCATIONS, schoolId), updates);

    // Invalidate related cache
    await FirebaseCache.invalidateCache([
      `school_${schoolId}`,
      "schools_filtered",
      "school_stats",
      "nearby_schools_",
      "location_",
    ]);
  }

  // Delete school with cache invalidation
  static async deleteSchool(schoolId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.LOCATIONS, schoolId));

    // Invalidate related cache
    await FirebaseCache.invalidateCache([
      `school_${schoolId}`,
      "schools_filtered",
      "school_stats",
      "nearby_schools_",
      "location_",
    ]);
  }

  // Bulk operations with batch cache invalidation
  static async bulkUpdateSchools(
    updates: Array<{ schoolId: string; updates: Partial<Location> }>
  ): Promise<void> {
    // Execute all updates
    await Promise.all(
      updates.map(({ schoolId, updates: schoolUpdates }) =>
        updateDoc(doc(db, COLLECTIONS.LOCATIONS, schoolId), schoolUpdates)
      )
    );

    // Invalidate all school-related cache
    await FirebaseCache.clearByType("locations");
  }

  // Clear school cache
  static async clearSchoolCache(): Promise<void> {
    await FirebaseCache.clearByType("locations");
  }

  // Pre-warm cache with common school queries
  static async preWarmSchoolCache(providerId?: string): Promise<void> {
    try {
      const tasks = [
        this.getAllSchools({}, { limit: 100 }),
        this.getSchoolStats(),
      ];

      if (providerId) {
        tasks.push(this.getSchoolsByProvider(providerId));
      }

      await Promise.all(tasks);
    } catch (error) {
      console.warn("Failed to pre-warm school cache:", error);
    }
  }
}

// Haversine distance calculation
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Export backward compatibility
export { SchoolService } from "./schoolService";
