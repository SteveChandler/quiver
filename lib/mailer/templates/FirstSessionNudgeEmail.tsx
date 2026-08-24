import * as React from "react";

import {
  CTAButton,
  EmailShell,
  Eyebrow,
  Footer,
  PaperPanel,
  Stamp,
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
  TEAL,
} from "@/lib/mailer/theme";

export interface FirstSessionNudgeEmailProps {
  displayName: string | null;
  logSessionUrl: string;
  unsubscribeUrl: string;
}

export function FirstSessionNudgeEmail({
  displayName,
  logSessionUrl,
  unsubscribeUrl,
}: FirstSessionNudgeEmailProps) {
  const greeting = displayName ? `Hey ${displayName}!` : "Hey there!";

  return (
    <EmailShell>
      <Wordmark />

      {/* Masthead — onboarding headline + rotated DAY 1 stamp */}
      <tr>
        <td {...cellBg(CANVAS, { padding: "26px 28px 20px" })}>
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            width="100%"
            style={{ borderCollapse: "collapse" }}
          >
            <tbody>
              <tr>
                <td style={{ verticalAlign: "top" }}>
                  <Eyebrow color={GOLD}>First session</Eyebrow>
                  <h1
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 28,
                      lineHeight: 1.05,
                      color: CREAM,
                      margin: 0,
                      transform: `rotate(${STICKER_ROTATIONS.softNeg})`,
                    }}
                  >
                    Your first forecast&apos;s up.
                  </h1>
                </td>
                <td
                  align="right"
                  width="78"
                  style={{ verticalAlign: "top", width: 78 }}
                >
                  <Stamp fontSize={12} padding="11px 13px">
                    DAY 1
                  </Stamp>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>

      {/* Body */}
      <tr>
        <td {...cellBg(CARD, { padding: "24px 28px" })}>
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.5,
              color: MUTED,
              margin: "0 0 20px",
            }}
          >
            {greeting}
          </p>

          {/* Value prop — cream paper note */}
          <PaperPanel rotation={STICKER_ROTATIONS.softNeg}>
            <Eyebrow color={TEAL}>Why the log matters</Eyebrow>
            <p
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 500,
                fontSize: 15,
                lineHeight: 1.4,
                color: PAPER_INK,
                margin: 0,
              }}
            >
              Three sessions in, you&apos;ve got a record of your own
              days&mdash;size, wind, time of day&mdash;to compare the next call
              against.
            </p>
          </PaperPanel>

          {/* CTA — rotated orange button */}
          <div style={{ textAlign: "center", padding: "18px 0 2px" }}>
            <CTAButton href={logSessionUrl}>Log your first session</CTAButton>
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
            fontSize: 10,
            letterSpacing: "0.5px",
            color: "rgba(184,199,224,0.65)",
            margin: 0,
          }}
        >
          You just signed up for Quiver ·{" "}
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
