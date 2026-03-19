/**
 * Cached Firestore service - wraps original Firestore operations with intelligent caching
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  QuerySnapshot,
  Unsubscribe,
  DocumentData,
  WhereFilterOp,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { User, Location, Session } from "./types";
import { FirebaseCache, CacheTracker } from "../cache/FirebaseCache";
import { COLLECTIONS } from "./firestore";
import { normalizeLocationData } from "@/lib/services/locationNormalizer";
import { appLogger } from "@/lib/logging/appLogger";
// Re-export types and collections
export { COLLECTIONS };
export type { User, Location, Session };

/** Maps query docs to client models; locations are normalized (invalid docs omitted). */
function mapQueryDocsForCollection<T>(
  collectionName: string,
  docs: Array<{ id: string; data: () => unknown }>
): T[] {
  if (collectionName !== COLLECTIONS.LOCATIONS) {
    return docs.map(
      (d) => ({ id: d.id, ...(d.data() as object) }) as T
    );
  }
  const out: Location[] = [];
  for (const docSnapshot of docs) {
    const data = docSnapshot.data() as Record<string, unknown>;
    const loc = normalizeLocationData(docSnapshot.id, data);
    if (loc) {
      out.push(loc);
    } else {
      appLogger.warn("Invalid location skipped (collection query)", {
        locationId: docSnapshot.id,
        name: (data.name as string) ?? "",
      });
    }
  }
  return out as T[];
}

// Cached document operations
export const getCachedDocument = async <T>(
  collectionName: string,
  docId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<T | null> => {
  const cacheKey = `doc_${collectionName}_${docId}`;

  return FirebaseCache.cacheUserData(
    cacheKey,
    async () => {
      const docSnap = await getDoc(doc(db, collectionName, docId));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    },
    {
      forceRefresh: options.forceRefresh,
      onCacheHit: () => CacheTracker.recordHit(),
      onCacheMiss: () => CacheTracker.recordMiss(),
      tags: [
        collectionName,
        `doc:${collectionName}:${docId}`,
        `collection:${collectionName}`,
      ],
    }
  );
};

// Cached collection queries
export const getCachedCollection = async <T>(
  collectionName: string,
  options: {
    forceRefresh?: boolean;
    filters?: Array<{ field: string; operator: any; value: any }>;
    orderByField?: string;
    orderDirection?: "asc" | "desc";
    limitCount?: number;
  } = {}
): Promise<T[]> => {
  const {
    forceRefresh = false,
    filters = [],
    orderByField,
    orderDirection = "asc",
    limitCount,
  } = options;

  const cacheKey = FirebaseCache.generateQueryKey(
    collectionName,
    filters.reduce(
      (acc, f) => ({ ...acc, [`${f.field}_${f.operator}`]: f.value }),
      {}
    ),
    orderByField ? `${orderByField}_${orderDirection}` : undefined,
    limitCount
  );

  return FirebaseCache.cacheLocationData(
    cacheKey,
    async () => {
      const q = collection(db, collectionName);
      let queryRef: any = q;

      // Apply filters
      filters.forEach((filter) => {
        queryRef = query(
          queryRef,
          where(filter.field, filter.operator, filter.value)
        );
      });

      // Apply ordering
      if (orderByField) {
        queryRef = query(queryRef, orderBy(orderByField, orderDirection));
      }

      // Apply limit
      if (limitCount) {
        queryRef = query(queryRef, limit(limitCount));
      }

      const querySnapshot = await getDocs(queryRef);
      return mapQueryDocsForCollection<T>(collectionName, querySnapshot.docs);
    },
    {
      forceRefresh,
      onCacheHit: () => CacheTracker.recordHit(),
      onCacheMiss: () => CacheTracker.recordMiss(),
      tags: [
        collectionName,
        `collection:${collectionName}`,
        ...filters
          .map((filter) => `${collectionName}:${filter.field}:${filter.value}`)
          .filter(Boolean),
      ],
    }
  );
};

// Cached user-specific queries
export const getCachedUserSessions = async (
  userId: string,
  options: {
    forceRefresh?: boolean;
    limit?: number;
    status?: string;
  } = {}
): Promise<Session[]> => {
  const { forceRefresh = false, limit: limitCount, status } = options;

  const filters = [{ field: "userId", operator: "==", value: userId }];
  if (status) {
    filters.push({ field: "status", operator: "==", value: status });
  }

  const cacheKey = `user_sessions_${userId}_${status || "all"}_${
    limitCount || "unlimited"
  }`;

  return FirebaseCache.cacheSessionData(
    cacheKey,
    async () => {
      const q = collection(db, COLLECTIONS.SESSIONS);
      let queryRef: any = q;

      filters.forEach((filter) => {
        queryRef = query(
          queryRef,
          where(filter.field, filter.operator as WhereFilterOp, filter.value)
        );
      });

      queryRef = query(queryRef, orderBy("startTime", "desc"));

      if (limitCount) {
        queryRef = query(queryRef, limit(limitCount));
      }

      const querySnapshot = await getDocs(queryRef);
      return querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...(doc.data() as object),
          } as Session)
      );
    },
    {
      forceRefresh,
      onCacheHit: () => CacheTracker.recordHit(),
      onCacheMiss: () => CacheTracker.recordMiss(),
      tags: [
        "sessions",
        `sessions:user:${userId}`,
        status ? `sessions:status:${status}` : "sessions:all",
      ],
    }
  );
};

