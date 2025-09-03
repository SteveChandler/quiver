/**
 * API Testing Utilities for Quiver
 * 
 * This file provides centralized utilities for testing API routes following
 * the patterns established in lib/api-utils.ts and CLAUDE.md guidelines.
 */

import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

// Mock response interfaces matching lib/api-utils.ts
export interface MockApiError {
  success: false;
  error: string;
  details?: any;
  timestamp: string;
}

export interface MockApiSuccess<T = any> {
  success: true;
  data: T;
  timestamp: string;
}

export type MockApiResponse<T = any> = MockApiSuccess<T> | MockApiError;

// Mock user factory following Supabase User interface
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "test-user-123",
    email: "test@example.com",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    aud: "authenticated",
    role: "",
    app_metadata: {},
    user_metadata: {},
    identities: [],
    factors: [],
    ...overrides,
  };
}

// Mock admin user factory
export function createMockAdminUser(overrides: Partial<User> = {}): User {
  return createMockUser({
    app_metadata: { is_admin: true },
    user_metadata: { role: "admin" },
    ...overrides,
  });
}

// Mock session factory
export function createMockSession(user: User = createMockUser()) {
  return {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    expires_at: Date.now() / 1000 + 3600,
    token_type: "bearer",
    user,
  };
}

// Mock Supabase client factory
export function createMockSupabaseClient() {
  // Create a shared query chain object that all methods return
  const createQueryChain = () => {
    const chain = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      eq: jest.fn(),
      neq: jest.fn(),
      gt: jest.fn(),
      gte: jest.fn(),
      lt: jest.fn(),
      lte: jest.fn(),
      like: jest.fn(),
      ilike: jest.fn(),
      in: jest.fn(),
      is: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
      range: jest.fn(),
      textSearch: jest.fn(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      then: jest.fn(),
      data: null,
      error: null,
    };
    
    // Make all methods return the same chain for proper chaining
    Object.keys(chain).forEach(key => {
      if (typeof chain[key] === 'function' && key !== 'single' && key !== 'maybeSingle' && key !== 'then') {
        chain[key].mockReturnValue(chain);
      }
    });
    
    // Set default return values for terminal methods
    chain.single.mockResolvedValue({ data: null, error: null });
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    chain.then.mockImplementation((onResolve) => {
      return Promise.resolve(onResolve({ data: null, error: null }));
    });
    
    return chain;
  };

  const mockClient = {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => createQueryChain()),
    rpc: jest.fn(() => ({ data: null, error: null })),
  };

  // Set default auth responses
  mockClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
  
  mockClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  return mockClient;
}

// Mock NextRequest factory
export function createMockRequest(
  method: string = "GET",
  url: string = "http://localhost:3000/api/test",
  options: {
    body?: any;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  } = {}
): NextRequest {
  const searchParams = new URLSearchParams(options.searchParams || {});
  const fullUrl = searchParams.toString() 
    ? `${url}?${searchParams.toString()}` 
    : url;

  const request = new NextRequest(fullUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return request;
}

// API Response test helpers
export function expectSuccessResponse<T>(
  response: Response,
  expectedStatus: number = 200
) {
  expect(response.status).toBe(expectedStatus);
  return response.json().then((data: MockApiResponse<T>) => {
    expect(data).toHaveProperty("success", true);
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("data");
    return data as MockApiSuccess<T>;
  });
}

export function expectErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedErrorMessage?: string
) {
  expect(response.status).toBe(expectedStatus);
  return response.json().then((data: MockApiResponse) => {
    expect(data).toHaveProperty("success", false);
    expect(data).toHaveProperty("error");
    expect(data).toHaveProperty("timestamp");
    if (expectedErrorMessage) {
      expect(data.error).toContain(expectedErrorMessage);
    }
    return data as MockApiError;
  });
}

// Authentication test helpers
export function mockAuthenticatedUser(mockClient: any, user: User = createMockUser()) {
  mockClient.auth.getUser.mockResolvedValue({
    data: { user },
    error: null,
  });
  
  mockClient.auth.getSession.mockResolvedValue({
    data: { session: createMockSession(user) },
    error: null,
  });
}

export function mockUnauthenticatedUser(mockClient: any) {
  mockClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
  
  mockClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });
}

export function mockAuthError(mockClient: any, errorMessage: string = "Authentication failed") {
  const error = { message: errorMessage };
  mockClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error,
  });
  
  mockClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error,
  });
}

