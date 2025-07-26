import {
  RequestCache,
  apiCache,
  forecastCache,
  beachCache,
} from "@/lib/utils/request-cache";

describe("RequestCache", () => {
  let cache: RequestCache;

  beforeEach(() => {
    cache = new RequestCache({ ttl: 1000, maxSize: 3 });
  });

  describe("Basic operations", () => {
    it("should store and retrieve data", () => {
      cache.set("test-key", "test-value");
      expect(cache.get("test-key")).toBe("test-value");
    });

    it("should return null for non-existent keys", () => {
      expect(cache.get("non-existent")).toBeNull();
    });

    it("should check if key exists", () => {
      cache.set("exists", "value");
      expect(cache.has("exists")).toBe(true);
      expect(cache.has("not-exists")).toBe(false);
    });

    it("should delete entries", () => {
      cache.set("delete-me", "value");
      expect(cache.has("delete-me")).toBe(true);

      cache.delete("delete-me");
      expect(cache.has("delete-me")).toBe(false);
    });

    it("should clear all entries", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      cache.clear();
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
    });
  });

  describe("TTL (Time To Live)", () => {
    it("should expire entries after TTL", (done) => {
      cache.set("expire-me", "value", 100); // 100ms TTL

      expect(cache.get("expire-me")).toBe("value");

      setTimeout(() => {
        expect(cache.get("expire-me")).toBeNull();
        done();
      }, 150);
    });

    it("should use default TTL when not specified", (done) => {
      cache.set("default-ttl", "value");

      setTimeout(() => {
        expect(cache.get("default-ttl")).toBeNull();
        done();
      }, 1100); // Default TTL is 1000ms
    });

    it("should clear expired entries", (done) => {
      cache.set("expire1", "value1", 100);
      cache.set("expire2", "value2", 100);
      cache.set("keep", "value3", 2000);

      setTimeout(() => {
        const clearedCount = cache.clearExpired();
        expect(clearedCount).toBe(2);
        expect(cache.has("keep")).toBe(true);
        done();
      }, 150);
    });
  });

  describe("Size limits", () => {
    it("should evict oldest entries when size limit is reached", () => {
      // Max size is 3
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");
      cache.set("key4", "value4"); // Should evict key1

      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(true);
      expect(cache.has("key3")).toBe(true);
      expect(cache.has("key4")).toBe(true);
    });
  });

  describe("Statistics", () => {
    it("should provide cache statistics", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
      expect(stats.defaultTTL).toBe(1000);
    });
  });

  describe("Key creation", () => {
    it("should create cache keys from multiple parts", () => {
      const key = RequestCache.createKey("beach", "123", "forecast");
      expect(key).toBe("beach:123:forecast");
    });

    it("should filter out null and undefined values", () => {
      const key = RequestCache.createKey(
        "beach",
        null,
        "123",
        undefined,
        "forecast"
      );
      expect(key).toBe("beach:123:forecast");
    });

    it("should convert values to strings", () => {
      const key = RequestCache.createKey("beach", 123, true, false);
      expect(key).toBe("beach:123:true:false");
    });
  });
});

describe("Global cache instances", () => {
  it("should have properly configured API cache", () => {
    const stats = apiCache.getStats();
    expect(stats.maxSize).toBe(50);
    expect(stats.defaultTTL).toBe(30 * 60 * 1000); // 30 minutes
  });

  it("should have properly configured forecast cache", () => {
    const stats = forecastCache.getStats();
    expect(stats.maxSize).toBe(30);
    expect(stats.defaultTTL).toBe(3 * 60 * 60 * 1000); // 3 hours
  });

  it("should have properly configured beach cache", () => {
    const stats = beachCache.getStats();
    expect(stats.maxSize).toBe(100);
    expect(stats.defaultTTL).toBe(12 * 60 * 60 * 1000); // 12 hours
  });
});
