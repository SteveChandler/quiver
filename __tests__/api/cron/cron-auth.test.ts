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

    it("uses CRON_SECRET for bearer token validation", () => {
      process.env.CRON_SECRET = "my-cron-secret";

      const request = createMockCronRequest("/api/cron/test", {
        authMethod: "bearer-token",
        cronSecret: "my-cron-secret",
      });

      const isValid = validateCronRequest(request);

      expect(isValid).toBe(true);
    });
  });
});
