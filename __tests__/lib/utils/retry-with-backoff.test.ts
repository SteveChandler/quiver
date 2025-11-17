/**
 * Tests for retry with exponential backoff utility
 */

import {
  retryWithBackoff,
  isRetryableError,
  createRetryFn,
  retryForecastFetch,
} from "@/lib/utils/retry-with-backoff";

// Mock setTimeout for testing
jest.useFakeTimers();

describe("retryWithBackoff", () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it("should succeed on first attempt", async () => {
    const fn = jest.fn().mockResolvedValue("success");

    const result = await retryWithBackoff(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and eventually succeed", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("success");

    const promise = retryWithBackoff(fn, { maxRetries: 3, baseDelay: 100 });

    // Fast-forward through delays
    for (let i = 0; i < 2; i++) {
      await jest.runAllTimersAsync();
    }

    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw after max retries", async () => {
    const error = new Error("persistent failure");
    const fn = jest.fn().mockRejectedValue(error);

    const promise = retryWithBackoff(fn, { maxRetries: 2, baseDelay: 100 });

    // Fast-forward through all delays and catch the error
    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow("persistent failure");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("should use exponential backoff", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("fail"));
    const onRetry = jest.fn();

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelay: 1000,
      exponentialBase: 2,
      jitter: false, // Disable jitter for predictable testing
      onRetry,
    });

    // Fast-forward through all retries and catch the error
    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow();

    // Check that delays increased exponentially
    expect(onRetry).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, 1000); // 1000 * 2^0
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, 2000); // 1000 * 2^1
    expect(onRetry).toHaveBeenNthCalledWith(3, 3, 4000); // 1000 * 2^2
  });

  it("should respect max delay", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("fail"));
    const onRetry = jest.fn();

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 2500,
      exponentialBase: 2,
      jitter: false,
      onRetry,
    });

    // Fast-forward through all retries and catch the error
    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow();

    // Check that delay was clamped to maxDelay
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, 1000); // 1000 * 2^0
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, 2000); // 1000 * 2^1
    expect(onRetry).toHaveBeenNthCalledWith(3, 3, 2500); // clamped from 4000
  });

  it("should not retry non-retryable errors", async () => {
    const error = new Error("non-retryable");
    const fn = jest.fn().mockRejectedValue(error);
    const shouldRetry = jest.fn().mockReturnValue(false);

    const promise = retryWithBackoff(fn, { shouldRetry });

    await expect(promise).rejects.toThrow("non-retryable");
    expect(fn).toHaveBeenCalledTimes(1); // No retries
    expect(shouldRetry).toHaveBeenCalledWith(error);
  });

  it("should call onRetry callback", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("success");
    const onRetry = jest.fn();

    const promise = retryWithBackoff(fn, {
      maxRetries: 1,
      baseDelay: 100,
      jitter: false,
      onRetry,
    });

    await jest.runAllTimersAsync();
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, 100);
  });
});

describe("isRetryableError", () => {
  it("should return true for fetch errors", () => {
    const error = new TypeError("fetch failed");
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return true for timeout errors", () => {
    const error = new Error("timeout exceeded");
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return true for AbortError", () => {
    const error = new Error();
    error.name = "AbortError";
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return true for retryable HTTP status codes", () => {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];

    retryableStatuses.forEach((status) => {
      const error = new Error(`HTTP ${status}`);
      (error as any).status = status;
      expect(isRetryableError(error)).toBe(true);
    });
  });

  it("should return false for non-retryable HTTP status codes", () => {
    const nonRetryableStatuses = [400, 401, 403, 404];

    nonRetryableStatuses.forEach((status) => {
      const error = new Error(`HTTP ${status}`);
      (error as any).status = status;
      expect(isRetryableError(error)).toBe(false);
    });
  });

  it("should return true for rate limit errors", () => {
    const error = new Error("rate limit exceeded");
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return false for unknown errors", () => {
    const error = new Error("unknown error");
    expect(isRetryableError(error)).toBe(false);
  });
});

describe("createRetryFn", () => {
  it("should create retry function with default options", async () => {
    const retryFn = createRetryFn({ maxRetries: 2, baseDelay: 100 });
    const fn = jest.fn().mockResolvedValue("success");

    const result = await retryFn(fn);

    expect(result).toBe("success");
  });

  it("should allow override options", async () => {
    const retryFn = createRetryFn({ maxRetries: 1 });
    const fn = jest.fn().mockRejectedValue(new Error("fail"));

    const promise = retryFn(fn, { maxRetries: 3 });

    await jest.runAllTimersAsync();

    await expect(promise).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries (override)
  });
});

describe("retryForecastFetch", () => {
  it("should use sensible defaults for forecast fetches", async () => {
    const fn = jest.fn().mockResolvedValue({ data: "forecast" });

    const result = await retryForecastFetch(fn);

    expect(result).toEqual({ data: "forecast" });
  });

  it("should retry retryable errors", async () => {
    const error = new Error("fetch failed");
    const fn = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ data: "forecast" });

    const promise = retryForecastFetch(fn);

    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ data: "forecast" });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should not retry non-retryable errors", async () => {
    const error = new Error("not found");
    (error as any).status = 404;
    const fn = jest.fn().mockRejectedValue(error);

    const promise = retryForecastFetch(fn);

    await expect(promise).rejects.toThrow("not found");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
