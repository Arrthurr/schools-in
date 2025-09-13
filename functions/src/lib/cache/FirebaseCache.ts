'use client';

/**
 * Firebase-specific caching strategies and configurations
 */

import { cacheManager, CacheType, CacheConfig } from './CacheManager';

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
      prefix: 'user_',
    },
    session: {
      type: CacheType.SESSION,
      ttl: CACHE_TTL.LONG,
      prefix: 'user_',
    },
  },

  // Authentication state - memory + session
  AUTH: {
    memory: {
      type: CacheType.MEMORY,
      ttl: CACHE_TTL.MEDIUM,
      prefix: 'auth_',
    },
    session: {
      type: CacheType.SESSION,
      ttl: CACHE_TTL.SESSION,
      prefix: 'auth_',
    },
  },

  // School/Location data - long term cache
  LOCATIONS: {
    memory: {
      type: CacheType.MEMORY,
      ttl: CACHE_TTL.LONG,
      prefix: 'location_',
    },
    local: {
      type: CacheType.LOCAL,
      ttl: CACHE_TTL.VERY_LONG,
      prefix: 'location_',
    },
    indexeddb: {
      type: CacheType.INDEXED_DB,
      ttl: CACHE_TTL.VERY_LONG,
      prefix: 'location_',
    },
  },

  // Session data - short term cache
  SESSIONS: {
    memory: {
      type: CacheType.MEMORY,
      ttl: CACHE_TTL.SHORT,
      prefix: 'session_',
    },
    session: {
      type: CacheType.SESSION,
      ttl: CACHE_TTL.MEDIUM,
      prefix: 'session_',
    },
  },

  // Assignments - medium term cache
  ASSIGNMENTS: {
    memory: {
      type: CacheType.MEMORY,
      ttl: CACHE_TTL.MEDIUM,
      prefix: 'assignment_',
    },
    session: {
      type: CacheType.SESSION,
      ttl: CACHE_TTL.LONG,
      prefix: 'assignment_',
    },
  },

  // Search results - short term cache
  SEARCH: {
    memory: {
      type: CacheType.MEMORY,
      ttl: CACHE_TTL.SHORT,
      prefix: 'search_',
    },
  },

  // Statistics and aggregated data - medium term cache
  STATS: {
    memory: {
      type: CacheType.MEMORY,
      ttl: CACHE_TTL.MEDIUM,
      prefix: 'stats_',
    },
    local: {
      type: CacheType.LOCAL,
      ttl: CACHE_TTL.LONG,
      prefix: 'stats_',
    },
  },
} as const;

export interface CacheOptions {
  forceRefresh?: boolean;
  cacheKey?: string;
  ttl?: number;
  onCacheHit?: () => void;
  onCacheMiss?: () => void;
}

export class FirebaseCache {
  // Cache a Firestore query result
  static async cacheQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    configs: CacheConfig[],
    options: CacheOptions = {}
  ): Promise<T> {
    const { forceRefresh = false, cacheKey = key, onCacheHit, onCacheMiss } = options;

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

    return this.cacheQuery(
      userId,
      dataFn,
      configs,
      options
    );
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

    return this.cacheQuery(
      key,
      dataFn,
      configs,
      options
    );
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

    return this.cacheQuery(
      key,
      dataFn,
      configs,
      options
    );
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

    return this.cacheQuery(
      key,
      dataFn,
      configs,
      options
    );
  }

  // Cache search results
  static async cacheSearchResults<T>(
    searchQuery: string,
    searchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const configs = [FIREBASE_CACHE_CONFIGS.SEARCH.memory];
    const cacheKey = `search_${this.hashKey(searchQuery)}`;

    return this.cacheQuery(
      cacheKey,
      searchFn,
      configs,
      { ...options, cacheKey }
    );
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

    return this.cacheQuery(
      key,
      statsFn,
      configs,
      options
    );
  }

  // Invalidate cache for specific patterns
  static async invalidateCache(patterns: string[]): Promise<void> {
    const allConfigs = Object.values(FIREBASE_CACHE_CONFIGS).flatMap(
      config => Object.values(config)
    );

    // Note: This is a simplified implementation
    // In a full implementation, you'd need to track keys or implement pattern matching
    await Promise.all(
      patterns.map(pattern =>
        Promise.all(
          allConfigs.map(config =>
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
  }

  // Clear cache by type
  static async clearByType(type: 'users' | 'locations' | 'sessions' | 'assignments'): Promise<void> {
    const configMap = {
      users: FIREBASE_CACHE_CONFIGS.USER,
      locations: FIREBASE_CACHE_CONFIGS.LOCATIONS,
      sessions: FIREBASE_CACHE_CONFIGS.SESSIONS,
      assignments: FIREBASE_CACHE_CONFIGS.ASSIGNMENTS,
    };

    const configs = Object.values(configMap[type]);
    await Promise.all(
      configs.map(config => cacheManager.clear(config))
    );
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
        .join('|');
      parts.push(`f:${filterStr}`);
    }
    
    if (orderBy) {
      parts.push(`o:${orderBy}`);
    }
    
    if (limit) {
      parts.push(`l:${limit}`);
    }
    
    return this.hashKey(parts.join('_'));
  }

  // Simple hash function for cache keys
  private static hashKey(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
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
