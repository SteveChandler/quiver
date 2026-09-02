/**
 * Public-domain and CC0 photos carry no attribution terms, so the licence label
 * is noise on a credit line. CC BY / BY-SA photos require the licence to be
 * named, so those labels stay.
 */
export function isPublicDomainLicense(code: string | null | undefined): boolean {
  if (!code) return false;
  return /cc0|pdm|public.?domain/i.test(code);
}

export function requiresLicenseNotice(code: string | null | undefined): boolean {
  if (!code || isPublicDomainLicense(code)) return false;
  return /\bby\b/i.test(code);
}

const PUBLIC_DOMAIN_TOKEN = String.raw`(?:CC0|PDM|Public[\s-]?domain)(?:\s*v?[\d.]+)?`;

const PUBLIC_DOMAIN_NOTICES: readonly RegExp[] = [
  // "…, dedicated to the public domain under CC0 via Wikimedia Commons."
  /,?\s*dedicated to the public domain(?:\s+under\s+CC0(?:\s*[\d.]+)?)?/gi,
  // "Public-domain image by X" → "Image by X"
  /\bPublic[\s-]?domain\s+(?=image\b|photo\b)/gi,
  // "… · CC0 via Openverse", "… / CC0 1.0", "… (Public domain)"
  new RegExp(String.raw`\s*[·/|,]\s*${PUBLIC_DOMAIN_TOKEN}(?=\s*(?:via\b|$|[.,)]))`, "gi"),
  new RegExp(String.raw`\s*\(\s*${PUBLIC_DOMAIN_TOKEN}\s*\)`, "gi"),
  // "licensed CC0", "under CC0", "released under Public domain"
  new RegExp(String.raw`\s*(?:licensed|released|under|license:?)\s+(?:under\s+)?${PUBLIC_DOMAIN_TOKEN}\b`, "gi"),
];

/** Remove public-domain / CC0 wording from a plain-text credit, keeping the creator and source. */
export function stripPublicDomainNotice(text: string): string {
  let out = text;
  for (const pattern of PUBLIC_DOMAIN_NOTICES) out = out.replace(pattern, "");
  out = out
    .replace(/\s+/g, " ")
    .replace(/\s+([.,)])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .trim();
  // Only a credit that lost its leading "Public-domain" word needs re-capitalising.
  if (/^Public[\s-]?domain\s+/i.test(text) && /^[a-z]/.test(out)) {
    return out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}
