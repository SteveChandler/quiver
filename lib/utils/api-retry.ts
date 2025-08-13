/**
 * API retry and backoff utilities for NOAA and CDIP calls
 * Implements exponential backoff with jitter and circuit breaker patterns
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBase?: number;
  jitter?: boolean;
  timeout?: number;
  retryCondition?: (error: any) => boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeoutMs?: number;
  monitoringPeriodMs?: number;
}

export class CircuitBreaker {
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

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.options.recoveryTimeoutMs!) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
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

  private getCircuitBreaker(service: string): CircuitBreaker {
    if (!this.circuitBreakers.has(service)) {
      this.circuitBreakers.set(service, new CircuitBreaker({
        failureThreshold: service.includes('CDIP') ? 3 : 5, // CDIP is more sensitive
        recoveryTimeoutMs: service.includes('CDIP') ? 120000 : 60000, // 2min for CDIP, 1min for NOAA
      }));
    }
    return this.circuitBreakers.get(service)!;
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

  private createTimeoutSignal(timeoutMs: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  }

  async fetchWithRetry(
    serviceName: string,
    url: string,
    options: RequestInit = {},
    retryOptions: RetryOptions = {}
  ): Promise<Response> {
    const finalOptions = { ...this.defaultOptions, ...retryOptions };
    const circuitBreaker = this.getCircuitBreaker(serviceName);
    
    return circuitBreaker.execute(async () => {
      let lastError: any;

      for (let attempt = 0; attempt <= finalOptions.maxRetries!; attempt++) {
        try {
          // Add timeout to fetch options
          const timeoutSignal = this.createTimeoutSignal(finalOptions.timeout!);
          const fetchOptions: RequestInit = {
            ...options,
            signal: timeoutSignal,
          };

          console.log(`[${serviceName}] Attempt ${attempt + 1}/${finalOptions.maxRetries! + 1} for ${url}`);
          
          const response = await fetch(url, fetchOptions);
          
          // Check if response indicates a retryable error
          if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
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
          console.error(`[${serviceName}] Failed after ${attempt + 1} attempts:`, error);
          throw error;
        }
      }

      throw lastError;
    });
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