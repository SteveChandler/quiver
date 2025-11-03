/**
 * Centralized Environment Variable Validation
 *
 * Validates all required environment variables for the Quiver application.
 * This provides clear error messages and fails fast in development mode.
 */

interface ValidationError {
  variable: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Checks if a string is a valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a string looks like a Supabase anon key
 * Supabase anon keys are JWT tokens that start with "eyJ"
 */
function isValidSupabaseKey(key: string): boolean {
  return key.length > 20 && (key.startsWith('eyJ') || key.startsWith('sb_'));
}

/**
 * Validates all environment variables required for the application
 *
 * @param env - Optional environment object (defaults to process.env)
 * @returns ValidationResult with errors and warnings
 */
export function validateEnvironmentVariables(
  env: Record<string, string | undefined> = process.env
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // === REQUIRED VARIABLES ===

  // Supabase URL
  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push({
      variable: 'NEXT_PUBLIC_SUPABASE_URL',
      message: 'NEXT_PUBLIC_SUPABASE_URL is required. Get it from: Supabase Dashboard → Project Settings → API',
      severity: 'error',
    });
  } else if (!isValidUrl(env.NEXT_PUBLIC_SUPABASE_URL)) {
    errors.push({
      variable: 'NEXT_PUBLIC_SUPABASE_URL',
      message: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL (e.g., https://your-project.supabase.co)',
      severity: 'error',
    });
  }

  // Supabase Anon Key
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push({
      variable: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required. Get it from: Supabase Dashboard → Project Settings → API',
      severity: 'error',
    });
  } else if (!isValidSupabaseKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    warnings.push({
      variable: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY does not match expected format. Should start with "eyJ" or "sb_"',
      severity: 'warning',
    });
  }

  // === CONDITIONAL VARIABLES ===

  // Service Role Key (required for admin operations)
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push({
      variable: 'SUPABASE_SERVICE_ROLE_KEY',
      message: 'SUPABASE_SERVICE_ROLE_KEY is not set. Admin operations and service role actions will fail.',
      severity: 'warning',
    });
  } else if (!isValidSupabaseKey(env.SUPABASE_SERVICE_ROLE_KEY)) {
    warnings.push({
      variable: 'SUPABASE_SERVICE_ROLE_KEY',
      message: 'SUPABASE_SERVICE_ROLE_KEY does not match expected format',
      severity: 'warning',
    });
  }

  // Site URL (recommended for OAuth callbacks and email links)
  if (!env.NEXT_PUBLIC_SITE_URL) {
    warnings.push({
      variable: 'NEXT_PUBLIC_SITE_URL',
      message: 'NEXT_PUBLIC_SITE_URL is not set. OAuth redirects may not work correctly.',
      severity: 'warning',
    });
  } else if (!isValidUrl(env.NEXT_PUBLIC_SITE_URL)) {
    warnings.push({
      variable: 'NEXT_PUBLIC_SITE_URL',
      message: 'NEXT_PUBLIC_SITE_URL should be a valid URL',
      severity: 'warning',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates environment and throws an error in development if invalid
 * In production, it logs errors but doesn't throw to prevent crashes
 *
 * Call this early in your application lifecycle (e.g., in layout.tsx or next.config)
 */
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironmentVariables();

  // Always log warnings if present
  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment Configuration Warnings:');
    result.warnings.forEach((warning) => {
      console.warn(`   • ${warning.variable}: ${warning.message}`);
    });
    console.warn('');
  }

  // Handle errors
  if (!result.valid) {
    const errorMessage = [
      '❌ Environment Configuration Errors:',
      ...result.errors.map((error) => `   • ${error.variable}: ${error.message}`),
      '',
      '💡 Setup Instructions:',
      '   1. Copy .env.example to .env.local',
      '   2. Run "supabase start" to get local keys',
      '   3. Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
      '   4. See docs/SUPABASE_SETUP.md for detailed setup guide',
      '',
    ].join('\n');

    if (process.env.NODE_ENV === 'development') {
      // In development, fail fast with a clear error
      throw new Error(errorMessage);
    } else {
      // In production, log the error but don't crash the app
      // This allows the app to continue running (though it may not work correctly)
      console.error(errorMessage);
    }
  }
}

/**
 * Utility to get a validated environment variable
 * Throws an error if the variable is missing or invalid
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Required environment variable ${key} is not set. See docs/SUPABASE_SETUP.md for setup instructions.`
    );
  }
  return value;
}

/**
 * Utility to get an optional environment variable with a default value
 */
export function getOptionalEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}
