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

export interface TrialStartedEmailProps {
  displayName: string | null;
  beachName: string | null;
  ctaUrl: string;
  unsubscribeUrl: string;
}

/**
 * Trial day 1. One job: get the trial starter to open the Pro call layer,
 * which is the sprint's defined first-value event. No upsell, no feature list.
 */
export function TrialStartedEmail({
  displayName,
  beachName,
  ctaUrl,
  unsubscribeUrl,
}: TrialStartedEmailProps) {
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
                    You&apos;re on Pro.
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
            {greeting} here’s the one thing worth doing today.
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
              Open {spot} and read the call: the verdict, why it landed there,
              and the red flags underneath it. That’s the part you’re
              trialling, and it’s the part I most want you to argue with.
            </p>
          </PaperPanel>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.55,
              color: TEXT,
              margin: "18px 0 0",
            }}
          >
            Other apps charge for the forecast. Ours is free. Pro is the part
            that reads it beach by beach, because two breaks ten minutes apart
            don&apos;t handle the same swell the same way. That&apos;s what to
            judge over the next two weeks.
          </p>

          <div style={{ textAlign: "center", padding: "20px 0 4px" }}>
            <CTAButton href={ctaUrl}>See your Pro call for {spot}</CTAButton>
          </div>

          <p
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              color: GOLD,
              margin: "26px 0 10px",
            }}
          >
            Two things worth setting up
          </p>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.55,
              color: TEXT,
              margin: "0 0 10px",
            }}
          >
            <strong style={{ color: CREAM }}>Alerts on any beach.</strong> Free
            gives you your home break. Pro lets you watch every spot you might
            actually drive to, so the window finds you instead of the other way
            around.
          </p>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.55,
              color: TEXT,
              margin: 0,
            }}
          >
            <strong style={{ color: CREAM }}>Custom spots.</strong> Drop a pin
            on the break that isn’t in the catalog. Those are free, but
            they are what make the calls yours.
          </p>

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
            If the call looks wrong to you, reply and tell me. That&apos;s more
            useful to me than a five-star review.
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
          You started a Quiver Pro trial ·{" "}
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
