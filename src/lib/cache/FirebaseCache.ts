"use client";

/**
 * Firebase-specific caching strategies and configurations
 */

import { cacheManager, CacheType, CacheConfig } from "./CacheManager";

// Cache TTL configurations (in milliseconds)
export const CACHE_TTL = {
  // Short-term cache (5 minutes)
  SHORT: 5 * 60 * 1000,
  // Medium-term cache (30 minutes)
  MEDIUM: 30 * 60 * 1000,
  // Long-term cache (2 hours)
  LONG: 2 * 60 * 60 * 1000,
  // Very long cache (1 day)
  VERY_LONG: 24 * 60 * 60 * 1000,
  // Session-based cache (until page refresh)
  SESSION: 0, // Never expires in session
} as const;

// Cache configurations for different data types
export const FIREBASE_CACHE_CONFIGS = {
  // User data - cache for medium term, multi-layer
  USER: {
    memory: {
      type: CacheType.MEMORY,
      ttl: CACHE_TTL.MEDIUM,
      prefix: "user_",
    },
    session: {
      type: CacheType.SESSION,
      ttl: CACHE_TTL.LONG,
      prefix: "user_",
    },
  },

  // Authentication state - memory + session
  AUTH: {
    memory: {
      type: CacheType.MEMORY,
      ttl: CACHE_TTL.MEDIUM,
      prefix: "auth_",
    },
    session: {
      type: CacheType.SESSION,
      ttl: CACHE_TTL.SESSION,
      prefix: "auth_",
    },
  },

  // School/Location data - long term cache
  LOCATIONS: {
    memory: {
      type: CacheType.MEMORY,
      ttl: CACHE_TTL.LONG,
      prefix: "location_",
    },
    local: {
      type: CacheType.LOCAL,
      ttl: CACHE_TTL.VERY_LONG,
      prefix: "location_",
    },
    indexeddb: {
      type: CacheType.INDEXED_DB,
      ttl: CACHE_TTL.VERY_LONG,
      prefix: "location_",
    },
  },

  // Session data - short term cache
  SESSIONS: {
    memory: {
      type: CacheType.MEMORY,
      ttl: CACHE_TTL.SHORT,
      prefix: "session_",
    },
    session: {
      type: CacheType.SESSION,
      ttl: CACHE_TTL.MEDIUM,
      prefix: "session_",
    },
  },

  // Assignments - medium term cache
  ASSIGNMENTS: {
    memory: {
      type: CacheType.MEMORY,
      ttl: CACHE_TTL.MEDIUM,
      prefix: "assignment_",
    },
    session: {
      type: CacheType.SESSION,
      ttl: CACHE_TTL.LONG,
      prefix: "assignment_",
    },
  },

  // Search results - short term cache
  SEARCH: {
    memory: {
      type: CacheType.MEMORY,
      ttl: CACHE_TTL.SHORT,
      prefix: "search_",
    },
  },

  // Statistics and aggregated data - medium term cache
  STATS: {
    memory: {
      type: CacheType.MEMORY,
      ttl: CACHE_TTL.MEDIUM,
      prefix: "stats_",
    },
    local: {
      type: CacheType.LOCAL,
      ttl: CACHE_TTL.LONG,
      prefix: "stats_",
    },
  },
} as const;

export interface CacheOptions {
  forceRefresh?: boolean;
  cacheKey?: string;
  ttl?: number;
  onCacheHit?: () => void;
  onCacheMiss?: () => void;
  tags?: string[];
}

export class FirebaseCache {
  private static tagIndex: Map<string, Set<string>> = new Map();

  private static allConfigs(): CacheConfig[] {
    return Object.values(FIREBASE_CACHE_CONFIGS).flatMap((config) =>
      Object.values(config)
    );
  }

