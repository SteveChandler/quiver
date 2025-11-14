/**
 * @jest-environment node
 *
 * Unit Tests for Referral Validation API
 * Tests: /api/referrals/validate
 *
 * This test suite provides comprehensive coverage for the referral code validation endpoint,
 * including input validation, rate limiting, database interactions, security, and performance.
 *
 * Test Coverage:
 * - Basic Functionality (3 tests)
 * - Input Validation (7 tests)
 * - Rate Limiting (4 tests)
 * - Database Error Handling (3 tests)
 * - Security & Headers (6 tests)
 * - Performance & Concurrency (2 tests)
 *
 * Total: 25 test cases targeting 100% code coverage
 */

// ============================================================================
// MOCKS SETUP - Must be before imports
// ============================================================================

// Mock next/server
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

// Mock rate limiter with inline definition to avoid hoisting issues
jest.mock("@/lib/utils/rate-limiter", () => {
  const mockInstance = {
    canMakeRequest: jest.fn().mockReturnValue(true),
    recordRequest: jest.fn(),
    getTimeUntilReset: jest.fn().mockReturnValue(0),
  };
  return {
    createRateLimiter: jest.fn(() => mockInstance),
    __getMockInstance: () => mockInstance,
  };
});

// Mock Supabase client with inline definition
jest.mock("@/lib/supabase/server", () => {
  const mockChain = {
    from: jest.fn(),
    select: jest.fn(),
    ilike: jest.fn(),
    maybeSingle: jest.fn(),
  };

  // Setup chain to return itself
  mockChain.from.mockReturnValue(mockChain);
  mockChain.select.mockReturnValue(mockChain);
  mockChain.ilike.mockReturnValue(mockChain);
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });

  return {
    createAPIServerClient: jest.fn(() => mockChain),
    __getMockChain: () => mockChain,
  };
});

import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/referrals/validate/route";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";

// Get references to mock instances after imports
const rateLimiterModule = require("@/lib/utils/rate-limiter");
const supabaseModule = require("@/lib/supabase/server");
const mockRateLimiter = rateLimiterModule.__getMockInstance();
const mockSupabaseChain = supabaseModule.__getMockChain();

// Mock console methods for assertion
const mockConsoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, "error").mockImplementation(() => {});

// Cleanup console mocks after all tests complete
afterAll(() => {
  mockConsoleWarn.mockRestore();
  mockConsoleError.mockRestore();
});

// ============================================================================
// TEST DATA
// ============================================================================

/**
 * Test referral codes for various scenarios
 */
