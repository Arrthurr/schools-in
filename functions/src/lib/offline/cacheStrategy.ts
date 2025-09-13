// Enhanced offline data caching strategy for Schools-In PWA
// Implements intelligent caching with expiration, size limits, and refresh policies

import { openDB, IDBPDatabase } from "idb";

// Cache configuration
export const CACHE_CONFIG = {
  // Cache expiration times (in milliseconds)
  EXPIRATION: {
    SCHOOLS: 24 * 60 * 60 * 1000, // 24 hours
    SESSIONS: 7 * 24 * 60 * 60 * 1000, // 7 days
    USER_DATA: 30 * 24 * 60 * 60 * 1000, // 30 days
    LOCATION_DATA: 60 * 60 * 1000, // 1 hour
  },

  // Cache size limits (number of items)
  SIZE_LIMITS: {
    SCHOOLS: 500,
    SESSIONS: 1000,
    LOCATION_DATA: 100,
  },

  // Cache refresh strategies
  REFRESH_STRATEGIES: {
    BACKGROUND: "BACKGROUND",
    ON_DEMAND: "ON_DEMAND",
    STALE_WHILE_REVALIDATE: "STALE_WHILE_REVALIDATE",
  },
} as const;

// Enhanced cache metadata interface
interface CacheMetadata {
  id: string;
  cachedAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  version: string;
}

// Cache strategy interface
interface CacheStrategy {
  strategy: "BACKGROUND" | "ON_DEMAND" | "STALE_WHILE_REVALIDATE";
  priority: "high" | "medium" | "low";
  backgroundRefresh: boolean;
  staleTime: number;
}

// Enhanced database stores
const CACHE_STORES = {
  SCHOOLS: "schools_cache",
  SESSIONS: "sessions_cache",
  USER_DATA: "user_data_cache",
  LOCATION_DATA: "location_cache",
  CACHE_METADATA: "cache_metadata",
  PENDING_ACTIONS: "pending_actions",
} as const;

let dbInstance: IDBPDatabase | null = null;

// Initialize enhanced caching database
export async function initCacheDB() {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB("schools-in-cache", 2, {
    upgrade(db, oldVersion) {
      // Schools cache store
      if (!db.objectStoreNames.contains(CACHE_STORES.SCHOOLS)) {
        const schoolsStore = db.createObjectStore(CACHE_STORES.SCHOOLS, {
          keyPath: "id",
        });
        schoolsStore.createIndex("name", "name");
        schoolsStore.createIndex("region", "region");
        schoolsStore.createIndex("assignedProviders", "assignedProviders", {
          multiEntry: true,
        });
      }

      // Sessions cache store
      if (!db.objectStoreNames.contains(CACHE_STORES.SESSIONS)) {
        const sessionsStore = db.createObjectStore(CACHE_STORES.SESSIONS, {
          keyPath: "id",
        });
        sessionsStore.createIndex("userId", "userId");
        sessionsStore.createIndex("schoolId", "schoolId");
        sessionsStore.createIndex("startTime", "startTime");
        sessionsStore.createIndex("status", "status");
      }

      // User data cache store
      if (!db.objectStoreNames.contains(CACHE_STORES.USER_DATA)) {
        const userStore = db.createObjectStore(CACHE_STORES.USER_DATA, {
          keyPath: "id",
        });
        userStore.createIndex("role", "role");
        userStore.createIndex("lastActive", "lastActive");
      }

      // Location data cache store
      if (!db.objectStoreNames.contains(CACHE_STORES.LOCATION_DATA)) {
        const locationStore = db.createObjectStore(CACHE_STORES.LOCATION_DATA, {
          keyPath: "id",
        });
        locationStore.createIndex("timestamp", "timestamp");
        locationStore.createIndex("accuracy", "accuracy");
      }

      // Cache metadata store
      if (!db.objectStoreNames.contains(CACHE_STORES.CACHE_METADATA)) {
        const metadataStore = db.createObjectStore(
          CACHE_STORES.CACHE_METADATA,
          {
            keyPath: "id",
          }
        );
        metadataStore.createIndex("expiresAt", "expiresAt");
        metadataStore.createIndex("lastAccessed", "lastAccessed");
        metadataStore.createIndex("accessCount", "accessCount");
      }

      // Pending actions store
      if (!db.objectStoreNames.contains(CACHE_STORES.PENDING_ACTIONS)) {
        const pendingStore = db.createObjectStore(
          CACHE_STORES.PENDING_ACTIONS,
          {
            keyPath: "id",
            autoIncrement: true,
          }
        );
        pendingStore.createIndex("timestamp", "timestamp");
        pendingStore.createIndex("type", "type");
        pendingStore.createIndex("priority", "priority");
      }
    },
  });

  return dbInstance;
}

