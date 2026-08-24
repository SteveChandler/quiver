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
  FONT_DISPLAY,
  FONT_MONO,
  GOLD,
  MUTED,
  PAPER_INK,
  PAPER_MUTED,
  STICKER_ROTATIONS,
  TEXT,
} from "@/lib/mailer/theme";

export interface AndroidBetaInstructionsEmailProps {
  groupUrl: string;
  playUrl: string | null;
}

export function AndroidBetaInstructionsEmail({
  groupUrl,
  playUrl,
}: AndroidBetaInstructionsEmailProps) {
  return (
    <EmailShell>
      <Wordmark />

      <tr>
        <td {...cellBg(CANVAS, { padding: "26px 28px 22px" })}>
          <Eyebrow color={GOLD}>Android beta</Eyebrow>
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
            Get Quiver installed on Android
          </h1>
        </td>
      </tr>

      <tr>
        <td {...cellBg(CARD, { padding: "24px 28px" })}>
          <p
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.45,
              color: TEXT,
              margin: "0 0 18px",
            }}
          >
            Android beta access is available now. Closed testing takes a few
            Google Play steps, so keep this email handy.
          </p>

          <PaperPanel rotation={STICKER_ROTATIONS.soft}>
            <ol
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 500,
                fontSize: 14,
                lineHeight: 1.55,
                color: PAPER_INK,
                margin: 0,
                paddingLeft: 20,
              }}
            >
              <li>Join the Quiver Android tester group with your Google Play account.</li>
              <li>Opt in on Google Play after the group accepts your account.</li>
              <li>Install Quiver from Google Play on that same account.</li>
            </ol>
          </PaperPanel>

          <p
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 500,
              fontSize: 14,
              lineHeight: 1.5,
              color: TEXT,
              margin: "18px 0 0",
            }}
          >
            Use personalized surf decisions, best-window guidance, saved spots,
            alerts, and session logging — then tell us where the Android
            experience needs work.
          </p>

          <div style={{ textAlign: "center", padding: "24px 0 16px" }}>
            <CTAButton href={groupUrl}>Join tester group</CTAButton>
          </div>

          {playUrl ? (
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
              After joining the group, opt in on Play:{" "}
              <a href={playUrl} style={{ color: GOLD }}>
                {playUrl}
              </a>
            </p>
          ) : null}

          <p
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              lineHeight: 1.4,
              color: MUTED,
              wordBreak: "break-all",
              margin: "12px 0 0",
            }}
          >
            Tester group: {groupUrl}
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
            fontSize: 10,
            letterSpacing: "0.5px",
            color: MUTED,
            margin: 0,
          }}
        >
          Sent because you asked for Quiver Android beta access.
        </p>
      </Footer>
    </EmailShell>
  );
}
