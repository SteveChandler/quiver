import * as React from "react";

import {
  CTAButton,
  EmailShell,
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
  MUTED,
  PAPER_INK,
  STICKER_ROTATIONS,
  TEXT,
} from "@/lib/mailer/theme";

export interface FounderStoryEmailProps {
  displayName: string | null;
  ctaUrl: string;
}

/**
 * Day-1 campaign email. Short on purpose: four beats, one CTA, one honest
 * caveat. The story spine is canon —
 * `Brand-Vault/marketing/founding-crew-ltd-launch-playbook.md`.
 */
export function FounderStoryEmail({
  displayName,
  ctaUrl,
}: FounderStoryEmailProps) {
  const greeting = displayName ? `Hey ${displayName},` : "Hey,";

  return (
    <EmailShell>
      <Wordmark />

      <tr>
        <td {...cellBg(CANVAS, { padding: "30px 28px 26px" })}>
          <div style={{ marginBottom: 18 }}>
            <Stamp fontSize={11} padding="9px 12px">
              WHY THIS EXISTS
            </Stamp>
          </div>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 38,
              lineHeight: 1.02,
              color: CREAM,
              margin: 0,
              transform: `rotate(${STICKER_ROTATIONS.softNeg})`,
            }}
          >
            Too many wasted drives.
          </h1>
        </td>
      </tr>

      <tr>
        <td {...cellBg(CARD, { padding: "24px 28px 28px" })}>
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.55,
              color: MUTED,
              margin: "0 0 18px",
            }}
          >
            {greeting}
          </p>

          <PaperPanel rotation={STICKER_ROTATIONS.softNeg}>
            <p
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 500,
                fontSize: 17,
                lineHeight: 1.4,
                color: PAPER_INK,
                margin: "0 0 12px",
              }}
            >
              The forecast said fair. The rating was green. I drove out anyway.
              Flat.
            </p>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 15,
                lineHeight: 1.55,
                color: PAPER_INK,
                margin: "0 0 12px",
              }}
            >
              I&apos;d checked the cams, the maps, the buoys, the wind and the
              tide, and still couldn&apos;t answer the only question that
              mattered: is it working, and when do I go?
            </p>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 15,
                lineHeight: 1.55,
                color: PAPER_INK,
                margin: "0 0 12px",
              }}
            >
              Cams don&apos;t cover every break. And two spots ten minutes apart
              don&apos;t handle the same swell the same way.
            </p>
            <p
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 16,
                lineHeight: 1.4,
                color: PAPER_INK,
                margin: 0,
              }}
            >
              The data wasn&apos;t missing. The decision was.
            </p>
          </PaperPanel>

          <p
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 500,
              fontSize: 19,
              lineHeight: 1.35,
              color: CREAM,
              margin: "26px 0 0",
            }}
          >
            I built Quiver because I wanted to make it simple.
          </p>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.55,
              color: TEXT,
              margin: "14px 0 0",
            }}
          >
            For the next two weeks I&apos;m asking a small group of surfers to
            use Pro for one real surf decision.
          </p>

          <div style={{ textAlign: "center", padding: "24px 0 6px" }}>
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
            It&apos;s early, and it will still get calls wrong. That&apos;s
            exactly why I want real surfers on it. Reply and tell me where it
            helps or breaks. I read every one.
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
          Reply &ldquo;no thanks&rdquo; and I&apos;ll leave you out of these.
        </p>
      </Footer>
    </EmailShell>
  );
}
