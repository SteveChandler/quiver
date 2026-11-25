// Prefer the new sb_secret_/sb_publishable_ keys that the Edge runtime injects
// as JSON maps, so the functions keep working after the legacy JWT keys are
// deactivated. Fall back to the legacy env vars until the new keys exist.

export type EnvGetter = (name: string) => string | undefined;

const NEW_KEY_NAME = "default";

function readNamedKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return undefined;
    const value = (parsed as Record<string, unknown>)[NEW_KEY_NAME];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function resolveSecretKey(getEnv: EnvGetter): string | undefined {
  return readNamedKey(getEnv("SUPABASE_SECRET_KEYS")) ?? getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function resolvePublishableKey(getEnv: EnvGetter): string | undefined {
  return readNamedKey(getEnv("SUPABASE_PUBLISHABLE_KEYS")) ?? getEnv("SUPABASE_ANON_KEY");
}
