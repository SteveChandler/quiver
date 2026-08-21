import * as React from "react";

import {
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

export interface TrialEndedEmailProps {
  displayName: string | null;
  beachName: string | null;
  unsubscribeUrl: string;
}

/**
 * Trial lapsed without converting. One job: capture the objection.
 *
 * Deliberately has no CTA button — the action is a reply. A win-back offer
 * here would trade the sprint's most valuable output (why it didn't land) for
 * a discount conversion we can't learn from.
 */
export function TrialEndedEmail({
  displayName,
  beachName,
  unsubscribeUrl,
}: TrialEndedEmailProps) {
  const greeting = displayName ? `Hey ${displayName},` : "Hey,";
  const spot = beachName ?? "your home break";

  return (
    <EmailShell>
      <Wordmark />

      <tr>
        <td {...cellBg(CANVAS, { padding: "26px 28px 20px" })}>
          <Eyebrow color={GOLD}>One question</Eyebrow>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 30,
              lineHeight: 1.06,
              color: CREAM,
              margin: 0,
              transform: `rotate(${STICKER_ROTATIONS.softNeg})`,
            }}
          >
            What would make it worth it?
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
            {greeting} your trial ended and you didn&apos;t stay on Pro.
            That&apos;s a useful signal, and I&apos;d like the detail behind it.
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
              What would Quiver need to get right for you to keep it?
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
            Just hit reply. One sentence is plenty.
          </p>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.55,
              color: MUTED,
              margin: "12px 0 0",
            }}
          >
            The forecast for {spot} stays exactly as it was, and your session
            log is untouched. Both were always free.
          </p>
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
          You recently trialled Quiver Pro ·{" "}
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
