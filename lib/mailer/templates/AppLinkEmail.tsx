import * as React from "react";

import {
  CTAButton,
  EmailShell,
  Eyebrow,
  Footer,
  PaperPanel,
  Sticker,
  StickerStrip,
  Wordmark,
} from "@/lib/mailer/components";
import {
  CANVAS,
  CARD,
  cellBg,
  CREAM,
  FONT_DISPLAY,
  FONT_MONO,
  GOLD,
  MUTED,
  PAPER_INK,
  PAPER_MUTED,
  STICKER_ROTATIONS,
  TEXT,
} from "@/lib/mailer/theme";

export interface AppLinkEmailProps {
  /** Absolute /app handoff URL with attribution params. */
  appUrl: string;
}

export function AppLinkEmail({ appUrl }: AppLinkEmailProps) {
  return (
    <EmailShell>
      <Wordmark />

      {/* Masthead — editorial headline + small fin accent */}
      <tr>
        <td {...cellBg(CANVAS, { padding: "26px 28px 22px" })}>
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
                  <Eyebrow color={GOLD}>Take it with you</Eyebrow>
                  <h1
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 30,
                      lineHeight: 1.05,
                      color: CREAM,
                      margin: 0,
                      transform: `rotate(${STICKER_ROTATIONS.softNeg})`,
                    }}
                  >
                    Open Quiver on your phone
                  </h1>
                </td>
                <td
                  align="right"
                  width="64"
                  style={{ verticalAlign: "top", width: 64 }}
                >
                  <Sticker
                    sticker="singleFin"
                    width={52}
                    rotation={STICKER_ROTATIONS.hard}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>

      {/* Body — copy, CTA, and a cream paste-link note */}
      <tr>
        <td {...cellBg(CARD, { padding: "24px 28px" })}>
          <p
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.45,
              color: TEXT,
              margin: "0 0 22px",
            }}
          >
            Tap below on your phone for the surf call, beach intel, and your
            session log in the app.
          </p>

          <div style={{ textAlign: "center", padding: "2px 0 24px" }}>
            <CTAButton href={appUrl}>Get Quiver</CTAButton>
          </div>

          <PaperPanel rotation={STICKER_ROTATIONS.soft}>
            <p
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 500,
                fontSize: 13,
                lineHeight: 1.4,
                color: PAPER_MUTED,
                margin: "0 0 8px",
              }}
            >
              Or paste this link into your phone&rsquo;s browser:
            </p>
            <p
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12,
                lineHeight: 1.4,
                color: PAPER_INK,
                wordBreak: "break-all",
                margin: 0,
              }}
            >
              {appUrl}
            </p>
          </PaperPanel>
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
            color: MUTED,
            margin: 0,
          }}
        >
          Sent because you asked for the Quiver app link.
        </p>
      </Footer>
    </EmailShell>
  );
}
