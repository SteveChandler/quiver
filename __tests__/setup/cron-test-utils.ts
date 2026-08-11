/**
 * Cron Job Testing Utilities for Quiver
 *
 * Provides reusable utilities for testing cron API routes following
 * established patterns from lib/api-utils.ts and test-utils/api-test-helpers.ts.
 *
 * @example
 * ```typescript
 * import {
 *   mockCronAuth,
 *   createCronRequest,
 *   mockExternalAPI,
 *   verifyIdempotency,
 *   CronTestEnvironment,
 * } from "@/__tests__/setup/cron-test-utils";
 *
 * describe("My Cron Job", () => {
 *   let cronEnv: CronTestEnvironment;
 *
 *   beforeEach(() => {
 *     cronEnv = setupCronTestEnvironment();
 *   });
 *
 *   afterEach(() => {
 *     cronEnv.cleanup();
 *   });
 *
 *   it("runs with valid cron auth", async () => {
 *     const request = createCronRequest("/api/cron/my-job");
 *     const response = await GET(request);
 *     expect(response.status).toBe(200);
 *   });
 * });
 * ```
 */

import { NextRequest } from "next/server";

// ============================================================================
// Types
// ============================================================================

type MockFn<T = any, Y extends any[] = any[]> = jest.Mock<T, Y>;

/**
 * Supported external services for mocking
 */
export type ExternalService = "noaa" | "cdip" | "email" | "resend" | "openai";

/**
 * Mock behavior types for external services
 */
export type MockBehavior = "success" | "timeout" | "error" | "rate-limited";

/**
 * Cron authentication method types
 */
export type CronAuthMethod = "bearer-token" | "none";

/**
 * Configuration for external API mocks
 */
export interface ExternalAPIMockConfig {
  service: ExternalService;
  behavior: MockBehavior;
  /** Custom response data for success scenarios */
  data?: any;
  /** Custom error message for error scenarios */
  errorMessage?: string;
  /** Delay in ms for simulating slow responses */
  delay?: number;
}

/**
 * Result of idempotency verification
 */
export interface IdempotencyResult {
  isIdempotent: boolean;
  firstResponse: any;
  secondResponse: any;
  differences?: string[];
}

/**
 * Cron test environment configuration
 */
export interface CronTestEnvironmentConfig {
  /** CRON_SECRET value (default: "test-cron-secret") */
  cronSecret?: string;
  /** VERCEL_ENV value (default: "production") */
  vercelEnv?: string;
  /** Additional environment variables to set */
  additionalEnvVars?: Record<string, string>;
}

/**
 * Cron test environment with cleanup
 */
export interface CronTestEnvironment {
  cronSecret: string;
  cleanup: () => void;
  /** Reset mocks but keep environment */
  resetMocks: () => void;
}

// ============================================================================
// Environment Setup
// ============================================================================

/**
 * Sets up a test environment for cron job testing.
 * Configures CRON_SECRET, VERCEL_ENV, and other required env vars.
 *
 * @param config - Environment configuration options
 * @returns CronTestEnvironment with cleanup function
 *
 * @example
 * ```typescript
 * const env = setupCronTestEnvironment();
 * // ... run tests ...
 * env.cleanup();
 * ```
 */
export function setupCronTestEnvironment(
  config: CronTestEnvironmentConfig = {}
): CronTestEnvironment {
  const {
    cronSecret = "test-cron-secret",
    vercelEnv = "production",
    additionalEnvVars = {},
  } = config;

  // Store original values
  const originalEnv: Record<string, string | undefined> = {
    CRON_SECRET: process.env.CRON_SECRET,
    VERCEL_ENV: process.env.VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
  };

  // Store additional vars' originals
  Object.keys(additionalEnvVars).forEach((key) => {
    originalEnv[key] = process.env[key];
  });

  // Set test values
  process.env.CRON_SECRET = cronSecret;
  process.env.VERCEL_ENV = vercelEnv;
  // Use Object.defineProperty to bypass read-only restriction on NODE_ENV
  Object.defineProperty(process.env, "NODE_ENV", {
    value: "test",
    writable: true,
    configurable: true,
  });

  // Set additional vars
  Object.entries(additionalEnvVars).forEach(([key, value]) => {
    process.env[key] = value;
  });

  const cleanup = () => {
    // Restore original values
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  };

  const resetMocks = () => {
    jest.clearAllMocks();
  };

  return {
    cronSecret,
    cleanup,
    resetMocks,
  };
}