// Cache data with expiration and metadata
export async function cacheData<T>(
  store: string,
  data: T[],
  strategy: CacheStrategy = {
    strategy: "STALE_WHILE_REVALIDATE",
    priority: "medium",
    backgroundRefresh: true,
    staleTime: CACHE_CONFIG.EXPIRATION.SCHOOLS,
  }
): Promise<void> {
  const db = await initCacheDB();
  const tx = db.transaction([store, CACHE_STORES.CACHE_METADATA], "readwrite");

  const now = Date.now();
  const expiresAt = now + strategy.staleTime;

  // Cache the data
  for (const item of data) {
    await tx.objectStore(store).put({
      ...item,
      _cached: true,
      _cachedAt: now,
      _expiresAt: expiresAt,
    });
  }

  // Update cache metadata
  const metadata: CacheMetadata = {
    id: store,
    cachedAt: now,
    expiresAt,
    accessCount: 0,
    lastAccessed: now,
    size: data.length,
    version: "1.0",
  };

  await tx.objectStore(CACHE_STORES.CACHE_METADATA).put(metadata);
  await tx.done;

  // Check and enforce cache size limits
  await enforceCacheSizeLimit(store);
}

// Get cached data with expiration check
export async function getCachedData<T>(
  store: string,
  filter?: (item: T) => boolean
): Promise<{ data: T[]; isStale: boolean; needsRefresh: boolean }> {
  const db = await initCacheDB();

  // Update access metadata
  await updateAccessMetadata(store);

  // Get all cached data
  const cachedItems = await db.getAll(store);

  // Check if cache is expired
  const metadata = await db.get(CACHE_STORES.CACHE_METADATA, store);
  const now = Date.now();

  const isExpired = metadata ? now > metadata.expiresAt : true;
  const isStale = metadata
    ? now > metadata.cachedAt + (metadata.expiresAt - metadata.cachedAt) * 0.8
    : true;

  // Filter data if needed
  let data = cachedItems;
  if (filter) {
    data = data.filter(filter);
  }

  return {
    data: data as T[],
    isStale,
    needsRefresh: isExpired,
  };
}

// Update access metadata for analytics
async function updateAccessMetadata(store: string): Promise<void> {
  const db = await initCacheDB();
  const metadata = await db.get(CACHE_STORES.CACHE_METADATA, store);

  if (metadata) {
    metadata.accessCount = (metadata.accessCount || 0) + 1;
    metadata.lastAccessed = Date.now();
    await db.put(CACHE_STORES.CACHE_METADATA, metadata);
  }
}

// Enforce cache size limits using LRU strategy
async function enforceCacheSizeLimit(store: string): Promise<void> {
  const storeKey = store as keyof typeof CACHE_CONFIG.SIZE_LIMITS;
  const limit = CACHE_CONFIG.SIZE_LIMITS[storeKey];
  if (!limit) return;

  const db = await initCacheDB();
  const allItems = await db.getAll(store);

  if (allItems.length <= limit) return;

  // Sort by access time (LRU)
  const sortedItems = allItems.sort((a: any, b: any) => {
    const aAccessed = a._lastAccessed || a._cachedAt || 0;
    const bAccessed = b._lastAccessed || b._cachedAt || 0;
    return aAccessed - bAccessed;
  });

  // Remove oldest items
  const itemsToRemove = sortedItems.slice(0, allItems.length - limit);
  const tx = db.transaction(store, "readwrite");

  for (const item of itemsToRemove) {
    await tx.store.delete(item.id);
  }

  await tx.done;
}

