export type RedeemPageState =
  | { kind: "available"; redeemUrl: string }
  | { kind: "missing" }
  | { kind: "malformed" };

export const REVENUECAT_WEB_PURCHASE_URL_PREFIX =
  "rc-38aee70261://redeem_web_purchase";

const MAX_REDEEM_URL_LENGTH = 1200;
const MAX_REDEMPTION_TOKEN_LENGTH = 1024;
const REDEMPTION_TOKEN_PATTERN = /^[-A-Za-z0-9._~+\/=]+$/;
const EXPECTED_REVENUECAT_URL = new URL(
  `${REVENUECAT_WEB_PURCHASE_URL_PREFIX}?redemption_token=token`,
);

function isUsableRedeemUrl(value: string): boolean {
  if (
    value.length > MAX_REDEEM_URL_LENGTH ||
    value.trim() !== value ||
    !value.startsWith(`${REVENUECAT_WEB_PURCHASE_URL_PREFIX}?`)
  ) {
    return false;
  }

  try {
    const url = new URL(value);
    const searchParams = Array.from(url.searchParams.entries());
    const redemptionTokens = url.searchParams.getAll("redemption_token");
    const token = redemptionTokens[0];

    return (
      url.protocol === EXPECTED_REVENUECAT_URL.protocol &&
      url.hostname === EXPECTED_REVENUECAT_URL.hostname &&
      url.pathname === EXPECTED_REVENUECAT_URL.pathname &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.hash &&
      searchParams.length === 1 &&
      redemptionTokens.length === 1 &&
      Boolean(token) &&
      token.length <= MAX_REDEMPTION_TOKEN_LENGTH &&
      REDEMPTION_TOKEN_PATTERN.test(token)
    );
  } catch {
    return false;
  }
}

export function resolveRedeemPageState(value: unknown): RedeemPageState {
  if (value === undefined) return { kind: "missing" };
  if (typeof value !== "string" || !isUsableRedeemUrl(value)) {
    return { kind: "malformed" };
  }

  return { kind: "available", redeemUrl: value };
}