// ============================================================================
// Cron Authentication Utilities
// ============================================================================

/**
 * Mocks the CRON_SECRET environment variable for testing.
 *
 * @param valid - If true, sets a valid secret; if false, sets an invalid one
 * @param customSecret - Optional custom secret value
 * @returns Cleanup function to restore original value
 *
 * @example
 * ```typescript
 * const restore = mockCronAuth(true);
 * // ... test with valid auth ...
 * restore();
 * ```
 */
export function mockCronAuth(
  valid: boolean = true,
  customSecret?: string
): () => void {
  const originalSecret = process.env.CRON_SECRET;

  if (valid) {
    process.env.CRON_SECRET = customSecret || "test-cron-secret";
  } else {
    // Clear the secret so validation will fail
    delete process.env.CRON_SECRET;
  }

  return () => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  };
}

/**
 * Options for creating cron requests
 */
export interface CronRequestOptions {
  /** HTTP method (default: "GET") */
  method?: "GET" | "POST" | "HEAD";
  /** Authentication method (default: "bearer-token") */
  authMethod?: CronAuthMethod;
  /** Custom cron secret for bearer auth (default: "test-cron-secret") */
  cronSecret?: string;
  /** Request body for POST requests */
  body?: any;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Query parameters */
  searchParams?: Record<string, string>;
  /** Base URL (default: "http://localhost:3000") */
  baseUrl?: string;
}

/**
 * Builds URL and headers for cron requests (shared logic)
 */
function buildCronRequestConfig(path: string, options: CronRequestOptions = {}) {
  const {
    method = "GET",
    authMethod = "bearer-token",
    cronSecret = "test-cron-secret",
    body,
    headers = {},
    searchParams = {},
    baseUrl = "http://localhost:3000",
  } = options;

  // Build URL with search params
  const url = new URL(path, baseUrl);
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  // Build headers based on auth method
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  switch (authMethod) {
    case "bearer-token":
      requestHeaders["authorization"] = `Bearer ${cronSecret}`;
      break;
    case "none":
      // No auth headers
      break;
  }

  return { url, method, requestHeaders, body };
}

/**
 * Creates a NextRequest object configured with cron authentication headers.
 * NOTE: In Jest environments, NextRequest may not work due to constructor issues.
 * Use createMockCronRequest instead for Jest tests.
 *
 * @param path - The API path (e.g., "/api/cron/forecast-sync")
 * @param options - Additional request options
 * @returns Configured NextRequest for cron testing
 *
 * @example
 * ```typescript
 * // With Bearer token
 * const request = createCronRequest("/api/cron/my-job");
 *
 * // With a custom Bearer token
 * const request = createCronRequest("/api/cron/my-job", {
 *   authMethod: "bearer-token",
 *   cronSecret: "my-secret",
 * });
 *
 * // With custom body
 * const request = createCronRequest("/api/cron/my-job", {
 *   method: "POST",
 *   body: { foo: "bar" },
 * });
 * ```
 */