const TEST_CODES = {
  VALID: "ABC123",
  INVALID: "NOTFOUND",
  EMPTY: "",
  WHITESPACE: "   ",
  WHITESPACE_PADDED: "  ABC123  ",
  TOO_LONG: "A".repeat(21),
  EXACTLY_20: "A".repeat(20),
  SPECIAL_CHARS: "ABC-123_XYZ",
  SQL_INJECTION: "ABC';DROP--", // 11 chars - under limit
  XSS: "<script>x</script>", // 18 chars - under limit
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Mock database query response for referral code lookup
 *
 * @param code - The referral code being queried
 * @param exists - Whether the code should exist in the database
 * @param error - Optional error to simulate database failure
 */
function mockReferralQuery(code: string, exists: boolean, error: any = null) {
  const mockData = exists ? { id: "user-123" } : null;

  mockSupabaseChain.maybeSingle.mockResolvedValueOnce({
    data: mockData,
    error,
  });
}

/**
 * Create a validation request with optional query parameters
 *
 * @param code - Optional referral code to validate
 * @returns Mock NextRequest instance
 */
function createValidationRequest(code?: string): NextRequest {
  const url = code !== undefined
    ? `http://localhost:3000/api/referrals/validate?code=${encodeURIComponent(code)}`
    : "http://localhost:3000/api/referrals/validate";

  return new NextRequest(url, { method: "GET" });
}

/**
 * Assert that security headers are present in the response
 *
 * @param response - The NextResponse to check
 */
function expectSecurityHeaders(response: NextResponse) {
  Object.entries(DEFAULT_SECURITY_HEADERS).forEach(([key, value]) => {
    expect(response.headers.get(key)).toBe(value);
  });
}

/**
 * Assert validation response structure and validity
 *
 * @param response - The NextResponse to check
 * @param expectedValid - Expected validation result
 * @returns The parsed response data
 */
async function expectValidationResponse(
  response: NextResponse,
  expectedValid: boolean
) {
  const data = await response.json();
  expect(data).toHaveProperty("valid", expectedValid);
  return data;
}

// ============================================================================
// TEST SUITE 1: BASIC FUNCTIONALITY
// ============================================================================

describe("Referral Validation API - Basic Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimiter.canMakeRequest.mockReturnValue(true);
    mockRateLimiter.recordRequest.mockImplementation(() => {});
    mockRateLimiter.getTimeUntilReset.mockReturnValue(0);
  });

  it("should return valid: true for existing referral code", async () => {
    mockReferralQuery(TEST_CODES.VALID, true);

    const request = createValidationRequest(TEST_CODES.VALID);
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await expectValidationResponse(response, true);
    expect(data).not.toHaveProperty("message");
    expectSecurityHeaders(response);
  });

  it("should return valid: false for non-existent referral code", async () => {
    mockReferralQuery(TEST_CODES.INVALID, false);

    const request = createValidationRequest(TEST_CODES.INVALID);
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await expectValidationResponse(response, false);
    expectSecurityHeaders(response);
  });

  it("should perform case-insensitive matching", async () => {
    const lowercaseCode = "abc123";
    const uppercaseCode = "ABC123";

    mockReferralQuery(lowercaseCode, true);

    const request = createValidationRequest(lowercaseCode);
    const response = await GET(request);

    expect(response.status).toBe(200);
    await expectValidationResponse(response, true);

    // Verify .ilike() was called for case-insensitive search
    expect(mockSupabaseChain.ilike).toHaveBeenCalledWith(
      "referral_code",
      lowercaseCode
    );
  });
});

// ============================================================================
// TEST SUITE 2: INPUT VALIDATION
// ============================================================================

describe("Referral Validation API - Input Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimiter.canMakeRequest.mockReturnValue(true);
    mockRateLimiter.recordRequest.mockImplementation(() => {});
  });

  it("should return 400 for missing code parameter", async () => {
    const request = createValidationRequest();
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.valid).toBe(false);
    expect(data.message).toBe("Referral code is required");
    expectSecurityHeaders(response);
  });

  it("should return 400 for empty code", async () => {
    // Empty string in query parameter is treated as parameter not provided
    const request = createValidationRequest(TEST_CODES.EMPTY);
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.valid).toBe(false);
    // Empty string query param is treated as missing parameter
    expect(data.message).toBe("Referral code is required");
    expectSecurityHeaders(response);
  });

  it("should return 400 for whitespace-only code", async () => {
    const request = createValidationRequest(TEST_CODES.WHITESPACE);
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.valid).toBe(false);
    expect(data.message).toBe("Referral code cannot be empty");
    expectSecurityHeaders(response);
  });

  it("should trim whitespace from code before validation", async () => {
    const trimmedCode = "ABC123";
    mockReferralQuery(trimmedCode, true);

    const request = createValidationRequest(TEST_CODES.WHITESPACE_PADDED);
    const response = await GET(request);

    expect(response.status).toBe(200);
    await expectValidationResponse(response, true);

    // Verify trimmed code was used in query
    expect(mockSupabaseChain.ilike).toHaveBeenCalledWith(
      "referral_code",
      trimmedCode
    );
  });

  it("should accept code with exactly 20 characters", async () => {
    mockReferralQuery(TEST_CODES.EXACTLY_20, true);

    const request = createValidationRequest(TEST_CODES.EXACTLY_20);
    const response = await GET(request);

    expect(response.status).toBe(200);
    await expectValidationResponse(response, true);
  });

  it("should return 400 for code longer than 20 characters", async () => {
    const request = createValidationRequest(TEST_CODES.TOO_LONG);
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.valid).toBe(false);
    expect(data.message).toBe("Referral code is too long");
    expectSecurityHeaders(response);
  });

  it("should accept special characters in code", async () => {
    mockReferralQuery(TEST_CODES.SPECIAL_CHARS, true);

    const request = createValidationRequest(TEST_CODES.SPECIAL_CHARS);
    const response = await GET(request);

    expect(response.status).toBe(200);
    await expectValidationResponse(response, true);
  });
});

