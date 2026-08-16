/**
 * API retry and backoff utilities for NOAA and CDIP calls
 * Implements exponential backoff with jitter and circuit breaker patterns
 */

import { ApiError } from "@/lib/errors/forecast-errors";

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBase?: number;
  jitter?: boolean;
  timeout?: number;
  retryCondition?: (error: any) => boolean;
  circuitBreakerKey?: string;
  shouldTripCircuit?: (error: unknown) => boolean;
}

interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeoutMs?: number;
  monitoringPeriodMs?: number;
}

export class CircuitBreakerOpenError extends Error {
  readonly circuitBreakerKey: string;

  constructor(circuitBreakerKey: string) {
    super(`Circuit breaker is OPEN for ${circuitBreakerKey} - service temporarily unavailable`);
    this.name = "CircuitBreakerOpenError";
    this.circuitBreakerKey = circuitBreakerKey;
  }
}

export function isCircuitBreakerOpenError(error: unknown): error is CircuitBreakerOpenError {
  return error instanceof CircuitBreakerOpenError;
}

class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(private options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: 5,
      recoveryTimeoutMs: 60000, // 1 minute
      monitoringPeriodMs: 300000, // 5 minutes
      ...options,
    };
  }

  async execute<T>(
    breakerKey: string,
    fn: () => Promise<T>,
    shouldTripCircuit: (error: unknown) => boolean
  ): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.options.recoveryTimeoutMs!) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerOpenError(breakerKey);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      if (shouldTripCircuit(error)) {
        this.onFailure();
      }
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.options.failureThreshold!) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return this.state;
  }

  getFailureCount() {
    return this.failureCount;
  }
}