export function createCronRequest(
  path: string,
  options: CronRequestOptions = {}
): NextRequest {
  const { url, method, requestHeaders, body } = buildCronRequestConfig(path, options);

  return new NextRequest(url.toString(), {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Creates a mock request object with minimal implementation for testing.
 * Use this when you need to bypass NextRequest constructor issues in Jest.
 *
 * @param path - The API path
 * @param options - Request configuration
 * @returns Mock request object compatible with cron routes
 */
export function createMockCronRequest(
  path: string,
  options: {
    method?: "GET" | "POST" | "HEAD";
    authMethod?: CronAuthMethod;
    cronSecret?: string;
    body?: any;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
    baseUrl?: string;
  } = {}
): Request {
  const {
    method = "GET",
    authMethod = "bearer-token",
    cronSecret = "test-cron-secret",
    body,
    headers = {},
    searchParams = {},
    baseUrl = "http://localhost:3000",
  } = options;

  // Build URL with search params
  const url = new URL(path, baseUrl);
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  // Build headers based on auth method
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  switch (authMethod) {
    case "bearer-token":
      requestHeaders["authorization"] = `Bearer ${cronSecret}`;
      break;
    case "none":
      // No auth headers
      break;
  }

  // Create a mock request that matches the Request interface
  const mockHeaders = new Headers(requestHeaders);
  const urlString = url.toString();

  const mockRequest = {
    url: urlString,
    method,
    headers: mockHeaders,
    json: jest.fn(() => Promise.resolve(body || {})),
    text: jest.fn(() => Promise.resolve(body ? JSON.stringify(body) : "")),
    // Add clone method for idempotency testing
    clone: function() {
      return createMockCronRequest(path, options);
    },
  };

  return mockRequest as unknown as Request;
}

// ============================================================================
// External API Mocking
// ============================================================================

/**
 * Default mock responses for external services
 */
const DEFAULT_MOCK_RESPONSES: Record<ExternalService, any> = {
  noaa: {
    properties: {
      periods: [
        {
          number: 1,
          temperature: 65,
          temperatureUnit: "F",
          windSpeed: "10 mph",
          windDirection: "W",
          shortForecast: "Partly Cloudy",
        },
      ],
    },
  },
  cdip: {
    meta: { stationId: "46253" },
    data: {
      waveHeight: 2.5,
      wavePeriod: 12,
      waveDirection: 270,
    },
  },
  email: {
    id: "email-123",
    status: "sent",
  },
  resend: {
    id: "resend-email-123",
    object: "email",
    to: ["test@example.com"],
    from: "noreply@quiversurf.app",
  },
  openai: {
    id: "chatcmpl-123",
    choices: [
      {
        message: {
          content: "Mock AI response",
          role: "assistant",
        },
      },
    ],
  },
};

/**
 * Error messages for different failure scenarios
 */
const DEFAULT_ERROR_MESSAGES: Record<MockBehavior, string> = {
  success: "",
  timeout: "Request timed out after 30000ms",
  error: "Internal server error",
  "rate-limited": "Rate limit exceeded. Please try again later.",
};

/**
 * Creates a mock for external API responses.
 *
 * @param service - The external service to mock (noaa, cdip, email, etc.)
 * @param behavior - The mock behavior (success, timeout, error, rate-limited)
 * @param config - Additional configuration options
 * @returns Mock function and cleanup
 *
 * @example
 * ```typescript
 * // Mock NOAA API success
 * const { mock, restore } = mockExternalAPI("noaa", "success");
 *
 * // Mock email service timeout
 * const { mock, restore } = mockExternalAPI("email", "timeout");
 *
 * // Mock with custom data
 * const { mock, restore } = mockExternalAPI("noaa", "success", {
 *   data: { custom: "data" },
 * });
 * ```
 */
export function mockExternalAPI(
  service: ExternalService,
  behavior: MockBehavior,
  config: Partial<ExternalAPIMockConfig> = {}
): { mock: MockFn; restore: () => void } {
  const { data, errorMessage, delay = 0 } = config;

  const mockFn = jest.fn(async () => {
    // Simulate network delay
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    switch (behavior) {
      case "success":
        return data || DEFAULT_MOCK_RESPONSES[service];

      case "timeout":
        throw new Error(errorMessage || DEFAULT_ERROR_MESSAGES.timeout);

      case "error":
        throw new Error(errorMessage || DEFAULT_ERROR_MESSAGES.error);

      case "rate-limited":
        const rateLimitError = new Error(
          errorMessage || DEFAULT_ERROR_MESSAGES["rate-limited"]
        );
        (rateLimitError as any).status = 429;
        throw rateLimitError;

      default:
        throw new Error(`Unknown mock behavior: ${behavior}`);
    }
  });

  return {
    mock: mockFn,
    restore: () => mockFn.mockReset(),
  };
}

/**
 * Creates a fetch mock for testing external API calls.
 *
 * @param configs - Array of service configurations to mock
 * @returns Combined mock function and cleanup
 */
export function mockFetchForExternalAPIs(
  configs: ExternalAPIMockConfig[]
): { mock: MockFn; restore: () => void } {
  const originalFetch = global.fetch;

  const mockFetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
    const urlString = url.toString();

    for (const config of configs) {
      const { service, behavior, data, errorMessage, delay = 0 } = config;

      // Match URL patterns for different services
      const patterns: Record<ExternalService, RegExp> = {
        noaa: /api\.weather\.gov/,
        cdip: /cdip\.ucsd\.edu|thredds/,
        email: /resend\.com|sendgrid/,
        resend: /api\.resend\.com/,
        openai: /api\.openai\.com/,
      };

      if (patterns[service]?.test(urlString)) {
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        switch (behavior) {
          case "success":
            return new Response(
              JSON.stringify(data || DEFAULT_MOCK_RESPONSES[service]),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );

          case "timeout":
            throw new Error(errorMessage || DEFAULT_ERROR_MESSAGES.timeout);

          case "error":
            return new Response(
              JSON.stringify({ error: errorMessage || DEFAULT_ERROR_MESSAGES.error }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );

          case "rate-limited":
            return new Response(
              JSON.stringify({
                error: errorMessage || DEFAULT_ERROR_MESSAGES["rate-limited"],
              }),
              {
                status: 429,
                headers: {
                  "Content-Type": "application/json",
                  "Retry-After": "60",
                },
              }
            );
        }
      }
    }

    // Fall back to original fetch for unmatched URLs
    return originalFetch(url, init);
  });

  global.fetch = mockFetch as unknown as typeof fetch;

  return {
    mock: mockFetch,
    restore: () => {
      global.fetch = originalFetch;
    },
  };
}

// ============================================================================
// Idempotency Verification
// ============================================================================

/**
 * Verifies that a cron handler produces idempotent results when called multiple times.
 *
 * @param handler - The route handler function
 * @param request - The request to test with
 * @param options - Verification options
 * @returns IdempotencyResult with comparison details
 *
 * @example
 * ```typescript
 * const request = createCronRequest("/api/cron/my-job");
 * const result = await verifyIdempotency(GET, request);
 *
 * expect(result.isIdempotent).toBe(true);
 * ```
 */
export async function verifyIdempotency(
  handler: (request: Request | NextRequest) => Promise<Response>,
  request: Request | NextRequest,
  options: {
    /** Fields to ignore when comparing (e.g., timestamps) */
    ignoreFields?: string[];
    /** Custom comparison function */
    compareFn?: (a: any, b: any) => boolean;
  } = {}
): Promise<IdempotencyResult> {
  const { ignoreFields = ["timestamp", "executionId", "durationMs", "duration"], compareFn } =
    options;

  // Clone request for second call (NextRequest doesn't support clone)
  const cloneRequest = () => {
    if (request instanceof NextRequest) {
      return new NextRequest(request.url, {
        method: request.method,
        headers: request.headers,
      });
    }
    return request.clone();
  };

  // First call
  const response1 = await handler(request);
  const data1 = await response1.json();

  // Second call with cloned request
  const response2 = await handler(cloneRequest());
  const data2 = await response2.json();

  // Remove ignored fields for comparison
  const sanitize = (obj: any): any => {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(sanitize);

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!ignoreFields.includes(key)) {
        result[key] = sanitize(value);
      }
    }
    return result;
  };

  const sanitized1 = sanitize(data1);
  const sanitized2 = sanitize(data2);

  // Compare
  const isIdempotent = compareFn
    ? compareFn(sanitized1, sanitized2)
    : JSON.stringify(sanitized1) === JSON.stringify(sanitized2);

  // Find differences if not idempotent
  const differences: string[] = [];
  if (!isIdempotent) {
    const findDiffs = (obj1: any, obj2: any, path = ""): void => {
      const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
      for (const key of keys) {
        const fullPath = path ? `${path}.${key}` : key;
        if (JSON.stringify(obj1?.[key]) !== JSON.stringify(obj2?.[key])) {
          differences.push(
            `${fullPath}: ${JSON.stringify(obj1?.[key])} !== ${JSON.stringify(obj2?.[key])}`
          );
        }
      }
    };
    findDiffs(sanitized1, sanitized2);
  }

  return {
    isIdempotent,
    firstResponse: data1,
    secondResponse: data2,
    differences: differences.length > 0 ? differences : undefined,
  };
}

