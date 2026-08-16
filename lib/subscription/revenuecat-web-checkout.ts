const REVENUECAT_WEB_CHECKOUT_URL =
  process.env.NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL?.trim() ?? "";

const REVENUECAT_FUNNEL_HOST = "signup.cat";

/**
 * Build a RevenueCat Web Purchase Link or published Funnel URL.
 *
 * RevenueCat Web Purchase Links require the App User ID as a path segment for
 * identified purchases. Published Funnels accept it as an app_user_id query
 * parameter and carry it into checkout. The URL is intentionally fail-closed
 * so an accidental local or insecure configuration cannot send a user ID to a
 * non-HTTPS destination.
 */
export function buildRevenueCatWebCheckoutUrl(userId: string): string | null {
  if (!userId || !REVENUECAT_WEB_CHECKOUT_URL) return null;

  let checkoutUrl: URL;
  try {
    checkoutUrl = new URL(REVENUECAT_WEB_CHECKOUT_URL);
  } catch {
    return null;
  }

  if (checkoutUrl.protocol !== "https:") return null;
  if (checkoutUrl.username || checkoutUrl.password) return null;

  if (checkoutUrl.hostname === REVENUECAT_FUNNEL_HOST) {
    checkoutUrl.searchParams.set("app_user_id", userId);
    return checkoutUrl.toString();
  }

  const basePath = checkoutUrl.pathname.replace(/\/+$/, "");
  checkoutUrl.pathname = `${basePath}/${encodeURIComponent(userId)}`;
  return checkoutUrl.toString();
}

export function hasRevenueCatWebCheckoutConfiguration(): boolean {
  return buildRevenueCatWebCheckoutUrl("configuration-check") !== null;
}
