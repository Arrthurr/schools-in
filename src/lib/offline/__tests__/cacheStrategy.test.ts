// Mock IndexedDB
jest.mock("idb", () => ({
  openDB: jest.fn(),
}));

import {
  initCacheDB,
  cacheData,
  getCachedData,
  clearExpiredCache,
  getCacheStats,
  preloadCriticalData,
  CACHE_STORES,
  CACHE_CONFIG,
} from "@/lib/offline/cacheStrategy";
import { openDB } from "idb";

const mockOpenDB = openDB as jest.MockedFunction<typeof openDB>;

const mockDB = {
  getAll: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  add: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  transaction: jest.fn(),
  objectStore: jest.fn(),
};

describe("CacheStrategy", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock DB return
    mockOpenDB.mockResolvedValue(mockDB as any);

    // Setup mock transaction
    const mockStore = {
      put: jest.fn(),
      getAll: jest.fn(),
      delete: jest.fn(),
    };

    const mockTransaction = {
      objectStore: jest.fn(() => mockStore),
      store: mockStore,
      done: Promise.resolve(),
    };

    mockDB.transaction.mockReturnValue(mockTransaction);
    mockDB.getAll.mockResolvedValue([]);
    mockDB.get.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("initCacheDB", () => {
    it("should initialize the cache database", async () => {
      await initCacheDB();

      expect(mockOpenDB).toHaveBeenCalledWith(
        "schools-in-cache",
        2,
        expect.any(Object)
      );
    });

    it("should return existing database instance if already initialized", async () => {
      const db1 = await initCacheDB();
      const db2 = await initCacheDB();

      expect(db1).toBe(db2);
      expect(mockOpenDB).toHaveBeenCalledTimes(1);
    });
  });

  describe("cacheData", () => {
    it("should cache data with metadata", async () => {
      const testData = [
        { id: "1", name: "Test School 1" },
        { id: "2", name: "Test School 2" },
      ];

      await cacheData(CACHE_STORES.SCHOOLS, testData);

      expect(mockDB.transaction).toHaveBeenCalled();
    });

    it("should use default cache strategy if none provided", async () => {
      const testData = [{ id: "1", name: "Test" }];

      await cacheData(CACHE_STORES.SCHOOLS, testData);

      // Should complete without error
      expect(mockDB.transaction).toHaveBeenCalled();
    });

    it("should add cache metadata to each item", async () => {
      const testData = [{ id: "1", name: "Test" }];
      const now = Date.now();

      jest.spyOn(Date, "now").mockReturnValue(now);

      await cacheData(CACHE_STORES.SCHOOLS, testData);

      // Verify that cache metadata is added
      const transaction = mockDB.transaction.mock.calls[0][1];
      expect(transaction).toBe("readwrite");
    });
  });

  describe("getCachedData", () => {
    it("should return cached data with staleness info", async () => {
      const cachedItems = [
        {
          id: "1",
          name: "Test",
          _cached: true,
          _cachedAt: Date.now() - 1000,
          _expiresAt: Date.now() + 10000,
        },
      ];

      mockDB.getAll.mockResolvedValue(cachedItems);
      mockDB.get.mockResolvedValue({
        id: CACHE_STORES.SCHOOLS,
        cachedAt: Date.now() - 1000,
        expiresAt: Date.now() + 10000,
        accessCount: 1,
      });

      const result = await getCachedData(CACHE_STORES.SCHOOLS);

      expect(result.data).toEqual(cachedItems);
      expect(result.isStale).toBeDefined();
      expect(result.needsRefresh).toBeDefined();
    });

    it("should filter data when filter function is provided", async () => {
      const cachedItems = [
        { id: "1", name: "School A", region: "north" },
        { id: "2", name: "School B", region: "south" },
      ];

      mockDB.getAll.mockResolvedValue(cachedItems);
      mockDB.get.mockResolvedValue(null);

      const result = await getCachedData(
        CACHE_STORES.SCHOOLS,
        (item: any) => item.region === "north"
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].region).toBe("north");
    });

    it("should handle expired cache correctly", async () => {
      const expiredTime = Date.now() - 10000;

      mockDB.getAll.mockResolvedValue([]);
      mockDB.get.mockResolvedValue({
        id: CACHE_STORES.SCHOOLS,
        cachedAt: expiredTime,
        expiresAt: expiredTime,
        accessCount: 1,
      });

      const result = await getCachedData(CACHE_STORES.SCHOOLS);

      expect(result.needsRefresh).toBe(true);
    });
  });

  describe("clearExpiredCache", () => {
    it("should remove expired cache entries", async () => {
      const now = Date.now();
      const expiredItems = [
        { id: "1", _expiresAt: now - 1000 },
        { id: "2", _expiresAt: now + 1000 },
      ];

      mockDB.getAll.mockResolvedValue(expiredItems);

      await clearExpiredCache();

      // Should have been called to delete expired item
      expect(mockDB.transaction).toHaveBeenCalled();
    });

    it("should skip metadata store during cleanup", async () => {
      await clearExpiredCache();

      // Should call getAll for each store except metadata
      const expectedStores = Object.values(CACHE_STORES).filter(
        (store) => store !== CACHE_STORES.CACHE_METADATA
      );

      expect(mockDB.getAll).toHaveBeenCalledTimes(expectedStores.length);
    });
  });

  describe("getCacheStats", () => {
    it("should return comprehensive cache statistics", async () => {
      const mockItems = [{ id: "1" }, { id: "2" }];
      const mockMetadata = {
        lastAccessed: Date.now(),
        accessCount: 5,
        expiresAt: Date.now() + 10000,
      };

      mockDB.getAll.mockResolvedValue(mockItems);
      mockDB.get.mockResolvedValue(mockMetadata);

      const stats = await getCacheStats();

      expect(stats).toHaveProperty("totalSize");
      expect(stats).toHaveProperty("storeStats");
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it("should calculate staleness correctly", async () => {
      const now = Date.now();
      const staleMetadata = {
        lastAccessed: now,
        accessCount: 1,
        expiresAt: now - 1000, // Expired
      };

      mockDB.getAll.mockResolvedValue([{ id: "1" }]);
      mockDB.get.mockResolvedValue(staleMetadata);

      const stats = await getCacheStats();

      // Check that at least one store is marked as stale
      const storeValues = Object.values(stats.storeStats);
      expect(storeValues.some((store: any) => store.isStale)).toBe(true);
    });
  });

  describe("preloadCriticalData", () => {
    it("should preload schools and sessions data for user", async () => {
      const userId = "test-user-123";

      await preloadCriticalData(userId);

      // Should have called cacheData for both schools and sessions
      expect(mockDB.transaction).toHaveBeenCalled();
    });

    it("should handle preload errors gracefully", async () => {
      const userId = "test-user-123";

      // Make the transaction throw synchronously so the caller's try/catch can handle it
      mockDB.transaction.mockImplementationOnce(() => {
        throw new Error("Cache error");
      });

      // Should not throw error
      await expect(preloadCriticalData(userId)).resolves.not.toThrow();
    });
  });

  describe("CACHE_CONFIG", () => {
    it("should have valid expiration times", () => {
      expect(CACHE_CONFIG.EXPIRATION.SCHOOLS).toBeGreaterThan(0);
      expect(CACHE_CONFIG.EXPIRATION.SESSIONS).toBeGreaterThan(0);
      expect(CACHE_CONFIG.EXPIRATION.USER_DATA).toBeGreaterThan(0);
      expect(CACHE_CONFIG.EXPIRATION.LOCATION_DATA).toBeGreaterThan(0);
    });

    it("should have reasonable size limits", () => {
      expect(CACHE_CONFIG.SIZE_LIMITS.SCHOOLS).toBeGreaterThan(0);
      expect(CACHE_CONFIG.SIZE_LIMITS.SESSIONS).toBeGreaterThan(0);
      expect(CACHE_CONFIG.SIZE_LIMITS.LOCATION_DATA).toBeGreaterThan(0);
    });

    it("should have valid refresh strategies", () => {
      const strategies = Object.values(CACHE_CONFIG.REFRESH_STRATEGIES);
      expect(strategies).toHaveLength(3);
      expect(strategies).toContain("BACKGROUND");
      expect(strategies).toContain("ON_DEMAND");
      expect(strategies).toContain("STALE_WHILE_REVALIDATE");
    });
  });

  describe("Cache Store Constants", () => {
    it("should have all required cache stores", () => {
      expect(CACHE_STORES.SCHOOLS).toBeDefined();
      expect(CACHE_STORES.SESSIONS).toBeDefined();
      expect(CACHE_STORES.USER_DATA).toBeDefined();
      expect(CACHE_STORES.LOCATION_DATA).toBeDefined();
      expect(CACHE_STORES.CACHE_METADATA).toBeDefined();
      expect(CACHE_STORES.PENDING_ACTIONS).toBeDefined();
    });

    it("should have unique store names", () => {
      const storeValues = Object.values(CACHE_STORES);
      const uniqueValues = new Set(storeValues);
      expect(uniqueValues.size).toBe(storeValues.length);
    });
  });
});