// Clear expired cache entries
export async function clearExpiredCache(): Promise<void> {
  const db = await initCacheDB();
  const now = Date.now();

  for (const store of Object.values(CACHE_STORES)) {
    if (store === CACHE_STORES.CACHE_METADATA) continue;

    const allItems = await db.getAll(store);
    const tx = db.transaction(store, "readwrite");

    for (const item of allItems) {
      if ((item as any)._expiresAt && now > (item as any)._expiresAt) {
        await tx.store.delete((item as any).id);
      }
    }

    await tx.done;
  }
}

// Get cache statistics
export async function getCacheStats(): Promise<{
  totalSize: number;
  storeStats: Record<
    string,
    {
      itemCount: number;
      lastAccessed: number;
      accessCount: number;
      isStale: boolean;
    }
  >;
}> {
  const db = await initCacheDB();
  const now = Date.now();
  let totalSize = 0;
  const storeStats: Record<string, any> = {};

  for (const store of Object.values(CACHE_STORES)) {
    if (store === CACHE_STORES.CACHE_METADATA) continue;

    const items = await db.getAll(store);
    const metadata = await db.get(CACHE_STORES.CACHE_METADATA, store);

    totalSize += items.length;

    storeStats[store] = {
      itemCount: items.length,
      lastAccessed: metadata?.lastAccessed || 0,
      accessCount: metadata?.accessCount || 0,
      isStale: metadata ? now > metadata.expiresAt : true,
    };
  }

  return { totalSize, storeStats };
}

// Preload critical data for offline use
export async function preloadCriticalData(userId: string): Promise<void> {
  try {
    // This would typically fetch from API in a real implementation
    // For now, we'll simulate with mock data

    console.log("Preloading critical data for offline use...");

    // Simulate fetching and caching schools data
    const mockSchools = [
      {
        id: "school-1",
        name: "Central High School",
        address: "123 Main St",
        coordinates: { lat: 40.7128, lng: -74.006 },
        region: "downtown",
        assignedProviders: [userId],
      },
      {
        id: "school-2",
        name: "Westside Elementary",
        address: "456 Oak Ave",
        coordinates: { lat: 40.7589, lng: -73.9851 },
        region: "westside",
        assignedProviders: [userId],
      },
    ];

    await cacheData(CACHE_STORES.SCHOOLS, mockSchools, {
      strategy: "STALE_WHILE_REVALIDATE",
      priority: "high",
      backgroundRefresh: true,
      staleTime: CACHE_CONFIG.EXPIRATION.SCHOOLS,
    });

    // Cache user's recent sessions
    const mockSessions = [
      {
        id: "session-1",
        userId,
        schoolId: "school-1",
        startTime: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        status: "active",
      },
    ];

    await cacheData(CACHE_STORES.SESSIONS, mockSessions, {
      strategy: "STALE_WHILE_REVALIDATE",
      priority: "medium",
      backgroundRefresh: true,
      staleTime: CACHE_CONFIG.EXPIRATION.SESSIONS,
    });

    console.log("Critical data preloaded successfully");
  } catch (error) {
    console.error("Failed to preload critical data:", error);
  }
}

// Smart cache refresh based on usage patterns
export async function smartCacheRefresh(): Promise<void> {
  const stats = await getCacheStats();

  for (const [store, stat] of Object.entries(stats.storeStats)) {
    // Prioritize frequently accessed and stale caches
    if (stat.accessCount > 10 && stat.isStale) {
      console.log(`Refreshing frequently accessed stale cache: ${store}`);
      // In a real implementation, this would trigger a background fetch
    }
  }
}

// Export the enhanced cache stores for use in other modules
export { CACHE_STORES };
