// Cache manager integrating enhanced caching with offline functionality
// Bridges cache strategy with service manager and React components

import {
  initCacheDB,
  cacheData,
  getCachedData,
  clearExpiredCache,
  getCacheStats,
  preloadCriticalData,
  smartCacheRefresh,
  CACHE_STORES,
  CACHE_CONFIG,
} from "./cacheStrategy";

export interface CacheManagerConfig {
  enableBackgroundSync: boolean;
  maxCacheAge: number;
  compressionEnabled: boolean;
  debugMode: boolean;
}

class CacheManager {
  private config: CacheManagerConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheManagerConfig> = {}) {
    this.config = {
      enableBackgroundSync: true,
      maxCacheAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      compressionEnabled: false,
      debugMode: false,
      ...config,
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await initCacheDB();

      if (this.config.enableBackgroundSync) {
        this.startBackgroundSync();
      }

      this.startCleanupProcess();

      if (this.config.debugMode) {
        console.log("CacheManager initialized with config:", this.config);
      }
    } catch (error) {
      console.error("Failed to initialize CacheManager:", error);
    }
  }

  // Cache schools data with intelligent strategy
  async cacheSchools(schools: any[], userId?: string): Promise<void> {
    try {
      // Filter schools by user if provided
      const userSchools = userId
        ? schools.filter((school) => school.assignedProviders?.includes(userId))
        : schools;

      await cacheData(CACHE_STORES.SCHOOLS, userSchools, {
        strategy: "STALE_WHILE_REVALIDATE",
        priority: "high",
        backgroundRefresh: true,
        staleTime: CACHE_CONFIG.EXPIRATION.SCHOOLS,
      });

      if (this.config.debugMode) {
        console.log(`Cached ${userSchools.length} schools for user ${userId}`);
      }
    } catch (error) {
      console.error("Failed to cache schools:", error);
    }
  }

  // Get cached schools with staleness check
  async getCachedSchools(userId?: string): Promise<{
    schools: any[];
    isStale: boolean;
    needsRefresh: boolean;
  }> {
    try {
      const result = await getCachedData(
        CACHE_STORES.SCHOOLS,
        userId
          ? (school: any) => school.assignedProviders?.includes(userId)
          : undefined
      );

      return {
        schools: result.data,
        isStale: result.isStale,
        needsRefresh: result.needsRefresh,
      };
    } catch (error) {
      console.error("Failed to get cached schools:", error);
      return { schools: [], isStale: true, needsRefresh: true };
    }
  }

  // Cache session data
  async cacheSessions(sessions: any[], userId?: string): Promise<void> {
    try {
      const userSessions = userId
        ? sessions.filter((session) => session.userId === userId)
        : sessions;

      await cacheData(CACHE_STORES.SESSIONS, userSessions, {
        strategy: "STALE_WHILE_REVALIDATE",
        priority: "medium",
        backgroundRefresh: true,
        staleTime: CACHE_CONFIG.EXPIRATION.SESSIONS,
      });

      if (this.config.debugMode) {
        console.log(
          `Cached ${userSessions.length} sessions for user ${userId}`
        );
      }
    } catch (error) {
      console.error("Failed to cache sessions:", error);
    }
  }

  // Get cached sessions
  async getCachedSessions(userId?: string): Promise<{
    sessions: any[];
    isStale: boolean;
    needsRefresh: boolean;
  }> {
    try {
      const result = await getCachedData(
        CACHE_STORES.SESSIONS,
        userId ? (session: any) => session.userId === userId : undefined
      );

      return {
        sessions: result.data,
        isStale: result.isStale,
        needsRefresh: result.needsRefresh,
      };
    } catch (error) {
      console.error("Failed to get cached sessions:", error);
      return { sessions: [], isStale: true, needsRefresh: true };
    }
  }

  // Cache user location data
  async cacheLocationData(locationData: any[]): Promise<void> {
    try {
      await cacheData(CACHE_STORES.LOCATION_DATA, locationData, {
        strategy: "ON_DEMAND",
        priority: "low",
        backgroundRefresh: false,
        staleTime: CACHE_CONFIG.EXPIRATION.LOCATION_DATA,
      });

      if (this.config.debugMode) {
        console.log(`Cached ${locationData.length} location entries`);
      }
    } catch (error) {
      console.error("Failed to cache location data:", error);
    }
  }

  // Get recent location data
  async getRecentLocationData(limit: number = 10): Promise<any[]> {
    try {
      const result = await getCachedData(CACHE_STORES.LOCATION_DATA);
      return result.data
        .sort((a: any, b: any) => b.timestamp - a.timestamp)
        .slice(0, limit);
    } catch (error) {
      console.error("Failed to get location data:", error);
      return [];
    }
  }

  // Cache user data with long expiration
  async cacheUserData(userData: any): Promise<void> {
    try {
      await cacheData(CACHE_STORES.USER_DATA, [userData], {
        strategy: "BACKGROUND",
        priority: "high",
        backgroundRefresh: true,
        staleTime: CACHE_CONFIG.EXPIRATION.USER_DATA,
      });

      if (this.config.debugMode) {
        console.log("Cached user data:", userData.id);
      }
    } catch (error) {
      console.error("Failed to cache user data:", error);
    }
  }

  // Get cached user data
  async getCachedUserData(): Promise<any | null> {
    try {
      const result = await getCachedData(CACHE_STORES.USER_DATA);
      return result.data[0] || null;
    } catch (error) {
      console.error("Failed to get cached user data:", error);
      return null;
    }
  }

  // Preload data for offline use
  async preloadOfflineData(userId: string): Promise<void> {
    try {
      await preloadCriticalData(userId);

      if (this.config.debugMode) {
        console.log("Preloaded offline data for user:", userId);
      }
    } catch (error) {
      console.error("Failed to preload offline data:", error);
    }
  }

  // Get comprehensive cache statistics
  async getCacheStatistics(): Promise<{
    overview: any;
    stores: any;
    recommendations: string[];
  }> {
    try {
      const stats = await getCacheStats();
      const recommendations: string[] = [];

      // Generate recommendations based on usage patterns
      Object.entries(stats.storeStats).forEach(([store, stat]) => {
        if (stat.isStale && stat.accessCount > 5) {
          recommendations.push(
            `Consider refreshing ${store} cache (frequently accessed but stale)`
          );
        }
        if (stat.accessCount === 0) {
          recommendations.push(`Consider removing ${store} cache (unused)`);
        }
      });

      return {
        overview: {
          totalItems: stats.totalSize,
          totalStores: Object.keys(stats.storeStats).length,
          lastCleanup: this.lastCleanup,
        },
        stores: stats.storeStats,
        recommendations,
      };
    } catch (error) {
      console.error("Failed to get cache statistics:", error);
      return {
        overview: { totalItems: 0, totalStores: 0, lastCleanup: null },
        stores: {},
        recommendations: ["Failed to load cache statistics"],
      };
    }
  }

  // Manual cache refresh
  async refreshCache(store?: string): Promise<void> {
    try {
      if (store) {
        console.log(`Manually refreshing cache for store: ${store}`);
        // In a real implementation, this would trigger API calls to refresh specific store
      } else {
        await smartCacheRefresh();
        console.log("Performed smart cache refresh");
      }
    } catch (error) {
      console.error("Failed to refresh cache:", error);
    }
  }

  // Clear all caches
  async clearAllCaches(): Promise<void> {
    try {
      const db = await initCacheDB();

      for (const store of Object.values(CACHE_STORES)) {
        await db.clear(store);
      }

      if (this.config.debugMode) {
        console.log("Cleared all caches");
      }
    } catch (error) {
      console.error("Failed to clear caches:", error);
    }
  }

  // Background sync process
  private startBackgroundSync(): void {
    this.syncInterval = setInterval(async () => {
      try {
        await smartCacheRefresh();
      } catch (error) {
        console.error("Background sync failed:", error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private lastCleanup: number | null = null;

  // Cleanup process for expired data
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await clearExpiredCache();
        this.lastCleanup = Date.now();

        if (this.config.debugMode) {
          console.log("Performed cache cleanup");
        }
      } catch (error) {
        console.error("Cache cleanup failed:", error);
      }
    }, 60 * 60 * 1000); // Every hour
  }

  // Cleanup on destruction
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
export const cacheManager = new CacheManager({
  enableBackgroundSync: true,
  debugMode: process.env.NODE_ENV === "development",
});

export default CacheManager;