// ============================================================================
// TEST SUITE 3: RATE LIMITING
// ============================================================================

describe("Referral Validation API - Rate Limiting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimiter.recordRequest.mockImplementation(() => {});
  });

  it("should allow request when under rate limit", async () => {
    mockRateLimiter.canMakeRequest.mockReturnValue(true);
    mockReferralQuery(TEST_CODES.VALID, true);

    const request = createValidationRequest(TEST_CODES.VALID);
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockRateLimiter.recordRequest).toHaveBeenCalledWith("validate");
  });

  it("should return 429 when rate limit exceeded", async () => {
    const timeUntilReset = 45000; // 45 seconds
    mockRateLimiter.canMakeRequest.mockReturnValue(false);
    mockRateLimiter.getTimeUntilReset.mockReturnValue(timeUntilReset);

    const request = createValidationRequest(TEST_CODES.VALID);
    const response = await GET(request);

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.valid).toBe(false);
    expect(data.message).toBe("Too many validation attempts. Please try again later.");
    expectSecurityHeaders(response);

    // Verify request was NOT recorded
    expect(mockRateLimiter.recordRequest).not.toHaveBeenCalled();
  });

  it("should include Retry-After header when rate limited", async () => {
    const timeUntilReset = 60000; // 60 seconds
    mockRateLimiter.canMakeRequest.mockReturnValue(false);
    mockRateLimiter.getTimeUntilReset.mockReturnValue(timeUntilReset);

    const request = createValidationRequest(TEST_CODES.VALID);
    const response = await GET(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60"); // Ceiling of 60000ms / 1000
  });

  it("should log warning when rate limit exceeded", async () => {
    const timeUntilReset = 30000;
    mockRateLimiter.canMakeRequest.mockReturnValue(false);
    mockRateLimiter.getTimeUntilReset.mockReturnValue(timeUntilReset);

    const request = createValidationRequest(TEST_CODES.VALID);
    await GET(request);

    expect(mockConsoleWarn).toHaveBeenCalledWith(
      "Referral validation rate limit exceeded",
      expect.objectContaining({
        timeUntilReset,
        url: expect.any(String),
      })
    );
  });
});

// ============================================================================
// TEST SUITE 4: DATABASE ERROR HANDLING
// ============================================================================

describe("Referral Validation API - Database Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimiter.canMakeRequest.mockReturnValue(true);
    mockRateLimiter.recordRequest.mockImplementation(() => {});
  });

  it("should return 500 on database error", async () => {
    const dbError = { message: "Connection timeout", code: "PGRST301" };
    mockReferralQuery(TEST_CODES.VALID, false, dbError);

    const request = createValidationRequest(TEST_CODES.VALID);
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.valid).toBe(false);
    expect(data.message).toBe("Unable to validate code");
    expectSecurityHeaders(response);
  });

  it("should log database errors with context", async () => {
    const dbError = { message: "Database connection failed" };
    const code = TEST_CODES.VALID;
    mockReferralQuery(code, false, dbError);

    const request = createValidationRequest(code);
    await GET(request);

    expect(mockConsoleError).toHaveBeenCalledWith(
      "Error validating referral code:",
      expect.objectContaining({
        error: dbError.message,
        code,
      })
    );
  });

  it("should handle unexpected errors gracefully", async () => {
    // Force an unexpected error by making the query throw
    mockSupabaseChain.maybeSingle.mockRejectedValueOnce(
      new Error("Unexpected database failure")
    );

    const request = createValidationRequest(TEST_CODES.VALID);
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.valid).toBe(false);
    expect(data.message).toBe("Failed to validate referral code");
    expectSecurityHeaders(response);

    expect(mockConsoleError).toHaveBeenCalledWith(
      "Unexpected error in referral validation:",
      expect.any(Error)
    );
  });
});

// ============================================================================
// TEST SUITE 5: SECURITY & HEADERS
// ============================================================================