// Cached locations by provider
export const getCachedLocationsByProvider = async (
  providerId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<Location[]> => {
  const cacheKey = `provider_locations_${providerId}_active`;

  return FirebaseCache.cacheLocationData(
    cacheKey,
    async () => {
      const q = query(
        collection(db, COLLECTIONS.LOCATIONS),
        where("assignedProviders", "array-contains", providerId),
        where("active", "==", true),
        orderBy("name")
      );

      const snap = await getDocs(q);
      const normalized = snap.docs.reduce<Location[]>((acc, docSnapshot) => {
        const data = docSnapshot.data();
        const loc = normalizeLocationData(docSnapshot.id, data);
        if (loc) {
          acc.push(loc);
        } else {
          const hasGeo = Boolean(
            data?.geo ?? data?.gpsCoordinates ?? data?.coordinates
          );
          appLogger.warn("Invalid location skipped (missing coordinates)", {
            locationId: docSnapshot.id,
            name: data?.name ?? "",
            hasGeo,
          });
        }
        return acc;
      }, []);

      // Legacy fallback to user.assignedLocations if nothing is found (defensive)
      if (normalized.length === 0) {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, providerId));
        const legacyAssigned = (userDoc.data() as any)?.assignedLocations;
        if (Array.isArray(legacyAssigned) && legacyAssigned.length > 0) {
          const results: Location[] = [];
          const chunkSize = 10;
          for (let i = 0; i < legacyAssigned.length; i += chunkSize) {
            const chunk = legacyAssigned.slice(i, i + chunkSize);
            const chunkQuery = query(
              collection(db, COLLECTIONS.LOCATIONS),
              where("__name__", "in", chunk)
            );
          const chunkSnap = await getDocs(chunkQuery);
          chunkSnap.docs.forEach((docSnapshot) => {
            const loc = normalizeLocationData(
              docSnapshot.id,
              docSnapshot.data()
            );
            if (loc) {
              results.push(loc);
            } else {
              const data = docSnapshot.data();
              const hasGeo = Boolean(
                data?.geo ?? data?.gpsCoordinates ?? data?.coordinates
              );
              appLogger.warn("Invalid legacy-assigned location skipped", {
                locationId: docSnapshot.id,
                name: data?.name ?? "",
                hasGeo,
              });
            }
          });
          }
          return results;
        }
      }

      return normalized;
    },
    {
      forceRefresh: options.forceRefresh,
      onCacheHit: () => CacheTracker.recordHit(),
      onCacheMiss: () => CacheTracker.recordMiss(),
      tags: ["locations", `locations:provider:${providerId}`],
    }
  );
};

