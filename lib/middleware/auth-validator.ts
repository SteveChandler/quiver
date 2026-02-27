/**
 * AuthValidator - Handles authentication validation for middleware
 *
 * Responsibilities:
 * - Session validation using Supabase
 * - Remote auth fallback for expired/invalid sessions
 * - User retrieval and error handling
 *
 * Design Pattern: Strategy Pattern
 * - Encapsulates authentication logic
 * - Provides clean interface for middleware
 * - Separates session validation from authorization
 */

import { type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Discriminated union for auth results.
 * When authenticated is true, user is guaranteed to exist.
 * When authenticated is false, error is guaranteed to exist.
 */
export type AuthResult =
  | { authenticated: true; user: User }
  | { authenticated: false; error: string };

export interface SupabaseCookieOptions {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options: any }[]): void;
}

export class AuthValidator {
  private supabase: SupabaseClient | null = null;
  private verbose: boolean;
  private initError: string | null = null;

  constructor(
    request: NextRequest,
    cookieCallbacks: SupabaseCookieOptions,
    verbose = false,
    existingClient?: SupabaseClient
  ) {
    this.verbose = verbose;

    // Use existing client if provided (avoids creating duplicate clients)
    if (existingClient) {
      this.supabase = existingClient;
      return;
    }

    // Validate required environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("[AuthValidator] Missing Supabase credentials - authentication will fail gracefully");
      this.initError = "Missing Supabase configuration";
      return;
    }

    // Create Supabase client with cookie management
    this.supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieCallbacks.getAll();
          },
          setAll(cookies) {
            cookieCallbacks.setAll(cookies);
          },
        },
      }
    );
  }

  /**
   * Validates user authentication.
   *
   * Important security note:
   * - `supabase.auth.getSession()` reads session data from cookies/storage and does NOT
   *   guarantee the `session.user` payload is authentic.
   * - `supabase.auth.getUser()` verifies the user by contacting Supabase Auth.
   *
   * We still call `getSession()` first to avoid an unnecessary remote `getUser()` call
   * for unauthenticated/anonymous requests, but we never trust `session.user`.
   *
   * @returns AuthResult with user data or error
   */
  async validateAuth(): Promise<AuthResult> {
    // Handle initialization failure (missing env vars)
    if (this.initError || !this.supabase) {
      return { authenticated: false, error: this.initError || "Supabase client not initialized" };
    }

    try {
      // Optimization: quick check for session existence (do NOT trust session.user)
      const hasSession = await this.hasSession();
      if (!hasSession) {
        return { authenticated: false, error: "No valid session" };
      }

      // Verified user (remote auth)
      return await this.validateRemoteAuth();
    } catch (error) {
      this.logError("Error during auth validation", error);
      return {
        authenticated: false,
        error: "Authentication failed",
      };
    }
  }

  /**
   * Fast path: check for presence of a session cookie.
   * We intentionally do NOT trust any user fields from the session object.
   * Note: Only called after validateAuth() confirms supabase is initialized.
   */
  private async hasSession(): Promise<boolean> {
    const {
      data: { session },
      error: sessionError,
    } = await this.supabase!.auth.getSession();

    if (sessionError) {
      this.log("Session check error", sessionError?.message);
    }

    return !!session;
  }

  /**
   * Slow path: Validate with remote auth server
   * Used as fallback for expired sessions, cookie manipulation, etc.
   * Note: Only called after validateAuth() confirms supabase is initialized.
   */
  private async validateRemoteAuth(): Promise<AuthResult> {
    const {
      data: { user },
      error: userError,
    } = await this.supabase!.auth.getUser();

    if (user && !userError) {
      return {
        authenticated: true,
        user,
      };
    }

    return {
      authenticated: false,
      error: userError?.message || "No valid user",
    };
  }

  /**
   * Logging utilities
   */
  private log(message: string, data?: any) {
    if (this.verbose) {
      console.log(`[AuthValidator] ${message}`, data || "");
    }
  }

  private logError(message: string, error?: any) {
    // Always log errors in development, less verbose in production
    if (process.env.NODE_ENV === "development") {
      console.error(`[AuthValidator] ${message}`, error);
    } else {
      console.error(`[AuthValidator] ${message}`);
    }
  }
}