describe("Referral Validation API - Security & Headers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimiter.canMakeRequest.mockReturnValue(true);
    mockRateLimiter.recordRequest.mockImplementation(() => {});
  });

  it("should include security headers in all responses", async () => {
    mockReferralQuery(TEST_CODES.VALID, true);

    const request = createValidationRequest(TEST_CODES.VALID);
    const response = await GET(request);

    expectSecurityHeaders(response);

    // Verify specific security headers
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
  });

  it("should include Cache-Control header for valid codes", async () => {
    mockReferralQuery(TEST_CODES.VALID, true);

    const request = createValidationRequest(TEST_CODES.VALID);
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=300");
  });

  it("should not include Cache-Control for invalid codes", async () => {
    mockReferralQuery(TEST_CODES.INVALID, false);

    const request = createValidationRequest(TEST_CODES.INVALID);
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBeNull();
  });

  it("should handle SQL injection attempts safely", async () => {
    mockReferralQuery(TEST_CODES.SQL_INJECTION, false);

    const request = createValidationRequest(TEST_CODES.SQL_INJECTION);
    const response = await GET(request);

    expect(response.status).toBe(200);
    await expectValidationResponse(response, false);

    // Verify the malicious code was passed to .ilike() which sanitizes it
    expect(mockSupabaseChain.ilike).toHaveBeenCalledWith(
      "referral_code",
      TEST_CODES.SQL_INJECTION
    );
  });

  it("should handle XSS attempts safely", async () => {
    mockReferralQuery(TEST_CODES.XSS, false);

    const request = createValidationRequest(TEST_CODES.XSS);
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    // Response should not contain the XSS payload
    expect(JSON.stringify(data)).not.toContain("<script>");
  });

  it("should not expose user IDs in response", async () => {
    const userId = "user-12345";

    // Mock the query to return data with user ID
    mockReferralQuery(TEST_CODES.VALID, true);

    const request = createValidationRequest(TEST_CODES.VALID);
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.valid).toBe(true);
    expect(data).not.toHaveProperty("id");
    expect(data).not.toHaveProperty("userId");
    // The response should only contain {valid: true}, not user data
    expect(Object.keys(data)).toEqual(["valid"]);
  });
});

// ============================================================================
// TEST SUITE 6: PERFORMANCE & CONCURRENCY
// ============================================================================

describe("Referral Validation API - Performance & Concurrency", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimiter.canMakeRequest.mockReturnValue(true);
    mockRateLimiter.recordRequest.mockImplementation(() => {});
  });

  it("should handle concurrent requests with same code", async () => {
    const code = TEST_CODES.VALID;

    // Mock database to return success for all concurrent calls
    mockSupabaseChain.maybeSingle.mockResolvedValue({
      data: { id: "user-123" },
      error: null,
    });

    const requests = Array.from({ length: 5 }, () =>
      GET(createValidationRequest(code))
    );

    const responses = await Promise.all(requests);

    // Use Promise.all with map instead of forEach for proper async handling
    await Promise.all(responses.map(async (response) => {
      expect(response.status).toBe(200);
      await expectValidationResponse(response, true);
    }));

    // Verify rate limiter was called for each request
    expect(mockRateLimiter.recordRequest).toHaveBeenCalledTimes(5);
  });

  it("should handle concurrent requests with different codes", async () => {
    const codes = [
      TEST_CODES.VALID,
      TEST_CODES.INVALID,
      TEST_CODES.SPECIAL_CHARS,
    ];

    // Mock database with varying results
    mockSupabaseChain.maybeSingle
      .mockResolvedValueOnce({ data: { id: "user-1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "user-2" }, error: null });

    const requests = codes.map(code =>
      GET(createValidationRequest(code))
    );

    const responses = await Promise.all(requests);

    // First request (VALID) should return valid: true
    expect(responses[0].status).toBe(200);
    await expectValidationResponse(responses[0], true);

    // Second request (INVALID) should return valid: false
    expect(responses[1].status).toBe(200);
    await expectValidationResponse(responses[1], false);

    // Third request (SPECIAL_CHARS) should return valid: true
    expect(responses[2].status).toBe(200);
    await expectValidationResponse(responses[2], true);

    // Verify all requests were rate-checked
    expect(mockRateLimiter.canMakeRequest).toHaveBeenCalledTimes(3);
  });
});
