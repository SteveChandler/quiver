/**
 * Centralized authentication utilities for Quiver
 *
 * Provides standardized functions for:
 * - Redirect handling and loop prevention
 * - OAuth flow initiation
 * - Magic link authentication
 * - Email and password validation
 * - User existence checks
 */

import { createClient } from "@/lib/supabase/client";
import {
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
} from "@/lib/utils/safe-storage";

// Constants for storage keys and configuration
const REDIRECT_STORAGE_KEY = "auth_redirect_path";
const REDIRECT_ATTEMPTS_KEY = "redirectAttempts";
const MAX_REDIRECT_ATTEMPTS = 3;
const REDIRECT_URL_PARAM = "redirectTo";
const PENDING_SIGNUP_METADATA_KEY = "pending_signup_metadata";

/** Minimum password length for validation (stricter than Supabase's 6-char minimum) */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Store the intended redirect path after authentication
 * @param path - The path to redirect to after auth (e.g., "/beach/123")
 */
export function setAuthRedirect(path: string): void {
  // Don't store root path or empty paths
  if (!path || path === "/") return;

  // Validate path starts with /
  if (!path.startsWith("/")) {
    console.warn("Auth redirect path should start with /:", path);
    return;
  }

  safeSetItem(REDIRECT_STORAGE_KEY, path);
}

/**
 * Retrieve the stored redirect path
 * Priority: URL param > localStorage > null
 * @returns The redirect path or null if none stored
 */
export function getAuthRedirect(): string | null {
  // Check if we're in a browser environment
  if (typeof window === "undefined") return null;

  // 1. Check URL params first (highest priority)
  const urlParams = new URLSearchParams(window.location.search); // eslint-disable-line no-restricted-properties
  const urlRedirect = urlParams.get(REDIRECT_URL_PARAM);
  if (urlRedirect && urlRedirect !== "/") return urlRedirect;

  // 2. Check localStorage
  const storedRedirect = safeGetItem(REDIRECT_STORAGE_KEY);
  if (storedRedirect && storedRedirect !== "/") return storedRedirect;

  // 3. No redirect found
  return null;
}

/**
 * Clear the stored redirect path
 */
export function clearAuthRedirect(): void {
  safeRemoveItem(REDIRECT_STORAGE_KEY);
}

/**
 * Build an auth URL with the return path as a query parameter
 * @param basePath - The base auth path (e.g., "/auth/sign-in")
 * @param returnTo - Optional explicit return path
 * @returns Full URL path with redirect parameter
 */
export function buildAuthUrl(basePath: string, returnTo?: string): string {
  const redirect = returnTo || getAuthRedirect();
  if (!redirect) return basePath;

  const url = new URL(basePath, window.location.origin); // eslint-disable-line no-restricted-properties
  url.searchParams.set(REDIRECT_URL_PARAM, redirect);
  return url.pathname + url.search;
}

/**
 * Initiate OAuth authentication flow
 * @param provider - OAuth provider (currently only 'google')
 * @param returnTo - Path to return to after auth
 * @returns Promise with error if OAuth fails
 */
export async function initiateOAuthFlow(
  provider: "google",
  returnTo: string,
  metadata?: Record<string, any>
): Promise<{ error?: string }> {
  try {
    const sb = createClient();
    const origin = window.location.origin; // eslint-disable-line no-restricted-properties

    // Store the intended return path in localStorage as a backup
    setAuthRedirect(returnTo);
    console.log("[auth-utils] Storing redirect path for OAuth:", returnTo);

    // Stash signup metadata for post-OAuth processing (if provided)
    if (metadata && Object.keys(metadata).length > 0) {
      sessionStorage.setItem(PENDING_SIGNUP_METADATA_KEY, JSON.stringify(metadata));
    }

    // Web: standard redirect flow
    const redirectTo = `${origin}/auth/callback?redirect=${encodeURIComponent(returnTo)}`;
    const { error: oauthError } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    if (oauthError) {
      console.error("[auth-utils] OAuth error:", oauthError);
      clearAuthRedirect();
      sessionStorage.removeItem(PENDING_SIGNUP_METADATA_KEY);
      return {
        error: "Unable to sign in with Google. Please try another method.",
      };
    }

    // If successful, browser will redirect to OAuth provider
    return {};
  } catch (error) {
    console.error("[auth-utils] OAuth exception:", error);
    clearAuthRedirect();
    sessionStorage.removeItem(PENDING_SIGNUP_METADATA_KEY);
    return {
      error: "An unexpected error occurred during sign in.",
    };
  }
}

/**
 * Send a magic link (passwordless) authentication email
 * @param email - User's email address
 * @param returnTo - Path to return to after auth
 * @returns Promise with error if sending fails
 */