  private static registerTags(cacheKey: string, tags?: string[]): void {
    if (!tags || tags.length === 0) return;

    tags.forEach((tag) => {
      const existing = this.tagIndex.get(tag) ?? new Set<string>();
      existing.add(cacheKey);
      this.tagIndex.set(tag, existing);
    });
  }

  private static pruneDeletedKeysFromTagIndex(deletedKeys: Set<string>): void {
    if (!deletedKeys || deletedKeys.size === 0) return;

    for (const [tag, keys] of this.tagIndex.entries()) {
      let changed = false;
      for (const key of deletedKeys) {
        if (keys.delete(key)) changed = true;
      }
      if (changed && keys.size === 0) {
        this.tagIndex.delete(tag);
      }
    }
  }

  private static async deleteKeys(keys: Set<string>): Promise<void> {
    const allConfigs = this.allConfigs();
    await Promise.all(
      Array.from(keys).map((key) =>
        Promise.all(
          allConfigs.map((config) =>
            cacheManager.delete(key, config).catch(() => {
              // Ignore errors for non-existent keys
            })
          )
        )
      )
    );
  }

  static async invalidateTags(tags: string[]): Promise<void> {
    if (!tags || tags.length === 0) return;

    const keysToDelete = new Set<string>();

    tags.forEach((tag) => {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.forEach((key) => keysToDelete.add(key));
        this.tagIndex.delete(tag);
      }
    });

