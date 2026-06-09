export function validateEnvironment(env = process.env) {
  const errors = [];
  const warnings = [];

  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is required");
  }
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  }
  if (env.VERCEL_ENV === "production" && !env.CRON_SECRET) {
    errors.push("CRON_SECRET is required for Vercel production cron authentication");
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push(
      "SUPABASE_SERVICE_ROLE_KEY not set - admin operations will fail",
    );
  }
  if (!env.NEXT_PUBLIC_SITE_URL) {
    warnings.push(
      "NEXT_PUBLIC_SITE_URL not set - OAuth redirects may not work correctly",
    );
  }

  if (warnings.length > 0) {
    console.warn("⚠️  Environment Configuration Warnings:");
    warnings.forEach((warning) => console.warn(`   • ${warning}`));
  }

  if (errors.length === 0) {
    return;
  }

  throw new Error(
    [
      "❌ Environment Configuration Errors:",
      ...errors.map((error) => `   • ${error}`),
      "",
      "💡 Setup: Copy .env.example to .env.local and fill in your values",
      "   See docs/SUPABASE_SETUP.md for detailed instructions",
    ].join("\n"),
  );
}
