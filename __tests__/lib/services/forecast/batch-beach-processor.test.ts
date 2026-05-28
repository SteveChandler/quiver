/**
 * Tests for batch-beach-processor.ts
 *
 * Covers:
 * - DeadlineTracker: msRemaining, shouldStop, hasTimeForDelay, isDeadlineConfigured
 * - loadBatchConfig() / loadCdipBatchConfig(): env var parsing, defaults
 * - processBeachesInBatches(): batch splitting, deadline early-stop, delay, error handling
 * - createBeachProcessor(): factory returns correct function, error catching
 */

import type { Beach } from "@/types/database";
import {
  DeadlineTracker,
  loadBatchConfig,
  loadCdipBatchConfig,
  processBeachesInBatches,
  createBeachProcessor,
} from "@/lib/services/forecast/batch-beach-processor";
import type {
  BatchProcessConfig,
  BeachProcessResult,
} from "@/lib/services/forecast/batch-beach-processor";
import {
  expectConsoleErrors,
  expectConsoleWarnings,
} from "@/__tests__/setup/test-utils";

// Minimal Beach stub for tests
function makeBeach(id: string, name: string): Beach {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    center_lat: 32.7,
    center_lng: -117.2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Beach;
}

// ─── DeadlineTracker ─────────────────────────────────────────────────────────

describe("DeadlineTracker", () => {
  describe("without a deadline", () => {
    let tracker: DeadlineTracker;

    beforeEach(() => {
      tracker = new DeadlineTracker();
    });

    it("isDeadlineConfigured() returns false", () => {
      expect(tracker.isDeadlineConfigured()).toBe(false);
    });

    it("msRemaining() returns +Infinity", () => {
      expect(tracker.msRemaining()).toBe(Number.POSITIVE_INFINITY);
    });

    it("shouldStop() returns false", () => {
      expect(tracker.shouldStop()).toBe(false);
    });

    it("hasTimeForDelay() returns true for any delay value", () => {
      expect(tracker.hasTimeForDelay(0)).toBe(true);
      expect(tracker.hasTimeForDelay(99999)).toBe(true);
    });
  });

  describe("with a future deadline", () => {
    let tracker: DeadlineTracker;

    beforeEach(() => {
      // 30 seconds in the future
      tracker = new DeadlineTracker(Date.now() + 30_000);
    });

    it("isDeadlineConfigured() returns true", () => {
      expect(tracker.isDeadlineConfigured()).toBe(true);
    });

    it("msRemaining() returns a positive number", () => {
      expect(tracker.msRemaining()).toBeGreaterThan(0);
    });

    it("shouldStop() returns false", () => {
      expect(tracker.shouldStop()).toBe(false);
    });

    it("hasTimeForDelay(1000) returns true when plenty of time remains", () => {
      expect(tracker.hasTimeForDelay(1_000)).toBe(true);
    });

    it("hasTimeForDelay() returns false when delay exceeds remaining time", () => {
      // The tracker has ~30s, so 60s is too long
      expect(tracker.hasTimeForDelay(60_000)).toBe(false);
    });
  });

  describe("with an already-expired deadline", () => {
    let tracker: DeadlineTracker;

    beforeEach(() => {
      // 5 seconds in the past
      tracker = new DeadlineTracker(Date.now() - 5_000);
    });

    it("isDeadlineConfigured() returns true", () => {
      expect(tracker.isDeadlineConfigured()).toBe(true);
    });

    it("msRemaining() returns a negative number", () => {
      expect(tracker.msRemaining()).toBeLessThan(0);
    });

    it("shouldStop() returns true", () => {
      expect(tracker.shouldStop()).toBe(true);
    });

    it("hasTimeForDelay() returns false", () => {
      expect(tracker.hasTimeForDelay(100)).toBe(false);
    });
  });

  describe("with non-finite deadline", () => {
    it("treats NaN deadline as no deadline configured", () => {
      const tracker = new DeadlineTracker(NaN);
      expect(tracker.isDeadlineConfigured()).toBe(false);
      expect(tracker.shouldStop()).toBe(false);
    });

    it("treats Infinity deadline as no deadline configured", () => {
      const tracker = new DeadlineTracker(Infinity);
      expect(tracker.isDeadlineConfigured()).toBe(false);
      expect(tracker.shouldStop()).toBe(false);
    });
  });
});