// Database query test helpers
export function mockDatabaseSuccess(mockClient: any, data: any) {
  // Mock the from method to return a chain that resolves with the data
  mockClient.from.mockImplementation(() => {
    const chain = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      eq: jest.fn(),
      neq: jest.fn(),
      gt: jest.fn(),
      gte: jest.fn(),
      lt: jest.fn(),
      lte: jest.fn(),
      like: jest.fn(),
      ilike: jest.fn(),
      in: jest.fn(),
      is: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
      range: jest.fn(),
      textSearch: jest.fn(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      then: jest.fn(),
      data: data,
      error: null,
    };
    
    // Make all methods return the same chain for proper chaining
    Object.keys(chain).forEach(key => {
      if (typeof chain[key] === 'function' && key !== 'single' && key !== 'maybeSingle' && key !== 'then') {
        chain[key].mockReturnValue(chain);
      }
    });
    
    // Set return values for terminal methods
    chain.single.mockResolvedValue({ data, error: null });
    chain.maybeSingle.mockResolvedValue({ data, error: null });
    chain.then.mockImplementation((onResolve) => {
      return Promise.resolve(onResolve({ data, error: null }));
    });
    
    return chain;
  });
  
  return mockClient;
}

export function mockDatabaseError(mockClient: any, errorMessage: string, code?: string) {
  const error = { message: errorMessage, code };
  
  // Mock the from method to return a chain that resolves with the error
  mockClient.from.mockImplementation(() => {
    const chain = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      eq: jest.fn(),
      neq: jest.fn(),
      gt: jest.fn(),
      gte: jest.fn(),
      lt: jest.fn(),
      lte: jest.fn(),
      like: jest.fn(),
      ilike: jest.fn(),
      in: jest.fn(),
      is: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
      range: jest.fn(),
      textSearch: jest.fn(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      then: jest.fn(),
      data: null,
      error: error,
    };
    
    // Make all methods return the same chain for proper chaining
    Object.keys(chain).forEach(key => {
      if (typeof chain[key] === 'function' && key !== 'single' && key !== 'maybeSingle' && key !== 'then') {
        chain[key].mockReturnValue(chain);
      }
    });
    
    // Set return values for terminal methods
    chain.single.mockResolvedValue({ data: null, error });
    chain.maybeSingle.mockResolvedValue({ data: null, error });
    chain.then.mockImplementation((onResolve) => {
      return Promise.resolve(onResolve({ data: null, error }));
    });
    
    return chain;
  });
  
  return mockClient;
}

// Validation test helpers
export function testRequiredParameters(
  routeHandler: (request: NextRequest, ...args: any[]) => Promise<Response>,
  requiredParams: string[],
  validRequest: any = {},
  ...additionalArgs: any[]
) {
  return Promise.all(
    requiredParams.map(async (param) => {
      const invalidRequest = { ...validRequest };
      delete invalidRequest[param];
      
      const request = createMockRequest("POST", "http://localhost:3000/api/test", {
        body: invalidRequest,
      });
      
      const response = await routeHandler(request, ...additionalArgs);
      await expectErrorResponse(response, 400, param);
    })
  );
}

// Admin authorization test helper
export function testAdminAuthorization(
  routeHandler: (request: NextRequest, ...args: any[]) => Promise<Response>,
  mockClient: any,
  validRequest: any = {},
  ...additionalArgs: any[]
) {
  return async () => {
    // Test with non-admin user
    mockAuthenticatedUser(mockClient, createMockUser());
    
    const request = createMockRequest("POST", "http://localhost:3000/api/admin/test", {
      body: validRequest,
    });
    
    const response = await routeHandler(request, ...additionalArgs);
    await expectErrorResponse(response, 401, "Unauthorized");
  };
}

// Rate limiting test helpers (for future use)
export function createRateLimitHeaders(remaining: number = 0) {
  return {
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": (Date.now() + 60000).toString(),
  };
}

// Test data factories for common entities
export function createMockBeach(overrides: Partial<any> = {}) {
  return {
    id: "beach-123",
    name: "Test Beach",
    latitude: 33.7490,
    longitude: -118.4095,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createMockProfile(overrides: Partial<any> = {}) {
  return {
    id: "profile-123",
    user_id: "test-user-123",
    full_name: "Test User",
    home_beach_id: null,
    followers_count: 10,
    following_count: 5,
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createMockUserSession(overrides: Partial<any> = {}) {
  return {
    id: "session-123",
    user_id: "test-user-123",
    beach_id: "beach-123",
    rating: 4,
    status: "completed",
    is_public: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// Clean up function for test isolation
export function resetAllMocks() {
  jest.clearAllMocks();
}

// Environment variable mocking
export function mockEnvVars(vars: Record<string, string>) {
  const originalEnv = process.env;
  process.env = { ...originalEnv, ...vars };
  
  return () => {
    process.env = originalEnv;
  };
}

// Default test environment setup
export function setupApiTestEnvironment() {
  const restoreEnv = mockEnvVars({
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    CRON_SECRET: "test-cron-secret",
  });

  return {
    cleanup: () => {
      restoreEnv();
      resetAllMocks();
    },
  };
}