// ============================================================================
// Response Assertion Helpers
// ============================================================================

/**
 * Asserts a cron job response indicates success.
 *
 * @param response - The response from the cron handler
 * @param expectedStatus - Expected HTTP status (default: 200)
 * @returns Parsed response data
 */
export async function expectCronSuccess<T = any>(
  response: Response,
  expectedStatus: number = 200
): Promise<{ success: true; data: T; timestamp: string }> {
  expect(response.status).toBe(expectedStatus);
  const data = await response.json();
  expect(data.success).toBe(true);
  expect(data).toHaveProperty("data");
  expect(data).toHaveProperty("timestamp");
  return data;
}

/**
 * Asserts a cron job response indicates failure.
 *
 * @param response - The response from the cron handler
 * @param expectedStatus - Expected HTTP status (default: 401)
 * @param expectedError - Expected error message substring (optional)
 * @returns Parsed error response
 */
export async function expectCronError(
  response: Response,
  expectedStatus: number = 401,
  expectedError?: string
): Promise<{ success: false; error: string; timestamp: string }> {
  expect(response.status).toBe(expectedStatus);
  const data = await response.json();
  expect(data.success).toBe(false);
  expect(data).toHaveProperty("error");
  if (expectedError) {
    expect(data.error).toContain(expectedError);
  }
  return data;
}