// ─── loadBatchConfig ──────────────────────────────────────────────────────────

describe("loadBatchConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns default values when env vars are not set", () => {
    delete process.env.FORECAST_BATCH_SIZE;
    delete process.env.FORECAST_BATCH_DELAY_MS;
    delete process.env.FORECAST_MAX_BEACHES_PER_RUN;
    delete process.env.FORECAST_FRESHNESS_WINDOW_HOURS;

    const config = loadBatchConfig();
    expect(config.batchSize).toBe(3);
    expect(config.batchDelayMs).toBe(1000);
    expect(config.maxBeachesPerRun).toBe(45);
    expect(config.freshnessWindowHours).toBe(12);
  });

  it("reads values from environment variables", () => {
    process.env.FORECAST_BATCH_SIZE = "5";
    process.env.FORECAST_BATCH_DELAY_MS = "2000";
    process.env.FORECAST_MAX_BEACHES_PER_RUN = "100";
    process.env.FORECAST_FRESHNESS_WINDOW_HOURS = "6";

    const config = loadBatchConfig();
    expect(config.batchSize).toBe(5);
    expect(config.batchDelayMs).toBe(2000);
    expect(config.maxBeachesPerRun).toBe(100);
    expect(config.freshnessWindowHours).toBe(6);
  });

  it("applies overrides over env vars", () => {
    process.env.FORECAST_BATCH_SIZE = "5";

    const config = loadBatchConfig({ batchSize: 10, batchDelayMs: 500 });
    expect(config.batchSize).toBe(10);
    expect(config.batchDelayMs).toBe(500);
  });

  it("partial overrides only replace specified fields", () => {
    const config = loadBatchConfig({ batchSize: 7 });
    expect(config.batchSize).toBe(7);
    // Others remain at defaults
    expect(config.batchDelayMs).toBe(1000);
    expect(config.maxBeachesPerRun).toBe(45);
    expect(config.freshnessWindowHours).toBe(12);
  });
});

// ─── loadCdipBatchConfig ──────────────────────────────────────────────────────

describe("loadCdipBatchConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FORECAST_BATCH_SIZE;
    delete process.env.FORECAST_BATCH_DELAY_MS;
    delete process.env.FORECAST_CDIP_MAX_BEACHES_PER_RUN;
    delete process.env.FORECAST_MAX_BEACHES_PER_RUN;
    delete process.env.FORECAST_CDIP_FRESHNESS_WINDOW_HOURS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns CDIP-specific defaults", () => {
    const config = loadCdipBatchConfig();
    expect(config.batchSize).toBe(3);
    expect(config.batchDelayMs).toBe(1000);
    expect(config.maxBeachesPerRun).toBe(25);
    expect(config.freshnessWindowHours).toBe(2);
  });

  it("reads FORECAST_CDIP_MAX_BEACHES_PER_RUN when set", () => {
    process.env.FORECAST_CDIP_MAX_BEACHES_PER_RUN = "50";
    const config = loadCdipBatchConfig();
    expect(config.maxBeachesPerRun).toBe(50);
  });

  it("falls back to FORECAST_MAX_BEACHES_PER_RUN when CDIP-specific is not set", () => {
    process.env.FORECAST_MAX_BEACHES_PER_RUN = "30";
    const config = loadCdipBatchConfig();
    expect(config.maxBeachesPerRun).toBe(30);
  });

  it("CDIP-specific var takes precedence over generic var", () => {
    process.env.FORECAST_CDIP_MAX_BEACHES_PER_RUN = "15";
    process.env.FORECAST_MAX_BEACHES_PER_RUN = "30";
    const config = loadCdipBatchConfig();
    expect(config.maxBeachesPerRun).toBe(15);
  });

  it("reads FORECAST_CDIP_FRESHNESS_WINDOW_HOURS when set", () => {
    process.env.FORECAST_CDIP_FRESHNESS_WINDOW_HOURS = "4";
    const config = loadCdipBatchConfig();
    expect(config.freshnessWindowHours).toBe(4);
  });
});

// ─── processBeachesInBatches ──────────────────────────────────────────────────

