'use client';

/**
 * Cache initialization and management for the entire application
 */

import { CacheTracker } from './FirebaseCache';
import { cacheManager, CacheType } from './CacheManager';

export interface CacheInitOptions {
  enableMemoryCache?: boolean;
  enableSessionCache?: boolean;
  enableLocalCache?: boolean;
  enableIndexedDBCache?: boolean;
  maxMemorySize?: number;
  debug?: boolean;
}

export class CacheInitializer {
  private static isInitialized = false;
  private static options: CacheInitOptions = {};

  // Initialize caching system
  static async initialize(options: CacheInitOptions = {}): Promise<void> {
    if (this.isInitialized) {
      console.warn('Cache already initialized');
      return;
    }

    this.options = {
      enableMemoryCache: true,
      enableSessionCache: true,
      enableLocalCache: true,
      enableIndexedDBCache: true,
      maxMemorySize: 200,
      debug: process.env.NODE_ENV === 'development',
      ...options,
    };

    try {
      // Initialize IndexedDB if enabled
      if (this.options.enableIndexedDBCache) {
        await this.initializeIndexedDB();
      }

      // Clean up expired cache entries
      await this.cleanupExpiredEntries();

      // Set up cache monitoring
      if (this.options.debug) {
        this.setupCacheMonitoring();
      }

      // Set up periodic cleanup
      this.setupPeriodicCleanup();

      this.isInitialized = true;
      
      if (this.options.debug) {
        console.log('✅ Firebase cache system initialized', {
          memoryCache: this.options.enableMemoryCache,
          sessionCache: this.options.enableSessionCache,
          localCache: this.options.enableLocalCache,
          indexedDBCache: this.options.enableIndexedDBCache,
        });
      }
    } catch (error) {
      console.error('Failed to initialize cache system:', error);
      throw error;
    }
  }

  // Pre-warm cache for authenticated user
  static async preWarmForUser(userId: string, role: 'provider' | 'admin'): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (role === 'provider') {
        // Pre-warm provider-specific data
        const { CachedSchoolService } = await import('@/lib/services/cachedSchoolService');
        const { getCachedUserSessions } = await import('@/lib/firebase/cachedFirestore');
        
        await Promise.all([
          CachedSchoolService.getSchoolsByProvider(userId),
          getCachedUserSessions(userId, { limit: 20 }),
          CachedSchoolService.getSchoolStats(),
        ]);
      } else if (role === 'admin') {
        // Pre-warm admin-specific data
        const { CachedUserService } = await import('@/lib/services/cachedUserService');
        const { CachedSchoolService } = await import('@/lib/services/cachedSchoolService');
        
        await Promise.all([
          CachedUserService.getAllUsers({}, { limit: 100 }),
          CachedSchoolService.getAllSchools({}, { limit: 100 }),
          CachedUserService.getUserStats(),
          CachedSchoolService.getSchoolStats(),
        ]);
      }

