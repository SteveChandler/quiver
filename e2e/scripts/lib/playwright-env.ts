import { existsSync } from "fs";
import { config as dotenvConfig } from "dotenv";

export interface LocalSupabaseEnv {
  anonKey: string;
  serviceRoleKey: string;
  url: string;
}

export function loadPlaywrightEnv(): void {
  const lockedEnv = new Map<string, string | undefined>(
    Object.entries(process.env)
  );

  dotenvConfig();
  dotenvConfig({ path: ".env.playwright", override: true });

  if (existsSync(".env.playwright.local")) {
    dotenvConfig({ path: ".env.playwright.local", override: true });
  }

  for (const [key, value] of lockedEnv.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function isLocalSupabaseUrl(url: string): boolean {
  return url.includes("127.0.0.1") || url.includes("localhost");
}

export function resolvePsqlExecutable(): string {
  const commonInstallPaths = [
    "/opt/homebrew/bin/psql",
    "/usr/local/bin/psql",
    "/Applications/Postgres.app/Contents/Versions/latest/bin/psql",
  ];

  return commonInstallPaths.find((candidate) => existsSync(candidate)) ?? "psql";
}

export function requireLocalSupabaseEnv(): LocalSupabaseEnv {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (!isLocalSupabaseUrl(url)) {
    throw new Error(`Refusing to use non-local Supabase URL: ${url}`);
  }

  return {
    anonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    url,
  };
}
