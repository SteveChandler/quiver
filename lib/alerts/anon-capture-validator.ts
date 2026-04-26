const ALLOWED_PRESETS = new Set(["glass_off", "big_day", "mellow_session"] as const);
type AllowedPreset = "glass_off" | "big_day" | "mellow_session";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_PATH_RE = /^\/[a-z0-9\-/]+$/;

export type ValidatedCapture = {
  email: string;
  beach_id: string;
  preset_type: AllowedPreset;
  return_path: string;
  website: string;
};

export type ValidationResult =
  | { ok: true; value: ValidatedCapture }
  | { ok: false; error: string };

export function validateAnonCapture(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null) return { ok: false, error: "invalid_input" };
  const i = input as Record<string, unknown>;

  // Honeypot — if filled, accept silently but flag.
  const website = typeof i.website === "string" ? i.website : "";
  if (website.trim().length > 0) return { ok: false, error: "honeypot" };

  if (typeof i.email !== "string") return { ok: false, error: "missing_email" };
  const email = i.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "invalid_email" };

  if (typeof i.beach_id !== "string" || !UUID_RE.test(i.beach_id)) {
    return { ok: false, error: "invalid_beach_id" };
  }

  if (typeof i.preset_type !== "string" || !ALLOWED_PRESETS.has(i.preset_type as AllowedPreset)) {
    return { ok: false, error: "invalid_preset" };
  }

  if (typeof i.return_path !== "string" || !SAFE_PATH_RE.test(i.return_path)) {
    return { ok: false, error: "invalid_return_path" };
  }
  // Defense-in-depth: block protocol-relative URLs even though SAFE_PATH_RE
  // requires single leading "/", because a future regex tweak could regress.
  if (i.return_path.startsWith("//")) return { ok: false, error: "invalid_return_path" };

  return {
    ok: true,
    value: {
      email,
      beach_id: i.beach_id,
      preset_type: i.preset_type as AllowedPreset,
      return_path: i.return_path,
      website: "",
    },
  };
}
