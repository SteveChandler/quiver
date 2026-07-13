/**
 * Partner QR URL builder + code validator.
 *
 * A "partner" is a user whose `referral_code` (or signed invite JWT) is printed
 * on a QR. The partner's human-readable label rides on UTM params, which the
 * landing threads into event metadata. Zero schema change — attribution reuses
 * the existing referrals spine.
 *
 * Pure module: no I/O, no side effects.
 */

/**
 * Validate a partner code. Mirrors the referral-code guard in
 * `actions/referral-actions.ts` (`/^[A-Z0-9]{4,12}$/i`) to prevent SQL wildcard
 * injection (`%`/`_` are `ilike` wildcards) and keep partner === referral codes.
 */
export function isValidPartnerCode(code: string): boolean {
  return /^[A-Z0-9]{4,12}$/i.test(code);
}

interface BuildPartnerQrUrlArgs {
  partnerCode: string;
  siteUrl: string;
}

/**
 * Build the absolute, attributed partner landing URL. Deterministic param order
 * via `URLSearchParams`; uppercases the code; trims a trailing slash on siteUrl
 * (mirrors `buildAbsoluteInviteUrl` in `app/invite/[token]/page.tsx`).
 */
export function buildPartnerQrUrl({
  partnerCode,
  siteUrl,
}: BuildPartnerQrUrlArgs): string {
  const code = partnerCode.toUpperCase();
  const search = new URLSearchParams({
    ref: code,
    utm_source: "partner_qr",
    utm_medium: "partner_qr",
    utm_campaign: "partner_access",
    utm_content: code,
  });
  return `${siteUrl.replace(/\/$/, "")}/p/${code}?${search.toString()}`;
}

/**
 * Build the `quiver://` app-scheme deep link for an already-installed app
 * (mirrors `appSchemeUrl` in `invite-landing-client.tsx`).
 */
export function buildPartnerAppSchemeUrl(partnerCode: string): string {
  return `quiver://p/${partnerCode.toUpperCase()}`;
}