export async function sendMagicLink(
  email: string,
  returnTo: string
): Promise<{ error?: string }> {
  try {
    if (process.env.NEXT_PUBLIC_E2E_DISABLE_EMAIL_SENDS === "true") {
      return {};
    }

    const sb = createClient();
    const origin = window.location.origin; // eslint-disable-line no-restricted-properties

    // Validate email format first
    if (!validateEmail(email)) {
      return { error: "Please enter a valid email address." };
    }

    // Store the intended return path in localStorage as a backup
    setAuthRedirect(returnTo);
    console.log("[auth-utils] Storing redirect path for magic link:", returnTo);

    const { error: emailError } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(
          returnTo
        )}`,
      },
    });

    if (emailError) {
      console.error("[auth-utils] Magic link error:", emailError);
      clearAuthRedirect();
      return { error: "Failed to send magic link. Please try again." };
    }

    // Success - don't clear redirect, we need it for the callback
    return {};
  } catch (error) {
    console.error("[auth-utils] Magic link exception:", error);
    clearAuthRedirect();
    return { error: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Validate password meets minimum requirements
 * @param password - Password to validate
 * @returns Validation result with optional error message
 */
export function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (!password) {
    return { valid: false, error: "Password is required" };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  return { valid: true };
}

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns true if valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;

  // Basic email validation: contains @ and has characters before and after it
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Common email domain typos mapped to their correct domains.
 * Used by validateEmailDomain to suggest corrections during signup/login.
 */
export const TYPO_DOMAINS: Readonly<Record<string, string>> = {
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.cmo": "gmail.com",
  "gamil.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gnail.com": "gmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yaho.com": "yahoo.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
  "icloud.co": "icloud.com",
  "icloud.con": "icloud.com",
  "icloud.cm": "icloud.com",
  "aol.co": "aol.com",
  "protonmail.co": "protonmail.com",
  "protonmail.con": "protonmail.com",
} as const;

export interface EmailDomainValidation {
  valid: boolean;
  /** Human-readable suggestion, e.g. "Did you mean gmail.com?" */
  suggestion?: string;
  /** The full corrected email address */
  suggestedEmail?: string;
}

/**
 * Validate an email's domain against known typo domains and basic TLD checks.
 * Returns a suggestion when the domain looks like a common misspelling.
 * The email is still marked as "valid" for typo matches (the user might
 * genuinely own that domain), but callers should surface the suggestion.
 */
export function validateEmailDomain(email: string): EmailDomainValidation {
  if (!email || !email.includes("@")) {
    return { valid: false };
  }

  const atIndex = email.lastIndexOf("@");
  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (!domain) return { valid: false };

  const lowerDomain = domain.toLowerCase();

  // Check against typo domains
  const correction = TYPO_DOMAINS[lowerDomain];
  if (correction) {
    const suggestedEmail = `${localPart}@${correction}`;
    return {
      valid: true, // Still technically valid, just suspicious
      suggestion: `Did you mean ${correction}?`,
      suggestedEmail,
    };
  }

  // Check TLD is at least 2 chars
  const tld = lowerDomain.split(".").pop();
  if (!tld || tld.length < 2) {
    return { valid: false };
  }

  return { valid: true };
}

/**
 * Check if a user account exists for the given email
 * Note: This is a client-side check and may not be 100% accurate
 * @param email - Email address to check
 * @returns Promise<boolean> indicating if user likely exists
 */
export async function checkUserExists(email: string): Promise<boolean> {
  // For now, we can't reliably check this client-side without exposing security issues
  // This function is here for future implementation (e.g., via dedicated API endpoint)
  // For Phase 1, we'll return false (assume new user) and handle auto-detection later
  console.log("[auth-utils] User existence check not yet implemented");
  return false;
}

/**
 * Increment the redirect attempt counter (for loop prevention)
 * @returns The new attempt count
 */
export function incrementRedirectAttempt(): number {
  const current = parseInt(safeGetItem(REDIRECT_ATTEMPTS_KEY) || "0");
  // Handle NaN case (invalid value in localStorage)
  const next = (isNaN(current) ? 0 : current) + 1;
  safeSetItem(REDIRECT_ATTEMPTS_KEY, next.toString());
  return next;
}

/**
 * Clear the redirect attempt counter
 */
export function clearRedirectAttempts(): void {
  safeRemoveItem(REDIRECT_ATTEMPTS_KEY);
}

/**
 * Check if we've hit the redirect loop threshold
 * @returns true if loop detected, false otherwise
 */
export function isRedirectLoopDetected(): boolean {
  const attempts = parseInt(safeGetItem(REDIRECT_ATTEMPTS_KEY) || "0");
  return attempts >= MAX_REDIRECT_ATTEMPTS;
}

/**
 * Export constants for use in other modules
 */
export const AUTH_CONSTANTS = {
  REDIRECT_STORAGE_KEY,
  REDIRECT_ATTEMPTS_KEY,
  MAX_REDIRECT_ATTEMPTS,
  REDIRECT_URL_PARAM,
} as const;
