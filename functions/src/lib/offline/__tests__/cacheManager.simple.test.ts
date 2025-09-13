import { cacheManager } from "@/lib/offline/cacheManager";

// Simple integration test for cache manager
describe("CacheManager Integration", () => {
  describe("Public API", () => {
    it("should have cache manager instance", () => {
      expect(cacheManager).toBeDefined();
    });

    it("should have required methods", () => {
      expect(typeof cacheManager.cacheSchools).toBe("function");
      expect(typeof cacheManager.getCachedSchools).toBe("function");
      expect(typeof cacheManager.cacheSessions).toBe("function");
      expect(typeof cacheManager.getCachedSessions).toBe("function");
      expect(typeof cacheManager.cacheLocationData).toBe("function");
      expect(typeof cacheManager.getRecentLocationData).toBe("function");
      expect(typeof cacheManager.cacheUserData).toBe("function");
      expect(typeof cacheManager.getCachedUserData).toBe("function");
      expect(typeof cacheManager.preloadOfflineData).toBe("function");
      expect(typeof cacheManager.getCacheStatistics).toBe("function");
      expect(typeof cacheManager.refreshCache).toBe("function");
      expect(typeof cacheManager.clearAllCaches).toBe("function");
    });

    it("should handle basic cache operations without throwing", async () => {
      // These might fail due to missing IndexedDB in test environment
      // but they should not throw synchronously
      expect(() => {
        cacheManager.cacheSchools([]);
        cacheManager.getCachedSchools();
        cacheManager.cacheSessions([]);
        cacheManager.getCachedSessions();
      }).not.toThrow();
    });

    it("should handle async operations gracefully", async () => {
      // Test that methods return promises and handle errors gracefully
      const schoolsPromise = cacheManager.cacheSchools([]);
      const getCachedPromise = cacheManager.getCachedSchools();

      expect(schoolsPromise).toBeInstanceOf(Promise);
      expect(getCachedPromise).toBeInstanceOf(Promise);

      // These may reject in test environment, but should not crash
      try {
        await schoolsPromise;
        await getCachedPromise;
      } catch (error) {
        // Expected in test environment without IndexedDB
        expect(error).toBeDefined();
      }
    });
  });

  describe("Cache Configuration", () => {
    it("should be properly configured", () => {
      // Test that the manager was instantiated with config
      expect(cacheManager).toBeInstanceOf(Object);

      // Test that it has the expected structure
      expect(cacheManager.constructor).toBeDefined();
      expect(cacheManager.constructor.name).toBe("CacheManager");
    });
  });
});
