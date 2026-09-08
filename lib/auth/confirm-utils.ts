type OtpType =
  | "signup"
  | "recovery"
  | "magiclink"
  | "invite"
  | "email_change"
  | string;

function defaultNextForType(type: OtpType | null): string {
  if (type === "recovery") return "/auth/reset";
  // For signup/magiclink/invite/email_change, default to app entry so onboarding can run.
  return "/";
}

/**
 * Resolve a safe post-confirmation redirect path.
 * - Allows only relative paths starting with "/"
 * - Prevents open redirects
 */
export function resolveConfirmNext(type: OtpType | null, next: string | null): string {
  const fallback = defaultNextForType(type);
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u0020]/.test(next)) return fallback;
  const pathname = new URL(next, "https://quiver.invalid").pathname.replace(/\/+$/, "");
  if (pathname === "/auth/sign-up" || pathname === "/auth/sign-in") return fallback;
  return next;
}