export class RetryableAPIClient {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(private defaultOptions: RetryOptions = {}) {
    this.defaultOptions = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      exponentialBase: 2,
      jitter: true,
      timeout: 30000,
      retryCondition: (error) => this.isRetryableError(error),
      ...defaultOptions,
    };
  }

  private getCircuitBreaker(circuitBreakerKey: string): CircuitBreaker {
    if (!this.circuitBreakers.has(circuitBreakerKey)) {
      this.circuitBreakers.set(circuitBreakerKey, new CircuitBreaker({
        failureThreshold: circuitBreakerKey.includes('CDIP') ? 3 : 5, // CDIP is more sensitive
        recoveryTimeoutMs: circuitBreakerKey.includes('CDIP') ? 120000 : 60000, // 2min for CDIP, 1min for NOAA
      }));
    }
    return this.circuitBreakers.get(circuitBreakerKey)!;
  }

  private isRetryableError(error: any): boolean {
    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true;
    }

    // HTTP status codes that should be retried
    if (error.status) {
      const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
      return retryableStatusCodes.includes(error.status);
    }

    // Timeout errors
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return true;
    }

    // Rate limiting
    if (error.message?.toLowerCase().includes('rate limit')) {
      return true;
    }

    return false;
  }

  private shouldTripCDIPCircuit(error: unknown): boolean {
    if (isCircuitBreakerOpenError(error)) {
      return false;
    }

    const candidate = error as { name?: string; message?: string; status?: number };
    const message = candidate.message ?? "";

    if (candidate.name === "TypeError" && message.includes("fetch")) {
      return true;
    }

    if (candidate.name === "AbortError" || message.toLowerCase().includes("timeout")) {
      return true;
    }

    if (message.toLowerCase().includes("rate limit")) {
      return true;
    }

    if (candidate.status) {
      return candidate.status === 408 || candidate.status === 429 || candidate.status >= 500;
    }

    return false;
  }

  private isDeterministicCDIPStatus(serviceName: string, error: unknown): boolean {
    const status = (error as { status?: unknown })?.status;
    return serviceName === "CDIP" && (status === 400 || status === 404);
  }

  private calculateDelay(attempt: number, options: RetryOptions): number {
    const base = options.exponentialBase || 2;
    const baseDelay = options.baseDelay || 1000;
    const maxDelay = options.maxDelay || 30000;

    let delay = baseDelay * Math.pow(base, attempt);
    
    if (options.jitter) {
      // Add ±25% jitter to prevent thundering herd
      const jitterRange = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }

    return Math.min(delay, maxDelay);
  }

  private createTimeoutSignal(timeoutMs: number): {
    clear: () => void;
    signal: AbortSignal;
  } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return {
      clear: () => clearTimeout(timeoutId),
      signal: controller.signal,
    };
  }

  async fetchWithRetry(
    serviceName: string,
    url: string,
    options: RequestInit = {},
    retryOptions: RetryOptions = {}
  ): Promise<Response> {
    const finalOptions = { ...this.defaultOptions, ...retryOptions };
    const circuitBreakerKey = finalOptions.circuitBreakerKey ?? serviceName;
    const shouldTripCircuit = finalOptions.shouldTripCircuit ?? (() => true);
    const circuitBreaker = this.getCircuitBreaker(circuitBreakerKey);
    
    return circuitBreaker.execute(circuitBreakerKey, async () => {
      let lastError: any;

      for (let attempt = 0; attempt <= finalOptions.maxRetries!; attempt++) {
        try {
          // Add timeout to fetch options
          const timeoutSignal = this.createTimeoutSignal(finalOptions.timeout!);
          const fetchOptions: RequestInit = {
            ...options,
            signal: timeoutSignal.signal,
          };

          console.log(`[${serviceName}] Attempt ${attempt + 1}/${finalOptions.maxRetries! + 1} for ${url}`);
          
          let response: Response;
          try {
            response = await fetch(url, fetchOptions);
          } finally {
            timeoutSignal.clear();
          }
          
          // Check if response indicates a retryable error
          if (!response.ok) {
            // For NOAA, read response text to enable proper error classification (e.g. InvalidPoint detection)
            let responseText = "";
            if (serviceName === "NOAA") {
              try {
                responseText = await response.clone().text();
              } catch {
                // ignore
              }
            }
            
            // Use ApiError for NOAA so isNoaaInvalidPointError() can classify it
            const error = serviceName === "NOAA"
              ? new ApiError(url, response.status, responseText)
              : Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), {
                  status: response.status,
                  url,
                  responseText,
                });
            (error as any).status = response.status;
            
            if (finalOptions.retryCondition!(error) && attempt < finalOptions.maxRetries!) {
              lastError = error;
              console.warn(`[${serviceName}] Retryable error on attempt ${attempt + 1}: ${error.message}`);
              await this.delay(this.calculateDelay(attempt, finalOptions));
              continue;
            }
            
            throw error;
          }

          console.log(`[${serviceName}] Success on attempt ${attempt + 1}`);
          return response;

        } catch (error) {
          lastError = error;
          
          if (finalOptions.retryCondition!(error) && attempt < finalOptions.maxRetries!) {
            const delayMs = this.calculateDelay(attempt, finalOptions);
            console.warn(`[${serviceName}] Error on attempt ${attempt + 1}, retrying in ${delayMs}ms:`, error);
            await this.delay(delayMs);
            continue;
          }

          // Max retries reached or non-retryable error
          // Downgrade log level for expected NOAA 404s on /points/ (off-coverage locations like Mexico)
          const status = (error as any)?.status;
          const isExpectedNoaa404 =
            serviceName === "NOAA" &&
            status === 404 &&
            url.includes("api.weather.gov/points/");
          
          if (isExpectedNoaa404) {
            console.warn(`[${serviceName}] No coverage for point (404 on /points/): ${url}`);
          } else if (this.isDeterministicCDIPStatus(serviceName, error)) {
            console.warn(`[${serviceName}] Station data unavailable (${status}): ${url}`);
          } else {
            console.error(`[${serviceName}] Failed after ${attempt + 1} attempts:`, error);
          }
          throw error;
        }
      }

      throw lastError;
    }, shouldTripCircuit);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods for specific services
  async fetchNOAAData(url: string, options: RequestInit = {}, retryOptions: RetryOptions = {}): Promise<Response> {
    const noaaOptions: RequestInit = {
      headers: {
        'User-Agent': 'quiver-surf-app/1.0 (contact@quiver-surf.com)',
        ...options.headers,
      },
      ...options,
    };

    const noaaRetryOptions: RetryOptions = {
      maxRetries: 3,
      baseDelay: 2000, // NOAA can be slower
      maxDelay: 15000,
      ...retryOptions,
    };

    return this.fetchWithRetry('NOAA', url, noaaOptions, noaaRetryOptions);
  }

  async fetchCDIPData(url: string, options: RequestInit = {}, retryOptions: RetryOptions = {}): Promise<Response> {
    const cdipOptions: RequestInit = {
      headers: {
        'User-Agent': 'quiver-surf-app/1.0 (contact@quiver-surf.com)',
        'Accept': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    const cdipRetryOptions: RetryOptions = {
      maxRetries: 2, // CDIP is more sensitive to load
      baseDelay: 1000,
      maxDelay: 10000,
      shouldTripCircuit: (error) => this.shouldTripCDIPCircuit(error),
      ...retryOptions,
    };

    return this.fetchWithRetry('CDIP', url, cdipOptions, cdipRetryOptions);
  }

  // Get circuit breaker status for monitoring
  getServiceStatus() {
    const status: Record<string, any> = {};
    
    for (const [service, breaker] of this.circuitBreakers) {
      status[service] = {
        state: breaker.getState(),
        failureCount: breaker.getFailureCount(),
      };
    }
    
    return status;
  }
}

// Global instance for reuse across the application
export const apiClient = new RetryableAPIClient({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitter: true,
  timeout: 30000,
});
