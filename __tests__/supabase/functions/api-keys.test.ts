import { resolvePublishableKey, resolveSecretKey } from "@/supabase/functions/_shared/api-keys";

const envOf = (vars: Record<string, string>) => (name: string): string | undefined => vars[name];

describe("Edge Function API key resolution", () => {
  it("prefers the default new secret key over the legacy service_role key", () => {
    const getEnv = envOf({
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_new", other: "sb_secret_other" }),
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service",
    });
    expect(resolveSecretKey(getEnv)).toBe("sb_secret_new");
  });

  it("prefers the default new publishable key over the legacy anon key", () => {
    const getEnv = envOf({
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: "sb_publishable_new" }),
      SUPABASE_ANON_KEY: "legacy-anon",
    });
    expect(resolvePublishableKey(getEnv)).toBe("sb_publishable_new");
  });

  it("falls back to legacy keys when the new keys are absent, empty or malformed", () => {
    const legacy = { SUPABASE_SERVICE_ROLE_KEY: "legacy-service", SUPABASE_ANON_KEY: "legacy-anon" };
    for (const raw of [undefined, "", "{}", "not json", "[]", JSON.stringify({ other: "x" }), JSON.stringify({ default: "" })]) {
      const vars: Record<string, string> = { ...legacy };
      if (raw !== undefined) {
        vars.SUPABASE_SECRET_KEYS = raw;
        vars.SUPABASE_PUBLISHABLE_KEYS = raw;
      }
      expect(resolveSecretKey(envOf(vars))).toBe("legacy-service");
      expect(resolvePublishableKey(envOf(vars))).toBe("legacy-anon");
    }
  });

  it("never returns a non-default named key", () => {
    const getEnv = envOf({ SUPABASE_SECRET_KEYS: JSON.stringify({ "vercel-web": "sb_secret_vercel" }) });
    expect(resolveSecretKey(getEnv)).toBeUndefined();
  });
});