// Cached active sessions
export const getCachedActiveSessions = async (
  options: { forceRefresh?: boolean } = {}
): Promise<Session[]> => {
  const cacheKey = "active_sessions";

  return FirebaseCache.cacheSessionData(
    cacheKey,
    async () => {
      const q = query(
        collection(db, COLLECTIONS.SESSIONS),
        where("status", "==", "active"),
        orderBy("startTime", "desc")
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...(doc.data() as object),
          } as Session)
      );
    },
    {
      forceRefresh: options.forceRefresh,
      onCacheHit: () => CacheTracker.recordHit(),
      onCacheMiss: () => CacheTracker.recordMiss(),
      tags: ["sessions", "sessions:active"],
    }
  );
};

// Cached search functionality
export const searchCachedUsers = async (
  searchTerm: string,
  options: {
    role?: "provider" | "admin";
    forceRefresh?: boolean;
  } = {}
): Promise<User[]> => {
  const { role, forceRefresh = false } = options;
  const searchKey = `${searchTerm.toLowerCase()}_${role || "all"}`;

  return FirebaseCache.cacheSearchResults(
    searchKey,
    async () => {
      // Note: Firestore doesn't support full-text search natively
      // This is a simplified implementation - consider using Algolia or similar for production
      const q = collection(db, COLLECTIONS.USERS);
      let queryRef: any = q;

      if (role) {
        queryRef = query(queryRef, where("role", "==", role));
      }

      const querySnapshot = await getDocs(queryRef);
      const allUsers = querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...(doc.data() as object),
          } as unknown as User)
      );

      // Client-side filtering (not ideal for large datasets)
      const searchTermLower = searchTerm.toLowerCase();
      return allUsers.filter(
        (user) =>
          (user.displayName || "").toLowerCase().includes(searchTermLower) ||
          (user.email || "").toLowerCase().includes(searchTermLower)
      );
    },
    {
      forceRefresh,
      onCacheHit: () => CacheTracker.recordHit(),
      onCacheMiss: () => CacheTracker.recordMiss(),
      tags: ["users", role ? `users:role:${role}` : "users:all"],
    }
  );
};

// Write operations (these invalidate related cache entries)
export const createCachedDocument = async <T extends object>(
  collectionName: string,
  data: T
): Promise<string> => {
  const docRef = await addDoc(collection(db, collectionName), data);

  // Invalidate related cache entries
  await FirebaseCache.invalidateTags([
    `collection:${collectionName}`,
    collectionName,
  ]);

  return docRef.id;
};

export const updateCachedDocument = async (
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> => {
  await updateDoc(doc(db, collectionName, docId), data);

  // Invalidate specific document and related cache entries
  await FirebaseCache.invalidateTags([
    `doc:${collectionName}:${docId}`,
    `collection:${collectionName}`,
    collectionName,
  ]);
};

export const deleteCachedDocument = async (
  collectionName: string,
  docId: string
): Promise<void> => {
  await deleteDoc(doc(db, collectionName, docId));

  // Invalidate specific document and related cache entries
  await FirebaseCache.invalidateTags([
    `doc:${collectionName}:${docId}`,
    `collection:${collectionName}`,
    collectionName,
  ]);
};

// Real-time subscriptions with caching
export const subscribeToCachedDocument = <T>(
  collectionName: string,
  docId: string,
  callback: (data: T | null) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  // First, try to get cached data immediately
  getCachedDocument<T>(collectionName, docId).then((cachedData) => {
    if (cachedData) {
      callback(cachedData);
    }
  });

  // Then set up real-time listener
  return onSnapshot(
    doc(db, collectionName, docId),
    (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as T;

        // Update cache with real-time data
        const cacheKey = `doc_${collectionName}_${docId}`;
        FirebaseCache.cacheUserData(cacheKey, () => Promise.resolve(data));

        callback(data);
      } else {
        callback(null);
      }
    },
    onError
  );
};

