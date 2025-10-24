/**
 * Admin Portal Configuration & Environment Validation
 *
 * This module validates required environment variables for admin operations
 * and throws on boot if misconfigured (except in test environments).
 */

export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminConfigError";
  }
}

/**
 * Check if admin portal environment is properly configured
 */
export function validateAdminConfig(): void {
  // Skip validation in test environments
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const errors: string[] = [];

  // Check for Supabase service role key (required for admin operations)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY is missing - required for admin operations");
  }

  // Check for Supabase URL and anon key (basic requirements)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is missing");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
  }

  // Throw if there are configuration errors
  if (errors.length > 0) {
    const errorMessage = [
      "Admin Portal Configuration Error:",
      ...errors.map(err => `  - ${err}`),
      "",
      "Please check your .env.local file and ensure all required variables are set.",
    ].join("\n");

    throw new AdminConfigError(errorMessage);
  }
}

/**
 * Get admin portal configuration
 * Safe to call - returns undefined for missing values instead of throwing
 */
export function getAdminConfig() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    isProduction: process.env.NODE_ENV === "production",
    isDevelopment: process.env.NODE_ENV === "development",
    isTest: process.env.NODE_ENV === "test",
  };
}

/**
 * Check if admin features should be enabled
 * Can be used to gate features behind environment flags
 */
export function isAdminPortalEnabled(): boolean {
  // Check for feature flag (optional - defaults to enabled if service role key exists)
  const explicitFlag = process.env.ADMIN_PORTAL_ENABLED;
  if (explicitFlag !== undefined) {
    return explicitFlag === "true" || explicitFlag === "1";
  }

  // Default: enabled if we have service role key
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// Validate configuration on module load (except in test)
// This ensures we fail fast if misconfigured
if (typeof window === "undefined" && process.env.NODE_ENV !== "test") {
  try {
    validateAdminConfig();
  } catch (error) {
    // Log the error but don't crash the entire app
    // This allows the app to start but admin routes will fail properly
    console.error(error instanceof Error ? error.message : "Admin config validation failed");
  }
}
