/**
 * Shared utilities for communicating with the Python ML service.
 *
 * Used by cron routes that call the ML service (correct-forecasts, extract-hrrr-wind).
 */

/**
 * Fetch with exponential backoff retry for ML service calls.
 * Retries on 5xx errors and network failures.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err as Error;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt))
      );
    }
  }

  throw lastError;
}

/**
 * Wake up the ML service (handles Render cold start).
 * Reads ML_SERVICE_URL from process.env at call time (not module scope)
 * so the env var is always fresh.
 */
export async function wakeUpService(): Promise<boolean> {
  const mlServiceUrl = process.env.ML_SERVICE_URL;
  if (!mlServiceUrl) return false;

  try {
    const response = await fetch(`${mlServiceUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000), // 15s timeout for cold start
    });
    return response.ok;
  } catch {
    return false;
  }
}
