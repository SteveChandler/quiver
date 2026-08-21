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
  TEXT,
} from "@/lib/mailer/theme";

export interface TrialInvitationEmailProps {
  displayName: string | null;
  beachName: string | null;
  ctaUrl: string;
  unsubscribeUrl: string;
}

export function TrialInvitationEmail({
  displayName,
  beachName,
  ctaUrl,
  unsubscribeUrl,
}: TrialInvitationEmailProps) {
  const greeting = displayName ? `Hey ${displayName},` : "Hey,";
  const spot = beachName ?? "your home break";

  return (
    <EmailShell>
      <Wordmark />

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
                    Two weeks of the Pro. Free.
                  </h1>
                </td>
                <td
                  align="right"
                  width="78"
                  style={{ verticalAlign: "top", width: 78 }}
                >
                  <Stamp fontSize={12} padding="11px 13px">
                    14 DAYS
                  </Stamp>
                </td>
              </tr>
            </tbody>
          </table>
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
            {greeting}
          </p>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.55,
              color: TEXT,
              margin: "0 0 18px",
            }}
          >
            You&apos;ve got {spot} set as your home break. The free forecast gives
            you the data. That stays free either way.
          </p>

          <PaperPanel rotation={STICKER_ROTATIONS.softNeg}>
            <Eyebrow color={TEAL}>The call layer</Eyebrow>
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
              Pro adds the call layer on top: the surf-call verdict for {spot},
              how the window matches sessions you&apos;ve logged, board picks from
              your quiver, and alerts that find the window before it arrives.
              Two breaks ten minutes apart don&apos;t handle the same swell the same
              way. The call layer is where that shows up.
            </p>
          </PaperPanel>

          <div style={{ textAlign: "center", padding: "20px 0 4px" }}>
            <CTAButton href={ctaUrl}>Start your free 14-day trial</CTAButton>
          </div>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 14,
              lineHeight: 1.5,
              color: MUTED,
              margin: "18px 0 0",
              textAlign: "center",
            }}
          >
            $4.99/mo or $39.99/yr after the trial. The first charge comes only
            after the full 14 days. Cancel any time before then and you
            aren&apos;t charged.
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
          You use Quiver free ·{" "}
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
