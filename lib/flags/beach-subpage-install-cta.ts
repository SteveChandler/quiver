export const BEACH_SUBPAGE_INSTALL_CTA_ENABLED = "BEACH_SUBPAGE_INSTALL_CTA_ENABLED";

export function isBeachSubPageInstallCtaEnabled(): boolean {
  return process.env[BEACH_SUBPAGE_INSTALL_CTA_ENABLED] === "true";
}