/**
 * Asserts unauthorized response for invalid cron auth.
 */
export async function expectCronUnauthorized(response: Response): Promise<void> {
  await expectCronError(response, 401, "Unauthorized");
}

/**
 * Asserts forbidden response for non-production environment.
 */
export async function expectCronForbidden(response: Response): Promise<void> {
  await expectCronError(response, 403, "Forbidden");
}

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates mock candidate data for email cron jobs.
 */
export function createMockEmailCandidate(overrides: Partial<{
  user_id: string;
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  home_beach_id: string | null;
}> = {}) {
  return {
    user_id: "user-123",
    email: "test@example.com",
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    email_confirmed_at: null,
    home_beach_id: null,
    ...overrides,
  };
}

/**
 * Creates mock forecast data for forecast sync cron jobs.
 */
export function createMockForecastSyncResult(overrides: Partial<{
  success: boolean;
  results: any[];
  summary: {
    total: number;
    attempted: number;
    successful: number;
    failed: number;
    duration: string;
    stoppedEarly: boolean;
    stopReason?: string;
    remainingMs?: number;
  };
}> = {}) {
  return {
    success: true,
    results: [],
    summary: {
      total: 10,
      attempted: 10,
      successful: 10,
      failed: 0,
      duration: "1.5s",
      stoppedEarly: false,
    },
    ...overrides,
  };
}

/**
 * Creates mock alert result for forecast alert cron jobs.
 */
export function createMockAlertResult(overrides: Partial<{
  eligibleUsers: number;
  eligibleBeachesProcessed: number;
  sent: number;
  durationMs: number;
  skipped: Record<string, number>;
}> = {}) {
  const { skipped, ...summaryOverrides } = overrides;

  return {
    eligibleUsers: 100,
    eligibleBeachesProcessed: 100,
    sent: 50,
    durationMs: 2500,
    skipped: {
      pushDisabled: 10,
      alertsDisabled: 5,
      mockUser: 0,
      noEligibleBeaches: 0,
      missingBeachSlug: 0,
      staleForecast: 0,
      missingForecast: 0,
      noGoodForecasts: 0,
      duplicateDailySummary: 0,
      dailyDigestDisabled: 0,
      noMatch: 15,
      sendFailed: 0,
      quietHours: 0,
      ...skipped,
    },
    ...summaryOverrides,
  };
}