export const subscribeToCachedCollection = <T>(
  collectionName: string,
  callback: (data: T[]) => void,
  options: {
    filters?: Array<{ field: string; operator: any; value: any }>;
    orderByField?: string;
    orderDirection?: "asc" | "desc";
    limitCount?: number;
  } = {},
  onError?: (error: Error) => void
): Unsubscribe => {
  const {
    filters = [],
    orderByField,
    orderDirection = "asc",
    limitCount,
  } = options;

  // First, try to get cached data immediately
  getCachedCollection<T>(collectionName, options).then((cachedData) => {
    if (cachedData.length > 0) {
      callback(cachedData);
    }
  });

  // Set up real-time listener
  const q = collection(db, collectionName);
  let queryRef: any = q;

  filters.forEach((filter) => {
    queryRef = query(
      queryRef,
      where(filter.field, filter.operator, filter.value)
    );
  });

  if (orderByField) {
    queryRef = query(queryRef, orderBy(orderByField, orderDirection));
  }

  if (limitCount) {
    queryRef = query(queryRef, limit(limitCount));
  }

  return onSnapshot(
    queryRef,
    (querySnapshot: QuerySnapshot) => {
      const data = mapQueryDocsForCollection<T>(
        collectionName,
        querySnapshot.docs
      );

      // Update cache with real-time data
      const cacheKey = FirebaseCache.generateQueryKey(
        collectionName,
        filters.reduce(
          (acc, f) => ({ ...acc, [`${f.field}_${f.operator}`]: f.value }),
          {}
        ),
        orderByField ? `${orderByField}_${orderDirection}` : undefined,
        limitCount
      );

      FirebaseCache.cacheLocationData(cacheKey, () => Promise.resolve(data), {
        tags: [
          collectionName,
          `collection:${collectionName}`,
          ...filters
            .map((filter) => `${collectionName}:${filter.field}:${filter.value}`)
            .filter(Boolean),
        ],
      });

      callback(data);
    },
    onError
  );
};

// Batch operations with cache invalidation
export const batchUpdateWithCache = async (
  operations: Array<{
    type: "create" | "update" | "delete";
    collection: string;
    docId?: string;
    data?: any;
  }>
): Promise<void> => {
  // Execute batch operations (simplified - would use writeBatch in production)
  for (const op of operations) {
    switch (op.type) {
      case "create":
        await createCachedDocument(op.collection, op.data);
        break;
      case "update":
        if (op.docId) {
          await updateCachedDocument(op.collection, op.docId, op.data);
        }
        break;
      case "delete":
        if (op.docId) {
          await deleteCachedDocument(op.collection, op.docId);
        }
        break;
    }
  }

  // Invalidate all affected collections
  const collections = [...new Set(operations.map((op) => op.collection))];
  await Promise.all(
    collections.map((collection) =>
      FirebaseCache.invalidateTags([
        `collection:${collection}`,
        collection,
      ])
    )
  );
};

// Cache management utilities
export const getCacheStats = async () => {
  const trackerStats = CacheTracker.getStats();
  const cacheStats = await FirebaseCache.getCacheStats();

  return {
    ...trackerStats,
    ...cacheStats,
  };
};

export const clearFirestoreCache = async (
  type?: "users" | "locations" | "sessions" | "assignments"
) => {
  if (type) {
    await FirebaseCache.clearByType(type);
  } else {
    await FirebaseCache.clearAll();
  }
  CacheTracker.reset();
};

// Pre-warm cache with commonly accessed data
export const preWarmCache = async (userId?: string): Promise<void> => {
  try {
    // Pre-load user data if provided
    if (userId) {
      await getCachedDocument<User>(COLLECTIONS.USERS, userId);
      await getCachedLocationsByProvider(userId);
      await getCachedUserSessions(userId, { limit: 10 });
    }

    // Pre-load common data
    await getCachedCollection<Location>(COLLECTIONS.LOCATIONS, {
      limitCount: 50,
    });
    await getCachedActiveSessions();
  } catch (error) {
    console.warn("Failed to pre-warm cache:", error);
  }
};
