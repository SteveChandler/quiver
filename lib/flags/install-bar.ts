/**
 * Switch for the install bar. Defaults OFF.
 *
 * NEXT_PUBLIC_ on purpose: the page HTML is shared at the CDN and identical for
 * everyone, and the bar, the iPhone banner gate and the in-page install asks
 * all decide in the browser from this one value. The literal property access
 * is required so Next inlines it at build time; changing it needs a redeploy.
 */
export function isInstallBarEnabled(): boolean {
  return process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED === "true";
}
