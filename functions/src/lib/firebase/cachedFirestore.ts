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
  DocumentSnapshot,
  Unsubscribe,
  DocumentData,
  WhereFilterOp,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { User, Location, Session } from "./types";
import { FirebaseCache, CacheTracker } from "../cache/FirebaseCache";
import { COLLECTIONS } from "./firestore";

// Re-export types and collections
export { COLLECTIONS };
export type { User, Location, Session };

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
      return querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...(doc.data() as object),
          } as T)
      );
    },
    {
      forceRefresh,
      onCacheHit: () => CacheTracker.recordHit(),
      onCacheMiss: () => CacheTracker.recordMiss(),
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
    }
  );
};

// Cached locations by provider
export const getCachedLocationsByProvider = async (
  providerId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<Location[]> => {
  const cacheKey = `provider_locations_${providerId}`;

  return FirebaseCache.cacheLocationData(
    cacheKey,
    async () => {
      const q = query(
        collection(db, COLLECTIONS.LOCATIONS),
        where("assignedProviders", "array-contains", providerId)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...(doc.data() as object),
          } as Location)
      );
    },
    {
      forceRefresh: options.forceRefresh,
      onCacheHit: () => CacheTracker.recordHit(),
      onCacheMiss: () => CacheTracker.recordMiss(),
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
  await FirebaseCache.invalidateCache([
    `collection_${collectionName}`,
    `${collectionName}_`,
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
  await FirebaseCache.invalidateCache([
    `doc_${collectionName}_${docId}`,
    `collection_${collectionName}`,
    `${collectionName}_`,
  ]);
};

export const deleteCachedDocument = async (
  collectionName: string,
  docId: string
): Promise<void> => {
  await deleteDoc(doc(db, collectionName, docId));

  // Invalidate specific document and related cache entries
  await FirebaseCache.invalidateCache([
    `doc_${collectionName}_${docId}`,
    `collection_${collectionName}`,
    `${collectionName}_`,
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
      const data = querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...(doc.data() as object),
          } as T)
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

      FirebaseCache.cacheLocationData(cacheKey, () => Promise.resolve(data));

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
      FirebaseCache.invalidateCache([
        `collection_${collection}`,
        `${collection}_`,
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