    if (keysToDelete.size > 0) {
      await this.deleteKeys(keysToDelete);
      // Clean up stale references for other tags that might still point at deleted keys
      this.pruneDeletedKeysFromTagIndex(keysToDelete);
    }
  }

  // Cache a Firestore query result
  static async cacheQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    configs: CacheConfig[],
    options: CacheOptions = {}
  ): Promise<T> {
    const {
      forceRefresh = false,
      cacheKey = key,
      onCacheHit,
      onCacheMiss,
      tags,
    } = options;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await cacheManager.getMultiLayer<T>(cacheKey, configs);
      if (cached !== null) {
        onCacheHit?.();
        return cached;
      }
    }

    // Execute query and cache result
    onCacheMiss?.();
    const result = await queryFn();

    if (result !== null && result !== undefined) {
      await cacheManager.setMultiLayer(cacheKey, result, configs);
      // Always tag by cacheKey for backward-compat invalidation, plus caller-provided tags
      const combinedTags = Array.from(new Set([cacheKey, ...(tags ?? [])]));
      this.registerTags(cacheKey, combinedTags);
    }

    return result;
  }

  // Cache user data
  static async cacheUserData<T>(
    userId: string,
    dataFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const configs = [
      FIREBASE_CACHE_CONFIGS.USER.memory,
      FIREBASE_CACHE_CONFIGS.USER.session,
    ];

    return this.cacheQuery(userId, dataFn, configs, {
      ...options,
      tags: options.tags ?? ["users", `user:${userId}`],
    });
  }

  // Cache location data
  static async cacheLocationData<T>(
    key: string,
    dataFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const configs = [
      FIREBASE_CACHE_CONFIGS.LOCATIONS.memory,
      FIREBASE_CACHE_CONFIGS.LOCATIONS.local,
      FIREBASE_CACHE_CONFIGS.LOCATIONS.indexeddb,
    ];

    return this.cacheQuery(key, dataFn, configs, {
      ...options,
      tags: options.tags ?? ["locations"],
    });
  }

  // Cache session data
  static async cacheSessionData<T>(
    key: string,
    dataFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const configs = [
      FIREBASE_CACHE_CONFIGS.SESSIONS.memory,
      FIREBASE_CACHE_CONFIGS.SESSIONS.session,
    ];

    return this.cacheQuery(key, dataFn, configs, {
      ...options,
      tags: options.tags ?? ["sessions", `session:${key}`],
    });
  }

  // Cache assignment data
  static async cacheAssignmentData<T>(
    key: string,
    dataFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const configs = [
      FIREBASE_CACHE_CONFIGS.ASSIGNMENTS.memory,
      FIREBASE_CACHE_CONFIGS.ASSIGNMENTS.session,
    ];

    return this.cacheQuery(key, dataFn, configs, {
      ...options,
      tags: options.tags ?? ["assignments"],
    });
  }

  // Cache search results
  static async cacheSearchResults<T>(
    searchQuery: string,
    searchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const configs = [FIREBASE_CACHE_CONFIGS.SEARCH.memory];
    const cacheKey = `search_${this.hashKey(searchQuery)}`;

    return this.cacheQuery(cacheKey, searchFn, configs, {
      ...options,
      cacheKey,
      tags: options.tags ?? [`search:${cacheKey}`],
    });
  }

  // Cache statistics
  static async cacheStats<T>(
    key: string,
    statsFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const configs = [
      FIREBASE_CACHE_CONFIGS.STATS.memory,
      FIREBASE_CACHE_CONFIGS.STATS.local,
    ];

    return this.cacheQuery(key, statsFn, configs, options);
  }

  // Invalidate cache for specific patterns
  static async invalidateCache(patterns: string[]): Promise<void> {
    // First try tag-based invalidation (new system)
    await this.invalidateTags(patterns);

    // Backward compatibility: also attempt direct key deletes using legacy behavior
    const allConfigs = this.allConfigs();
    await Promise.all(
      patterns.map((pattern) =>
        Promise.all(
          allConfigs.map((config) =>
            cacheManager.delete(pattern, config).catch(() => {
              // Ignore errors for non-existent keys
            })
          )
        )
      )
    );
  }

  // Clear all Firebase cache
  static async clearAll(): Promise<void> {
    await cacheManager.clear();
    this.tagIndex.clear();
  }

  // Clear cache by type
  static async clearByType(
    type: "users" | "locations" | "sessions" | "assignments"
  ): Promise<void> {
    const configMap = {
      users: FIREBASE_CACHE_CONFIGS.USER,
      locations: FIREBASE_CACHE_CONFIGS.LOCATIONS,
      sessions: FIREBASE_CACHE_CONFIGS.SESSIONS,
      assignments: FIREBASE_CACHE_CONFIGS.ASSIGNMENTS,
    };

    const configs = Object.values(configMap[type]);
    await Promise.all(configs.map((config) => cacheManager.clear(config)));
  }

  // Generate cache key for complex queries
  static generateQueryKey(
    collection: string,
    filters: Record<string, any> = {},
    orderBy?: string,
    limit?: number
  ): string {
    const parts = [collection];

    if (Object.keys(filters).length > 0) {
      const filterStr = Object.entries(filters)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value}`)
        .join("|");
      parts.push(`f:${filterStr}`);
    }

    if (orderBy) {
      parts.push(`o:${orderBy}`);
    }

    if (limit) {
      parts.push(`l:${limit}`);
    }

    return this.hashKey(parts.join("_"));
  }

  // Simple hash function for cache keys
  private static hashKey(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Get cache statistics
  static async getCacheStats(): Promise<{
    memorySize: number;
    totalQueries: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
  }> {
    // This would require implementing tracking in the cache manager
    // Simplified version for now
    return {
      memorySize: 0, // Would need to implement size tracking
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
    };
  }
}

// Cache performance tracker
export class CacheTracker {
  private static hits = 0;
  private static misses = 0;
  private static queries = 0;

  static recordHit(): void {
    this.hits++;
    this.queries++;
  }

  static recordMiss(): void {
    this.misses++;
    this.queries++;
  }

  static getStats(): {
    hits: number;
    misses: number;
    queries: number;
    hitRate: number;
  } {
    return {
      hits: this.hits,
      misses: this.misses,
      queries: this.queries,
      hitRate: this.queries > 0 ? this.hits / this.queries : 0,
    };
  }

  static reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.queries = 0;
  }
}