      if (this.options.debug) {
        console.log(`✅ Cache pre-warmed for ${role}:`, userId);
      }
    } catch (error) {
      console.warn('Failed to pre-warm cache for user:', error);
    }
  }

  // Get cache statistics
  static getCacheStats(): {
    tracker: ReturnType<typeof CacheTracker.getStats>;
    memory: { size: number };
    isInitialized: boolean;
  } {
    return {
      tracker: CacheTracker.getStats(),
      memory: { size: 0 }, // Would need to implement size tracking
      isInitialized: this.isInitialized,
    };
  }

  // Clear all cache
  static async clearAllCache(): Promise<void> {
    try {
      await cacheManager.clear();
      CacheTracker.reset();
      
      if (this.options.debug) {
        console.log('🗑️ All cache cleared');
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }

  // Reset cache system
  static async reset(): Promise<void> {
    try {
      await this.clearAllCache();
      this.isInitialized = false;
      await this.initialize(this.options);
    } catch (error) {
      console.error('Failed to reset cache system:', error);
      throw error;
    }
  }

  // Private methods
  private static async initializeIndexedDB(): Promise<void> {
    // IndexedDB initialization is handled in CacheManager
    // This is a placeholder for additional IndexedDB setup if needed
  }

  private static async cleanupExpiredEntries(): Promise<void> {
    try {
      // Clean up expired entries from all storage types
      if (typeof window !== 'undefined') {
        // Clean sessionStorage
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('fb_session_')) {
            try {
              const item = sessionStorage.getItem(key);
              if (item) {
                const entry = JSON.parse(item);
                if (Date.now() - entry.timestamp > entry.ttl) {
                  sessionStorage.removeItem(key);
                }
              }
            } catch (error) {
              sessionStorage.removeItem(key);
            }
          }
        }

        // Clean localStorage
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith('fb_local_')) {
            try {
              const item = localStorage.getItem(key);
              if (item) {
                const entry = JSON.parse(item);
                if (Date.now() - entry.timestamp > entry.ttl) {
                  localStorage.removeItem(key);
                }
              }
            } catch (error) {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup expired cache entries:', error);
    }
  }

  private static setupCacheMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Monitor cache performance
    let lastStats = CacheTracker.getStats();
    
    setInterval(() => {
      const currentStats = CacheTracker.getStats();
      
      if (currentStats.queries > lastStats.queries) {
        const newQueries = currentStats.queries - lastStats.queries;
        const newHits = currentStats.hits - lastStats.hits;
        const recentHitRate = newQueries > 0 ? newHits / newQueries : 0;
        
        console.log('📊 Cache Performance:', {
          recentQueries: newQueries,
          recentHitRate: `${(recentHitRate * 100).toFixed(1)}%`,
          overallHitRate: `${(currentStats.hitRate * 100).toFixed(1)}%`,
          totalQueries: currentStats.queries,
        });
        
        lastStats = currentStats;
      }
    }, 30000); // Log every 30 seconds

    // Log cache stats to console for debugging
    (window as any).__getCacheStats = () => {
      console.table({
        'Cache Performance': CacheTracker.getStats(),
        'Memory Cache Size': 0, // Would need implementation
      });
    };
  }

  private static setupPeriodicCleanup(): void {
    if (typeof window === 'undefined') return;

    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
      
      if (this.options.debug) {
        console.log('🧹 Periodic cache cleanup completed');
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Aggressive cleanup on page visibility change (when returning from background)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => {
          this.cleanupExpiredEntries();
        }, 1000);
      }
    });

    // Cleanup before page unload
    window.addEventListener('beforeunload', () => {
      this.cleanupExpiredEntries();
    });
  }

  // Handle network status changes for cache strategy
  static setupNetworkAwareCache(): void {
    if (typeof window === 'undefined') return;

    const updateCacheStrategy = () => {
      const isOnline = navigator.onLine;
      
      if (!isOnline) {
        // When offline, prefer local/IndexedDB cache
        console.log('📱 Offline mode: Using local cache strategies');
      } else {
        // When online, balance between cache and fresh data
        console.log('🌐 Online mode: Using hybrid cache strategies');
      }
    };

    window.addEventListener('online', updateCacheStrategy);
    window.addEventListener('offline', updateCacheStrategy);
    
    // Initial check
    updateCacheStrategy();
  }

  // Export cache for debugging
  static exportCacheData(): Promise<any> {
    return new Promise(async (resolve) => {
      const stats = this.getCacheStats();
      const memoryData = {}; // Would need to implement memory cache export
      
      resolve({
        stats,
        memoryData,
        timestamp: new Date(),
      });
    });
  }
}

// Auto-initialize cache when module is imported
if (typeof window !== 'undefined') {
  // Initialize cache system when the module loads
  CacheInitializer.initialize().catch(error => {
    console.warn('Failed to auto-initialize cache:', error);
  });
}

export { CacheInitializer };
