/*
 * Copy for the spot install asks (cam install sheet and install bar), approved
 * by Steven on 2026-11-27 (feature key `cam_install_sheet`):
 *   A (base): free home-break alerts. True for one spot, the home break.
 *   B: only when tomorrow's displayed height is bigger than today's.
 * Free alerts are home-beach only in the product, so nothing here promises more.
 */

export type SpotAskVariant = "a" | "b";

export const HOME_BREAK_HEADLINE = "Free alerts for your home break";
export const HOME_BREAK_BODY =
  "Alerts for your home break are free. We ping you when it turns on.";
export const FREE_ALERTS_CTA = "Get free alerts";
const DAWN_PING_BODY =
  "Get a dawn ping with the best window before you drive.";
const DAWN_PING_CTA = "Ping me at dawn";

export interface SpotAskCopy {
  variant: SpotAskVariant;
  headline: string;
  body: string;
  cta: string;
}

interface SpotAskCopyInput {
  spotName: string | null | undefined;
  tomorrowHeight?: string | null;
}

/** A height label is only usable when it carries a number, never "—" or "Flat". */
function isUsableHeight(label: string | null | undefined): label is string {
  return typeof label === "string" && /\d/.test(label);
}

export function buildSpotAskCopy({
  spotName,
  tomorrowHeight = null,
}: SpotAskCopyInput): SpotAskCopy {
  const spot = spotName?.trim() ?? "";

  if (!spot) {
    return {
      variant: "a",
      headline: HOME_BREAK_HEADLINE,
      body: HOME_BREAK_BODY,
      cta: FREE_ALERTS_CTA,
    };
  }

  if (isUsableHeight(tomorrowHeight)) {
    return {
      variant: "b",
      headline: `${tomorrowHeight.trim()} at ${spot} tomorrow`,
      body: DAWN_PING_BODY,
      cta: DAWN_PING_CTA,
    };
  }

  return {
    variant: "a",
    headline: `Make ${spot} your home break`,
    body: HOME_BREAK_BODY,
    cta: FREE_ALERTS_CTA,
  };
}
