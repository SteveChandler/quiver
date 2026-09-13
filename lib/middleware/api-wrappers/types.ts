/**
 * API Route Wrapper Types
 *
 * Type definitions for API route handlers and their contexts.
 * Used by all wrapper functions in the api-wrappers module.
 */

import type { NextRequest, NextResponse } from "next/server";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { RateLimitKey } from "@/lib/api/rate-limit-config";
import type { AdminUser } from "@/lib/auth/admin";

// =============================================================================
// CORE HANDLER TYPES
// =============================================================================

/**
 * Standard Next.js route handler signature
 */
export type RouteHandler = {
  (request: NextRequest, context?: RouteContext): Promise<NextResponse>;
  // Next.js inspects the final signature; runtime callers retain the legacy overload.
  (request: NextRequest, context: { params: Promise<Record<string, string>> }): Promise<NextResponse>;
};

/**
 * Route context with typed params as received from Next.js
 *
 * Note: In Next.js 15+, params is a Promise that must be awaited.
 * We accept both for compatibility with the Next.js handler signature.
 */
export interface RouteContext {
  params: Record<string, string> | Promise<Record<string, string>>;
}

/**
 * Resolved params type (after awaiting the Promise)
 */
export type ResolvedParams = Record<string, string>;

/**
 * Extended context provided to authenticated handlers.
 * Params are always resolved (not a Promise) at this point.
 */
export interface AuthenticatedContext {
  params: ResolvedParams;
  user: User;
  supabase: SupabaseClient<Database>;
}

/**
 * Handler that receives authenticated context
 */
export type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthenticatedContext
) => Promise<NextResponse>;

/**
 * Context for optional auth handlers (user may be null).
 * Params are always resolved (not a Promise) at this point.
 */
export interface OptionalAuthContext {
  params: ResolvedParams;
  user: User | null;
  supabase: SupabaseClient<Database>;
}

/**
 * Handler that receives optional auth (user may be null)
 */
export type OptionalAuthHandler = (
  request: NextRequest,
  context: OptionalAuthContext
) => Promise<NextResponse>;

// =============================================================================
// OPTIONS INTERFACES
// =============================================================================

/**
 * Options for withAuth wrapper
 */
export interface WithAuthOptions {
  /** Custom error message for failed authentication */
  authErrorMessage?: string;
  /** Custom error message for caught exceptions */
  errorMessage?: string;
  /** Allow unauthenticated access (user will be null) */
  optional?: boolean;
}

/**
 * Options for withErrorHandler wrapper
 */
export interface WithErrorHandlerOptions {
  /** Custom error message for caught exceptions */
  errorMessage?: string;
  /** Include original error details in response (dev only) */
  includeDetails?: boolean;
}

/**
 * Options for createApiHandler
 */
export interface CreateApiHandlerOptions {
  /** Require authentication (default: true) */
  auth?: boolean;
  /** Custom error message */
  errorMessage?: string;
  /** Allow unauthenticated access with optional user */
  optionalAuth?: boolean;
}

/**
 * Options for withRateLimit wrapper
 */
export interface WithRateLimitOptions {
  /** Rate limit key from rate-limit-config.ts */
  key?: RateLimitKey;
  /**
   * Auth-aware rate limiting (adaptive keys).
   *
   * NOTE: This requires checking auth status (Supabase `getUser()`) to choose
   * the correct key, which adds overhead and partially defeats the "rate limit
   * before auth" latency optimization. Use sparingly.
   */
  authAware?: {
    publicLimitKey: RateLimitKey;
    authenticatedLimitKey: RateLimitKey;
  };
}

/**
 * Options for withBotBlocking wrapper
 */
export interface WithBotBlockingOptions {
  /** Custom error message for blocked bots */
  errorMessage?: string;
}

/**
 * Options for withProtection unified wrapper
 */
export interface ProtectionOptions {
  /** Authentication configuration */
  auth?: {
    /** Require authentication (default: false if omitted) */
    required: boolean;
    /** Custom error message for failed authentication */
    errorMessage?: string;
  };

  /** Rate limiting configuration */
  rateLimit?: WithRateLimitOptions;

  /** Bot blocking configuration */
  botBlocking?: {
    /** Enable bot blocking (default: false) */
    enabled: boolean;
    /** Custom error message */
    errorMessage?: string;
  };

  /** Error handling configuration */
  errorHandling?: WithErrorHandlerOptions;
}

// =============================================================================
// ADMIN AUTH TYPES
// =============================================================================

/**
 * Context provided to admin-authenticated handlers.
 * Uses AdminUser from lib/auth/admin and a service-role Supabase client.
 */
export interface AdminAuthenticatedContext {
  params: ResolvedParams;
  user: AdminUser;
  supabase: SupabaseClient<Database>;
}

/**
 * Handler that receives admin-authenticated context
 */
export type AdminAuthenticatedHandler = (
  request: NextRequest,
  context: AdminAuthenticatedContext
) => Promise<NextResponse>;

/**
 * Context for bearer auth handlers (user may be null when using service role key).
 * Includes authMethod to distinguish between bearer token and admin session.
 */
export interface BearerAuthContext {
  params: ResolvedParams;
  user: AdminUser | null;
  supabase: SupabaseClient<Database>;
  authMethod: "bearer" | "admin";
}

/**
 * Handler that receives bearer auth context
 */
export type BearerAuthHandler = (
  request: NextRequest,
  context: BearerAuthContext
) => Promise<NextResponse>;

/**
 * Options for withAdminAuth and withBearerAuth wrappers
 */
export interface WithAdminAuthOptions {
  /** Custom error message for caught exceptions */
  errorMessage?: string;
}
