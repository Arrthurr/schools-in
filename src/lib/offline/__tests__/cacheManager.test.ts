// Mock the cache strategy module
jest.mock("@/lib/offline/cacheStrategy", () => ({
  initCacheDB: jest.fn(),
  cacheData: jest.fn(),
  getCachedData: jest.fn(),
  clearExpiredCache: jest.fn(),
  preloadCriticalData: jest.fn(),
  CACHE_STORES: {
    SCHOOLS: "schools_cache",
    SESSIONS: "sessions_cache",
    USER_DATA: "user_data_cache",
    LOCATION_DATA: "location_cache",
    CACHE_METADATA: "cache_metadata",
    PENDING_ACTIONS: "pending_actions",
  },
  CACHE_CONFIG: {
    REFRESH_STRATEGIES: {
      BACKGROUND: "BACKGROUND",
      ON_DEMAND: "ON_DEMAND",
      STALE_WHILE_REVALIDATE: "STALE_WHILE_REVALIDATE",
    },
  },
}));

import CacheManager, { cacheManager } from "@/lib/offline/cacheManager";
import {
  initCacheDB,
  cacheData,
  getCachedData,
  clearExpiredCache,
  preloadCriticalData,
} from "@/lib/offline/cacheStrategy";

// Type the mocked functions
const mockInitCacheDB = initCacheDB as jest.MockedFunction<typeof initCacheDB>;
const mockCacheData = cacheData as jest.MockedFunction<typeof cacheData>;
const mockGetCachedData = getCachedData as jest.MockedFunction<
  typeof getCachedData
>;
const mockClearExpiredCache = clearExpiredCache as jest.MockedFunction<
  typeof clearExpiredCache
>;
const mockPreloadCriticalData = preloadCriticalData as jest.MockedFunction<
  typeof preloadCriticalData
>;

describe("CacheManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful initialization
    mockInitCacheDB.mockResolvedValue(undefined as any);
    mockCacheData.mockResolvedValue();
    mockGetCachedData.mockResolvedValue({
      data: [],
      isStale: false,
      needsRefresh: false,
    });
    mockClearExpiredCache.mockResolvedValue();
    mockPreloadCriticalData.mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Singleton Instance", () => {
    it("should have a shared cache manager instance", () => {
      expect(cacheManager).toBeDefined();
      expect(typeof cacheManager.cacheSchools).toBe("function");
      expect(typeof cacheManager.getCachedSchools).toBe("function");
    });
  });

  describe("Cache Operations", () => {
    it("should cache schools data", async () => {
      const mockSchools = [
        { id: "1", name: "Test School 1" },
        { id: "2", name: "Test School 2" },
      ];

      await cacheManager.cacheSchools(mockSchools);

      expect(mockCacheData).toHaveBeenCalledWith(
        "schools_cache",
        mockSchools,
        expect.any(Object)
      );
    });

    it("should cache sessions data", async () => {
      const mockSessions = [
        { id: "1", schoolId: "1", date: "2024-01-15" },
        { id: "2", schoolId: "2", date: "2024-01-16" },
      ];

      await cacheManager.cacheSessions(mockSessions);

      expect(mockCacheData).toHaveBeenCalledWith(
        "sessions_cache",
        mockSessions,
        expect.any(Object)
      );
    });

    it("should retrieve cached schools", async () => {
      const mockCachedData = {
        data: [{ id: "1", name: "Test School" }],
        isStale: false,
        needsRefresh: false,
        metadata: null,
      };

      mockGetCachedData.mockResolvedValue(mockCachedData);

      const result = await cacheManager.getCachedSchools();

      expect(mockGetCachedData).toHaveBeenCalledWith("schools_cache");
      expect(result).toEqual(mockCachedData);
    });

    it("should retrieve cached sessions with filter", async () => {
      const schoolId = "school-123";

      await cacheManager.getCachedSessions(schoolId);

      expect(mockGetCachedData).toHaveBeenCalledWith(
        "sessions_cache",
        expect.any(Function)
      );
    });
  });

  describe("Background Operations", () => {
    it("should preload offline data", async () => {
      const userId = "user-123";

      await cacheManager.preloadOfflineData(userId);

      expect(mockPreloadCriticalData).toHaveBeenCalledWith(userId);
    });

    it("should handle preload errors gracefully", async () => {
      const userId = "user-123";
      mockPreloadCriticalData.mockRejectedValue(new Error("Preload failed"));

      // Should not throw
      await expect(
        cacheManager.preloadOfflineData(userId)
      ).resolves.not.toThrow();
    });

    it("should get cache statistics", async () => {
      const mockStats = {
        totalSize: 1024,
        storeStats: {},
        recommendations: [],
      };

      // Mock getCacheStats since we're testing the manager wrapper
      jest.doMock("@/lib/offline/cacheStrategy", () => ({
        ...jest.requireActual("@/lib/offline/cacheStrategy"),
        getCacheStats: jest.fn().mockResolvedValue(mockStats),
      }));

      const stats = await cacheManager.getCacheStatistics();
      expect(stats).toBeDefined();
    });
  });

  describe("Cache Strategy Configuration", () => {
    it("should use appropriate cache strategy for schools", async () => {
      const mockSchools = [{ id: "1", name: "Test School" }];

      await cacheManager.cacheSchools(mockSchools);

      const cacheCall = mockCacheData.mock.calls[0];
      const strategy = cacheCall[2];

      expect(strategy).toEqual(
        expect.objectContaining({
          refreshStrategy: expect.any(String),
        })
      );
    });

    it("should use appropriate cache strategy for sessions", async () => {
      const mockSessions = [{ id: "1", schoolId: "1" }];

      await cacheManager.cacheSessions(mockSessions);

      const cacheCall = mockCacheData.mock.calls[0];
      const strategy = cacheCall[2];

      expect(strategy).toEqual(
        expect.objectContaining({
          refreshStrategy: expect.any(String),
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle cache operation failures", async () => {
      mockCacheData.mockRejectedValue(new Error("Cache failed"));

      // Should not throw, but handle gracefully
      await expect(cacheManager.cacheSchools([])).resolves.not.toThrow();
    });

    it("should handle retrieval failures", async () => {
      mockGetCachedData.mockRejectedValue(new Error("Retrieval failed"));

      const result = await cacheManager.getCachedSchools();

      // Should return empty result on error
      expect(result).toEqual({
        data: [],
        isStale: true,
        needsRefresh: true,
        metadata: null,
      });
    });
  });
});
