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
} from "@/lib/mailer/theme";

export interface WelcomeEmailProps {
  headline: string;
  bodyParagraphs: readonly string[];
  ctaHref: string;
  ctaLabel: string;
}

export function WelcomeEmail({
  headline,
  bodyParagraphs,
  ctaHref,
  ctaLabel,
}: WelcomeEmailProps): React.ReactElement {
  return (
    <EmailShell>
      <Wordmark />

      <tr>
        <td {...cellBg(CANVAS, { padding: "26px 28px 22px" })}>
          <Eyebrow color={GOLD}>From the crew at quiversurf.app</Eyebrow>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 30,
              lineHeight: 1.08,
              color: CREAM,
              margin: 0,
              transform: `rotate(${STICKER_ROTATIONS.softNeg})`,
            }}
          >
            {headline}
          </h1>
        </td>
      </tr>

      <tr>
        <td {...cellBg(CARD, { padding: "24px 28px" })}>
          <PaperPanel rotation={STICKER_ROTATIONS.softNeg}>
            {bodyParagraphs.map((paragraph, index) => (
              <p
                key={paragraph}
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: PAPER_INK,
                  margin:
                    index === bodyParagraphs.length - 1 ? 0 : "0 0 14px",
                }}
              >
                {paragraph}
              </p>
            ))}
          </PaperPanel>

          <div style={{ textAlign: "center", padding: "22px 0 4px" }}>
            <CTAButton href={ctaHref}>{ctaLabel}</CTAButton>
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
            Every session you log becomes a day you can compare the next call against.
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
            margin: 0,
          }}
        >
          — Steven
          <br />
          quiversurf.app
        </p>
      </Footer>
    </EmailShell>
  );
}
