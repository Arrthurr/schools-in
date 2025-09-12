"use client";

/**
 * Multi-layer cache manager for Firebase data
 * Supports memory, sessionStorage, localStorage, and IndexedDB
 */

export enum CacheType {
  MEMORY = "memory",
  SESSION = "session",
  LOCAL = "local",
  INDEXED_DB = "indexeddb",
}

export interface CacheConfig {
  type: CacheType;
  ttl: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  prefix?: string; // Key prefix
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  set<T>(key: string, data: T, ttl: number): void {
    // Remove expired entries if at max size
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    // If still at max size, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      key,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private cleanup(): void {
    this.cache.forEach((entry, key) => {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    });
  }

  size(): number {
    this.cleanup();
    return this.cache.size;
  }
}

class WebStorageCache {
  private storage: Storage;
  private prefix: string;

  constructor(storage: Storage, prefix = "firebase_cache_") {
    this.storage = storage;
    this.prefix = prefix;
  }

  set<T>(key: string, data: T, ttl: number): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        key,
      };
      this.storage.setItem(this.prefix + key, JSON.stringify(entry));
    } catch (error) {
      console.warn("Failed to set cache entry:", error);
      // Try to clear some space
      this.clearExpired();
      try {
        const entry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          ttl,
          key,
        };
        this.storage.setItem(this.prefix + key, JSON.stringify(entry));
      } catch (retryError) {
        console.error("Failed to cache after cleanup:", retryError);
      }
    }
  }

  get<T>(key: string): T | null {
    try {
      const item = this.storage.getItem(this.prefix + key);
      if (!item) return null;

      const entry: CacheEntry<T> = JSON.parse(item);

      if (this.isExpired(entry)) {
        this.storage.removeItem(this.prefix + key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn("Failed to get cache entry:", error);
      return null;
    }
  }

  delete(key: string): void {
    this.storage.removeItem(this.prefix + key);
  }

  clear(): void {
    const keys = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => this.storage.removeItem(key));
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private clearExpired(): void {
    const keysToDelete = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        try {
          const item = this.storage.getItem(key);
          if (item) {
            const entry: CacheEntry = JSON.parse(item);
            if (this.isExpired(entry)) {
              keysToDelete.push(key);
            }
          }
        } catch (error) {
          keysToDelete.push(key);
        }
      }
    }
    keysToDelete.forEach((key) => this.storage.removeItem(key));
  }
}

class IndexedDBCache {
  private dbName = "firebase_cache";
  private version = 1;
  private storeName = "cache_entries";
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB not supported"));
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: "key",
          });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        key,
      };

      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);

      const request = store.get(key);
      request.onsuccess = () => {
        const entry: CacheEntry<T> = request.result;
        if (!entry) {
          resolve(null);
          return;
        }

        if (this.isExpired(entry)) {
          // Delete expired entry
          this.delete(key).then(() => resolve(null));
          return;
        }

        resolve(entry.data);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }
}

export class CacheManager {
  private memoryCache: MemoryCache;
  private sessionCache!: WebStorageCache;
  private localCache!: WebStorageCache;
  private indexedDBCache!: IndexedDBCache;

  constructor() {
    this.memoryCache = new MemoryCache(200);

    if (typeof window !== "undefined") {
      this.sessionCache = new WebStorageCache(sessionStorage, "fb_session_");
      this.localCache = new WebStorageCache(localStorage, "fb_local_");
      this.indexedDBCache = new IndexedDBCache();
    }
  }

  async set<T>(key: string, data: T, config: CacheConfig): Promise<void> {
    const { type, ttl, prefix } = config;
    const cacheKey = prefix ? `${prefix}${key}` : key;

    try {
      switch (type) {
        case CacheType.MEMORY:
          this.memoryCache.set(cacheKey, data, ttl);
          break;
        case CacheType.SESSION:
          if (this.sessionCache) {
            this.sessionCache.set(cacheKey, data, ttl);
          }
          break;
        case CacheType.LOCAL:
          if (this.localCache) {
            this.localCache.set(cacheKey, data, ttl);
          }
          break;
        case CacheType.INDEXED_DB:
          if (this.indexedDBCache) {
            await this.indexedDBCache.set(cacheKey, data, ttl);
          }
          break;
      }
    } catch (error) {
      console.warn(`Failed to set cache for ${cacheKey}:`, error);
    }
  }

  async get<T>(key: string, config: CacheConfig): Promise<T | null> {
    const { type, prefix } = config;
    const cacheKey = prefix ? `${prefix}${key}` : key;

    try {
      switch (type) {
        case CacheType.MEMORY:
          return this.memoryCache.get<T>(cacheKey);
        case CacheType.SESSION:
          return this.sessionCache ? this.sessionCache.get<T>(cacheKey) : null;
        case CacheType.LOCAL:
          return this.localCache ? this.localCache.get<T>(cacheKey) : null;
        case CacheType.INDEXED_DB:
          return this.indexedDBCache
            ? await this.indexedDBCache.get<T>(cacheKey)
            : null;
        default:
          return null;
      }
    } catch (error) {
      console.warn(`Failed to get cache for ${cacheKey}:`, error);
      return null;
    }
  }

  async delete(key: string, config: CacheConfig): Promise<void> {
    const { type, prefix } = config;
    const cacheKey = prefix ? `${prefix}${key}` : key;

    try {
      switch (type) {
        case CacheType.MEMORY:
          this.memoryCache.delete(cacheKey);
          break;
        case CacheType.SESSION:
          this.sessionCache?.delete(cacheKey);
          break;
        case CacheType.LOCAL:
          this.localCache?.delete(cacheKey);
          break;
        case CacheType.INDEXED_DB:
          await this.indexedDBCache?.delete(cacheKey);
          break;
      }
    } catch (error) {
      console.warn(`Failed to delete cache for ${cacheKey}:`, error);
    }
  }

  async clear(config: Partial<CacheConfig> = {}): Promise<void> {
    const { type } = config;

    try {
      if (!type || type === CacheType.MEMORY) {
        this.memoryCache.clear();
      }
      if (!type || type === CacheType.SESSION) {
        this.sessionCache?.clear();
      }
      if (!type || type === CacheType.LOCAL) {
        this.localCache?.clear();
      }
      if (!type || type === CacheType.INDEXED_DB) {
        await this.indexedDBCache?.clear();
      }
    } catch (error) {
      console.warn("Failed to clear cache:", error);
    }
  }

  // Multi-layer caching: Try multiple cache types in order
  async getMultiLayer<T>(
    key: string,
    configs: CacheConfig[]
  ): Promise<T | null> {
    for (const config of configs) {
      const result = await this.get<T>(key, config);
      if (result !== null) {
        return result;
      }
    }
    return null;
  }

  async setMultiLayer<T>(
    key: string,
    data: T,
    configs: CacheConfig[]
  ): Promise<void> {
    await Promise.all(configs.map((config) => this.set(key, data, config)));
  }
}

// Singleton instance
export const cacheManager = new CacheManager();
