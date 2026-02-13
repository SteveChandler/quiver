/**
 * @jest-environment node
 *
 * Cron Authentication Tests
 *
 * Tests the validateCronRequest function from lib/api-utils.ts
 * to ensure cron routes properly authenticate requests from:
 * - Vercel Cron (x-vercel-cron header)
 * - Vercel Cron User-Agent
 * - Bearer token with CRON_SECRET
 */

import { validateCronRequest, validateCronAuth } from "@/lib/api-utils";
import {
  setupCronTestEnvironment,
  createMockCronRequest,
  type CronTestEnvironment,
} from "@/__tests__/setup/cron-test-utils";

describe("Cron Authentication", () => {
  let cronEnv: CronTestEnvironment;

  beforeEach(() => {
    cronEnv = setupCronTestEnvironment({
      cronSecret: "test-cron-secret",
    });
  });

  afterEach(() => {
    cronEnv.cleanup();
  });

  describe("validateCronRequest", () => {
    it("accepts valid x-vercel-cron header", () => {
      const request = createMockCronRequest("/api/cron/test", {
        authMethod: "vercel-header",
      });

      const isValid = validateCronRequest(request);

      expect(isValid).toBe(true);
    });

    it("accepts valid Bearer CRON_SECRET", () => {
      const request = createMockCronRequest("/api/cron/test", {
        authMethod: "bearer-token",
        cronSecret: "test-cron-secret",
      });

      const isValid = validateCronRequest(request);

      expect(isValid).toBe(true);
    });

    it("rejects missing authentication", () => {
      const request = createMockCronRequest("/api/cron/test", {
        authMethod: "none",
      });

      const isValid = validateCronRequest(request);

      expect(isValid).toBe(false);
    });

    it("rejects invalid Bearer token", () => {
      const request = createMockCronRequest("/api/cron/test", {
        authMethod: "bearer-token",
        cronSecret: "wrong-secret",
      });

      const isValid = validateCronRequest(request);

      expect(isValid).toBe(false);
    });

    it("rejects empty authorization header", () => {
      // Create a request with an empty Authorization header
      const mockHeaders = new Headers({
        "Content-Type": "application/json",
        Authorization: "",
      });

      const mockRequest = {
        url: "http://localhost:3000/api/cron/test",
        method: "GET",
        headers: mockHeaders,
        json: jest.fn(() => Promise.resolve({})),
        text: jest.fn(() => Promise.resolve("")),
        clone: jest.fn(),
      } as unknown as Request;

      const isValid = validateCronRequest(mockRequest);

      expect(isValid).toBe(false);
    });
  });

  describe("validateCronAuth", () => {
    it("validates correct Bearer token format", () => {
      const isValid = validateCronAuth("Bearer test-cron-secret");

      expect(isValid).toBe(true);
    });

    it("rejects null authorization header", () => {
      const isValid = validateCronAuth(null);

      expect(isValid).toBe(false);
    });

    it("rejects wrong Bearer token", () => {
      const isValid = validateCronAuth("Bearer wrong-token");

      expect(isValid).toBe(false);
    });

    it("rejects token without Bearer prefix", () => {
      const isValid = validateCronAuth("test-cron-secret");

      expect(isValid).toBe(false);
    });

    it("rejects requests when no CRON_SECRET is configured", () => {
      // Clear the cron secret
      delete process.env.CRON_SECRET;
      delete process.env.CRON_SECRET_TOKEN;

      const isValid = validateCronAuth(null);

      expect(isValid).toBe(false);
    });
  });

  describe("Authentication Priority", () => {
    it("vercel-header takes priority over invalid bearer token", () => {
      // Request has valid vercel-header but also sends an invalid bearer token
      const mockHeaders = new Headers({
        "Content-Type": "application/json",
        "x-vercel-cron": "1",
        Authorization: "Bearer wrong-token",
      });

      const mockRequest = {
        url: "http://localhost:3000/api/cron/test",
        method: "GET",
        headers: mockHeaders,
        json: jest.fn(() => Promise.resolve({})),
        text: jest.fn(() => Promise.resolve("")),
        clone: jest.fn(),
      } as unknown as Request;

      const isValid = validateCronRequest(mockRequest);

      // Should be valid because x-vercel-cron header is checked first
      expect(isValid).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("handles x-vercel-cron header with any truthy value", () => {
      const mockHeaders = new Headers({
        "Content-Type": "application/json",
        "x-vercel-cron": "true",
      });

      const mockRequest = {
        url: "http://localhost:3000/api/cron/test",
        method: "GET",
        headers: mockHeaders,
        json: jest.fn(() => Promise.resolve({})),
        text: jest.fn(() => Promise.resolve("")),
        clone: jest.fn(),
      } as unknown as Request;

      const isValid = validateCronRequest(mockRequest);

      expect(isValid).toBe(true);
    });

    it("supports CRON_SECRET_TOKEN as alternative env var", () => {
      // Set CRON_SECRET_TOKEN instead of CRON_SECRET
      delete process.env.CRON_SECRET;
      process.env.CRON_SECRET_TOKEN = "alternative-secret";

      const request = createMockCronRequest("/api/cron/test", {
        authMethod: "bearer-token",
        cronSecret: "alternative-secret",
      });

      const isValid = validateCronRequest(request);

      expect(isValid).toBe(true);
    });

    it("prefers CRON_SECRET_TOKEN over CRON_SECRET when both are set", () => {
      // Set both environment variables
      process.env.CRON_SECRET = "cron-secret";
      process.env.CRON_SECRET_TOKEN = "token-secret";

      // Request with CRON_SECRET_TOKEN value should work
      const requestWithToken = createMockCronRequest("/api/cron/test", {
        authMethod: "bearer-token",
        cronSecret: "token-secret",
      });

      expect(validateCronRequest(requestWithToken)).toBe(true);

      // Request with CRON_SECRET value should fail (because TOKEN takes priority)
      const requestWithSecret = createMockCronRequest("/api/cron/test", {
        authMethod: "bearer-token",
        cronSecret: "cron-secret",
      });

      expect(validateCronRequest(requestWithSecret)).toBe(false);
    });
  });
});