// ============================================================================
// Cron Job Mocking Utilities
// ============================================================================

/**
 * Creates a mock for validateCronRequest from lib/api-utils.
 *
 * @param isValid - Whether the validation should pass
 * @returns Jest mock function
 */
export function createValidateCronRequestMock(isValid: boolean = true): MockFn {
  return jest.fn(() => isValid);
}

/**
 * Creates mocks for common API response utilities.
 */
export function createApiUtilsMocks() {
  return {
    createSuccessResponse: jest.fn((data: any, status = 200) => ({
      json: () =>
        Promise.resolve({
          success: true,
          data,
          timestamp: new Date().toISOString(),
        }),
      status,
    })),
    createErrorResponse: jest.fn((error: string, details?: any, status = 500) => ({
      json: () =>
        Promise.resolve({
          success: false,
          error,
          details,
          timestamp: new Date().toISOString(),
        }),
      status,
    })),
    handleApiError: jest.fn((error: unknown) => ({
      json: () =>
        Promise.resolve({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        }),
      status: 500,
    })),
    validateCronRequest: jest.fn(() => true),
  };
}

// ============================================================================
// Email Testing Utilities
// ============================================================================

/**
 * Creates a mock for the Resend mailer client.
 * Replaces the (global as any).__mockEmailsSend pattern with a clean approach.
 *
 * Usage in jest.mock factory (module scope):
 * ```typescript
 * const { mockSend, mailerMock } = createResendMailerMock();
 * jest.mock("@/lib/mailer/client", () => mailerMock);
 * ```
 */
export function createResendMailerMock() {
  const mockSend = jest.fn();
  const mailerMock = {
    resend: {
      emails: {
        send: mockSend,
      },
    },
    MAIL_FROM: "Quiver <test@quiversurf.app>",
    MAIL_REPLY_TO: "Quiver <test@quiversurf.app>",
    getBaseUrl: () => "https://quiversurf.app",
  };
  return { mockSend, mailerMock };
}

/**
 * Creates a mock for the email logging service.
 */
export function createEmailLoggingMock() {
  const mockLogger = {
    logDelivery: jest.fn().mockResolvedValue(undefined),
    logEmailSent: jest.fn(),
    logEmailFailed: jest.fn(),
  };
  const factory = jest.fn(() => mockLogger);
  return { mockLogger, factory };
}

/**
 * Creates a mock for the Resend rate limiter.
 */
export function createRateLimiterMock() {
  const mockThrottle = jest.fn().mockResolvedValue(undefined);
  const factory = jest.fn(() => ({
    throttle: mockThrottle,
    waitForSlot: jest.fn().mockResolvedValue(undefined),
  }));
  return { mockThrottle, factory };
}

/**
 * Shared mock for email formatters used across cron + email template tests.
 */
export function mockEmailFormatters() {
  jest.mock("@/lib/email/email-formatters", () => ({
    formatDatabaseTime: jest.fn((time: string) => {
      if (!time) return null;
      const parts = time.split(":");
      const hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hours >= 12 ? "PM" : "AM";
      const displayHour = hours > 12 ? hours - 12 : hours || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    }),
    getConditionLabel: jest.fn((score: number) => {
      if (score >= 80) return { label: "EPIC", color: "#00D4AA" };
      if (score >= 70) return { label: "GOOD", color: "#1D9E75" };
      if (score >= 55) return { label: "FAIR", color: "#FDB84B" };
      if (score >= 40) return { label: "RIDEABLE", color: "#888780" };
      return { label: "MEH", color: "#5F5E5A" };
    }),
  }));
}

// ============================================================================
// Export All
// ============================================================================

export {
  // Re-export common types
  type MockFn,
};