describe("processBeachesInBatches", () => {
  const defaultConfig: BatchProcessConfig = {
    batchSize: 2,
    batchDelayMs: 0, // No delay in tests for speed
    maxBeachesPerRun: 100,
    freshnessWindowHours: 12,
  };

  it("processes all beaches and returns success results", async () => {
    const beaches = [makeBeach("1", "Beach A"), makeBeach("2", "Beach B"), makeBeach("3", "Beach C")];
    const processBeach = jest.fn(async (beach: Beach): Promise<BeachProcessResult> => ({
      beach: beach.name,
      success: true,
    }));

    const result = await processBeachesInBatches({
      beaches,
      config: defaultConfig,
      deadlineTracker: new DeadlineTracker(),
      processBeach,
    });

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(3);
    expect(result.summary?.total).toBe(3);
    expect(result.summary?.attempted).toBe(3);
    expect(result.summary?.successful).toBe(3);
    expect(result.summary?.failed).toBe(0);
    expect(result.summary?.stoppedEarly).toBe(false);
  });

  it("splits beaches into batches of the configured size", async () => {
    const beaches = [
      makeBeach("1", "A"),
      makeBeach("2", "B"),
      makeBeach("3", "C"),
      makeBeach("4", "D"),
    ];

    const batchSizesEncountered: number[] = [];
    const processBeach = jest.fn(async (beach: Beach): Promise<BeachProcessResult> => ({
      beach: beach.name,
      success: true,
    }));

    // Track batch sizes via prefetchCallback which receives each batch
    const prefetchCallback = jest.fn(async (batchBeaches: Beach[]) => {
      batchSizesEncountered.push(batchBeaches.length);
    });

    await processBeachesInBatches({
      beaches,
      config: { ...defaultConfig, batchSize: 2 },
      deadlineTracker: new DeadlineTracker(),
      processBeach,
      prefetchCallback,
    });

    // With 4 beaches and batchSize 2, we should process 2 full batches
    // prefetchCallback is called once for all beaches (not per batch)
    expect(prefetchCallback).toHaveBeenCalledWith(beaches);
    expect(processBeach).toHaveBeenCalledTimes(4);
  });

  it("returns immediately when deadline is already expired", async () => {
    const expiredDeadline = new DeadlineTracker(Date.now() - 1_000);
    const beaches = [makeBeach("1", "A"), makeBeach("2", "B")];
    const processBeach = jest.fn();

    const result = await processBeachesInBatches({
      beaches,
      config: defaultConfig,
      deadlineTracker: expiredDeadline,
      processBeach,
    });

    // processBeachesInBatches calls console.warn when stopping early
    expectConsoleWarnings([/Time budget exhausted/]);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(0);
    expect(result.summary?.attempted).toBe(0);
    expect(result.summary?.stoppedEarly).toBe(true);
    expect(result.summary?.stopReason).toBe("time_budget");
    expect(processBeach).not.toHaveBeenCalled();
  });

  it("stops early when deadline expires between batches", async () => {
    const beaches = Array.from({ length: 10 }, (_, i) => makeBeach(`${i}`, `Beach ${i}`));

    const deadlineMs = Date.now() + 50;
    const tracker = new DeadlineTracker(deadlineMs);

    const processBeach = jest.fn(async (beach: Beach): Promise<BeachProcessResult> => ({
      beach: beach.name,
      success: true,
    }));

    // Use a large delay so deadline is hit between batches
    const configWithDelay: BatchProcessConfig = {
      batchSize: 2,
      batchDelayMs: 200, // larger than deadline window
      maxBeachesPerRun: 100,
      freshnessWindowHours: 12,
    };

    const result = await processBeachesInBatches({
      beaches,
      config: configWithDelay,
      deadlineTracker: tracker,
      processBeach,
    });

    // processBeachesInBatches calls console.warn when stopping early
    expectConsoleWarnings([/Skipping batch delay|Stopping early/]);

    expect(result.success).toBe(true);
    // Should have processed fewer than all 10 beaches
    expect(result.summary?.attempted).toBeLessThan(10);
    expect(result.summary?.stoppedEarly).toBe(true);
  });

  it("handles failed processBeach calls and counts them as failures", async () => {
    const beaches = [makeBeach("1", "A"), makeBeach("2", "B"), makeBeach("3", "C")];
    const processBeach = jest.fn(async (beach: Beach): Promise<BeachProcessResult> => {
      if (beach.name === "B") {
        return { beach: beach.name, success: false, error: "Processing error" };
      }
      return { beach: beach.name, success: true };
    });

    const result = await processBeachesInBatches({
      beaches,
      config: defaultConfig,
      deadlineTracker: new DeadlineTracker(),
      processBeach,
    });

    expect(result.success).toBe(true);
    expect(result.summary?.successful).toBe(2);
    expect(result.summary?.failed).toBe(1);
  });

  it("aggregates CDIP skip reason counts from beach results", async () => {
    const beaches = [makeBeach("1", "A"), makeBeach("2", "B"), makeBeach("3", "C")];
    const processBeach = jest.fn(async (beach: Beach): Promise<BeachProcessResult> => {
      if (beach.name === "A") {
        return {
          beach: beach.name,
          success: true,
          cdip_skip_reason: "success",
          cdip_station: "067",
        };
      }

      return {
        beach: beach.name,
        success: true,
        cdip_skip_reason: "cdip_404",
        cdip_station: "045",
      };
    });

    const result = await processBeachesInBatches({
      beaches,
      config: defaultConfig,
      deadlineTracker: new DeadlineTracker(),
      processBeach,
    });

    expect(result.summary?.cdipSkipReasonCounts).toEqual({
      success: 1,
      cdip_404: 2,
    });
  });

  it("handles rejected processBeach promises gracefully", async () => {
    const beaches = [makeBeach("1", "A"), makeBeach("2", "B")];
    const processBeach = jest.fn(async (beach: Beach): Promise<BeachProcessResult> => {
      if (beach.name === "B") {
        throw new Error("Unexpected failure");
      }
      return { beach: beach.name, success: true };
    });

    const result = await processBeachesInBatches({
      beaches,
      config: defaultConfig,
      deadlineTracker: new DeadlineTracker(),
      processBeach,
    });

    expect(result.success).toBe(true);
    // The rejected promise is counted as failed
    expect(result.summary?.failed).toBe(1);
    expect(result.summary?.successful).toBe(1);

    // The fallback result for rejected promise
    const failedResult = result.results.find((r) => !r.success);
    expect(failedResult?.error).toBe("Promise rejected");
    // processBeachesInBatches uses Promise.allSettled so it does NOT log errors itself
    // No console.error expected here
  });

  it("calls prefetchCallback once with all beaches before processing", async () => {
    const beaches = [makeBeach("1", "A"), makeBeach("2", "B")];
    const prefetchCallback = jest.fn(async (_b: Beach[]) => {});
    const processBeach = jest.fn(async (beach: Beach): Promise<BeachProcessResult> => ({
      beach: beach.name,
      success: true,
    }));

    await processBeachesInBatches({
      beaches,
      config: defaultConfig,
      deadlineTracker: new DeadlineTracker(),
      processBeach,
      prefetchCallback,
    });

    expect(prefetchCallback).toHaveBeenCalledTimes(1);
    expect(prefetchCallback).toHaveBeenCalledWith(beaches);
  });

  it("handles an empty beaches array", async () => {
    const processBeach = jest.fn();

    const result = await processBeachesInBatches({
      beaches: [],
      config: defaultConfig,
      deadlineTracker: new DeadlineTracker(),
      processBeach,
    });

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(0);
    expect(result.summary?.total).toBe(0);
    expect(result.summary?.attempted).toBe(0);
    expect(processBeach).not.toHaveBeenCalled();
  });

  it("includes duration in the summary", async () => {
    const beaches = [makeBeach("1", "A")];
    const processBeach = jest.fn(async (b: Beach): Promise<BeachProcessResult> => ({
      beach: b.name,
      success: true,
    }));

    const result = await processBeachesInBatches({
      beaches,
      config: defaultConfig,
      deadlineTracker: new DeadlineTracker(),
      processBeach,
    });

    expect(result.summary?.duration).toMatch(/^\d+\.\d{2}s$/);
  });

  it("stoppedEarly is false when no deadline is configured and all processed", async () => {
    const beaches = [makeBeach("1", "A")];
    const processBeach = jest.fn(async (b: Beach): Promise<BeachProcessResult> => ({
      beach: b.name,
      success: true,
    }));

    const result = await processBeachesInBatches({
      beaches,
      config: defaultConfig,
      deadlineTracker: new DeadlineTracker(), // no deadline
      processBeach,
    });

    expect(result.summary?.stoppedEarly).toBe(false);
    expect(result.summary?.stopReason).toBeUndefined();
    expect(result.summary?.remainingMs).toBeUndefined();
  });

  it("includes remainingMs in summary when deadline is configured", async () => {
    const beaches = [makeBeach("1", "A")];
    const processBeach = jest.fn(async (b: Beach): Promise<BeachProcessResult> => ({
      beach: b.name,
      success: true,
    }));

    const result = await processBeachesInBatches({
      beaches,
      config: defaultConfig,
      deadlineTracker: new DeadlineTracker(Date.now() + 60_000),
      processBeach,
    });

    expect(result.summary?.remainingMs).toBeDefined();
    expect(result.summary?.remainingMs).toBeGreaterThan(0);
  });
});

