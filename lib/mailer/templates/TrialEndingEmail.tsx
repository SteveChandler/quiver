import * as React from "react";

import {
  CTAButton,
  EmailShell,
  Eyebrow,
  Footer,
  PaperPanel,
  StickerStrip,
  Wordmark,
} from "@/lib/mailer/components";
import {
  CANVAS,
  CARD,
  cellBg,
  CREAM,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  GOLD,
  MUTED,
  PAPER_INK,
  STICKER_ROTATIONS,
  TEXT,
} from "@/lib/mailer/theme";

export interface TrialEndingEmailProps {
  displayName: string | null;
  /** Human-readable trial end date, e.g. "Friday, September 5". */
  trialEndsOn: string;
  /** Human-readable first charge date. Same day as the trial end. */
  chargeOn: string;
  /** Rendered price string, e.g. "$4.99/mo". */
  price: string;
  manageUrl: string;
  unsubscribeUrl: string;
}

/**
 * Trial day 11. One job: state the charge date plainly before we charge.
 * This is a trust asset, not a retention asset — no persuasion, no feature
 * recap, no discount. Cancelling is presented as a normal outcome.
 */
export function TrialEndingEmail({
  displayName,
  trialEndsOn,
  chargeOn,
  price,
  manageUrl,
  unsubscribeUrl,
}: TrialEndingEmailProps) {
  const greeting = displayName ? `Hey ${displayName},` : "Hey,";

  return (
    <EmailShell>
      <Wordmark />

      <tr>
        <td {...cellBg(CANVAS, { padding: "26px 28px 20px" })}>
          <Eyebrow color={GOLD}>Quiver Pro</Eyebrow>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 29,
              lineHeight: 1.06,
              color: CREAM,
              margin: 0,
              transform: `rotate(${STICKER_ROTATIONS.softNeg})`,
            }}
          >
            Your trial ends {trialEndsOn}.
          </h1>
        </td>
      </tr>

      <tr>
        <td {...cellBg(CARD, { padding: "24px 28px" })}>
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.55,
              color: TEXT,
              margin: "0 0 18px",
            }}
          >
            {greeting} straight up, so nothing surprises you:
          </p>

          <PaperPanel rotation={STICKER_ROTATIONS.softNeg}>
            <p
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 500,
                fontSize: 15,
                lineHeight: 1.45,
                color: PAPER_INK,
                margin: 0,
              }}
            >
              Your Quiver Pro trial ends {trialEndsOn}, and {price} is charged
              on {chargeOn} unless you cancel before then. Cancelling takes
              about fifteen seconds in your App Store subscription settings.
            </p>
          </PaperPanel>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.55,
              color: TEXT,
              margin: "20px 0 0",
            }}
          >
            If it&apos;s been useful, there&apos;s nothing to do.
          </p>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.55,
              color: TEXT,
              margin: "12px 0 0",
            }}
          >
            If you cancel, you keep the full forecast for every beach. What
            goes back to the free tier is the call layer: two ranked spots
            instead of all of them, and two days of the week instead of seven.
          </p>

          <div style={{ textAlign: "center", padding: "22px 0 4px" }}>
            <CTAButton href={manageUrl} variant="secondary">
              Manage your subscription
            </CTAButton>
          </div>
        </td>
      </tr>

      <tr>
        <td {...cellBg(CARD, { padding: "0 28px 22px" })}>
          <StickerStrip />
        </td>
      </tr>

      <Footer>
        <p
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            lineHeight: 1.6,
            color: MUTED,
            margin: "0 0 8px",
          }}
        >
          — Steve
          <br />
          quiversurf.app
        </p>
        <p
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: "0.5px",
            color: "rgba(184,199,224,0.65)",
            margin: 0,
          }}
        >
          You have an active Quiver Pro trial ·{" "}
          <a
            href={unsubscribeUrl}
            style={{ color: MUTED, textDecoration: "underline" }}
          >
            Manage email preferences
          </a>
        </p>
      </Footer>
    </EmailShell>
  );
}
