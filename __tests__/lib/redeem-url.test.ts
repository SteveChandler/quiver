import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  REVENUECAT_WEB_PURCHASE_URL_PREFIX,
  resolveRedeemPageState,
  type RedeemPageState,
} from "@/lib/redeem/redeem-url";

const NATIVE_REVENUECAT_CLIENT_PATH = resolve(
  process.cwd(),
  "../quiver-native/src/lib/subscription/revenuecat-client.ts",
);

/**
 * The native repo is a sibling checkout, so it is present locally but NOT in CI,
 * where only `quiver` is cloned. Return null there rather than throwing — the
 * always-runnable assertion below is the real guard.
 */
function readNativeRevenueCatWebPurchasePrefix(): string | null {
  let nativeSource: string;
  try {
    nativeSource = readFileSync(NATIVE_REVENUECAT_CLIENT_PATH, "utf8");
  } catch {
    return null;
  }
  const prefix = nativeSource.match(
    /export const REVENUECAT_WEB_PURCHASE_URL_PREFIX\s*=\s*["']([^"']+)["']/,
  )?.[1];

  if (!prefix) {
    throw new Error(
      `Could not read REVENUECAT_WEB_PURCHASE_URL_PREFIX from ${NATIVE_REVENUECAT_CLIENT_PATH}`,
    );
  }

  return prefix;
}

const VALID_REDEEM_URL = `${REVENUECAT_WEB_PURCHASE_URL_PREFIX}?redemption_token=sample-token`;

describe("resolveRedeemPageState", () => {
  it("returns missing when redeem_url is absent", () => {
    expect(resolveRedeemPageState(undefined)).toEqual({ kind: "missing" });
  });

  it("accepts the exact project RevenueCat custom-scheme redemption link", () => {
    const state: RedeemPageState = resolveRedeemPageState(VALID_REDEEM_URL);

    expect(state).toEqual({
      kind: "available",
      redeemUrl: VALID_REDEEM_URL,
    });
  });

  it.each([
    "https://evil.com/phish",
    "https://app.quiversurf.app/redeem/token",
  ])("rejects an HTTPS handoff: %s", (value) => {
    expect(
      resolveRedeemPageState(value),
    ).toEqual({ kind: "malformed" });
  });

  it("rejects a foreign RevenueCat-shaped scheme", () => {
    expect(
      resolveRedeemPageState(
        "rc-abc123://redeem_web_purchase?redemption_token=sample-token",
      ),
    ).toEqual({ kind: "malformed" });
  });

  it("rejects an over-long redemption URL", () => {
    expect(
      resolveRedeemPageState(
        `${REVENUECAT_WEB_PURCHASE_URL_PREFIX}?redemption_token=${"a".repeat(5000)}`,
      ),
    ).toEqual({ kind: "malformed" });
  });

  it.each([
    `${REVENUECAT_WEB_PURCHASE_URL_PREFIX}`,
    `${REVENUECAT_WEB_PURCHASE_URL_PREFIX}?redemption_token=`,
    `${REVENUECAT_WEB_PURCHASE_URL_PREFIX}?redemption_token=has%20space`,
    `${REVENUECAT_WEB_PURCHASE_URL_PREFIX}?redemption_token=one&redemption_token=two`,
    `${REVENUECAT_WEB_PURCHASE_URL_PREFIX}?redemption_token=one&extra=value`,
  ])("rejects malformed redemption token shape %p", (value) => {
    expect(resolveRedeemPageState(value)).toEqual({ kind: "malformed" });
  });

  // Runs everywhere, including CI. Changing the scheme breaks every already-issued
  // redemption deep link, so it is pinned to a literal on purpose.
  it("pins the RevenueCat web-purchase scheme", () => {
    expect(REVENUECAT_WEB_PURCHASE_URL_PREFIX).toBe(
      "rc-38aee70261://redeem_web_purchase",
    );
  });

  // Only runs where the sibling native checkout exists. Skipped in CI by design.
  it("keeps the web RevenueCat prefix in parity with native", () => {
    const nativePrefix = readNativeRevenueCatWebPurchasePrefix();
    // Absent in CI, where only `quiver` is cloned. The pinned-scheme test above
    // is the guard that always runs; this one adds cross-repo parity when it can.
    if (nativePrefix === null) return;
    expect(REVENUECAT_WEB_PURCHASE_URL_PREFIX).toBe(nativePrefix);
  });

  it.each([
    "",
    "not-a-url",
    "http://app.quiversurf.app/redeem/token",
    "javascript:alert(1)",
    "rc-38aee70261:/redeem_web_purchase",
    ` ${VALID_REDEEM_URL}`,
    42,
    null,
  ])("returns malformed for %p", (value) => {
    expect(resolveRedeemPageState(value)).toEqual({ kind: "malformed" });
  });
});