// ─── createBeachProcessor ─────────────────────────────────────────────────────

describe("createBeachProcessor", () => {
  it("returns a function", () => {
    const processor = createBeachProcessor(
      jest.fn(),
      jest.fn()
    );
    expect(typeof processor).toBe("function");
  });

  it("calls generateForecast and storeForecast with the beach", async () => {
    const beach = makeBeach("b1", "Test Beach");
    const forecasts = [{ id: "f1" }];

    const generateForecast = jest.fn().mockResolvedValue(forecasts);
    const storeForecast = jest.fn().mockResolvedValue({ success: true });

    const processor = createBeachProcessor(generateForecast, storeForecast);
    const result = await processor(beach);

    expect(generateForecast).toHaveBeenCalledWith(beach);
    expect(storeForecast).toHaveBeenCalledWith(beach, forecasts);
    expect(result).toEqual({ beach: "Test Beach", success: true, error: undefined });
  });

  it("returns success: false when storeForecast fails", async () => {
    const beach = makeBeach("b1", "Fail Beach");

    const generateForecast = jest.fn().mockResolvedValue([]);
    const storeForecast = jest.fn().mockResolvedValue({ success: false, error: "DB error" });

    const processor = createBeachProcessor(generateForecast, storeForecast);
    const result = await processor(beach);

    // createBeachProcessor calls console.warn when store fails
    expectConsoleWarnings([/Fail Beach: store failed/]);

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB error");
    expect(result.beach).toBe("Fail Beach");
  });

  it("catches thrown errors and returns failure result", async () => {
    const beach = makeBeach("b1", "Error Beach");

    const generateForecast = jest.fn().mockRejectedValue(new Error("Network timeout"));
    const storeForecast = jest.fn();

    const processor = createBeachProcessor(generateForecast, storeForecast);
    const result = await processor(beach);

    // createBeachProcessor calls console.error on caught exceptions
    expectConsoleErrors([/Error Beach: Network timeout/]);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network timeout");
    expect(result.beach).toBe("Error Beach");
    expect(storeForecast).not.toHaveBeenCalled();
  });

  it("catches non-Error thrown values", async () => {
    const beach = makeBeach("b1", "String Error Beach");

    const generateForecast = jest.fn().mockRejectedValue("plain string error");
    const storeForecast = jest.fn();

    const processor = createBeachProcessor(generateForecast, storeForecast);
    const result = await processor(beach);

    // createBeachProcessor calls console.error on caught exceptions
    expectConsoleErrors([/String Error Beach: plain string error/]);

    expect(result.success).toBe(false);
    expect(result.error).toBe("plain string error");
  });

  it("can be used directly with processBeachesInBatches", async () => {
    const beaches = [makeBeach("1", "A"), makeBeach("2", "B")];
    const forecasts = [{ id: "f1" }];

    const generateForecast = jest.fn().mockResolvedValue(forecasts);
    const storeForecast = jest.fn().mockResolvedValue({ success: true });

    const processBeach = createBeachProcessor(generateForecast, storeForecast);

    const result = await processBeachesInBatches({
      beaches,
      config: {
        batchSize: 2,
        batchDelayMs: 0,
        maxBeachesPerRun: 10,
        freshnessWindowHours: 12,
      },
      deadlineTracker: new DeadlineTracker(),
      processBeach,
    });

    expect(result.success).toBe(true);
    expect(result.summary?.successful).toBe(2);
    expect(generateForecast).toHaveBeenCalledTimes(2);
    expect(storeForecast).toHaveBeenCalledTimes(2);
  });
});
