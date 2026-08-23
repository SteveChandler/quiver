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
  PAPER_MUTED,
  STICKER_ROTATIONS,
  TEXT,
} from "@/lib/mailer/theme";

export interface CheckInEmailProps {
  displayName: string | null;
}

const OPTIONS: readonly { n: string; text: string }[] = [
  { n: "1", text: "Good. I check it before I surf." },
  { n: "2", text: "Okay. Still figuring it out." },
  { n: "3", text: "Honestly, I haven't really used it." },
];

/**
 * First-90-days check-in. No CTA button on purpose: the action is a reply, and
 * a button would compete with it. The numbered options are the whole mechanism,
 * so they get the cream panel and the most visual weight on the page.
 */
export function CheckInEmail({ displayName }: CheckInEmailProps) {
  const greeting = displayName ? `Hey ${displayName},` : "Hey,";

  return (
    <EmailShell>
      <Wordmark />

      <tr>
        <td {...cellBg(CANVAS, { padding: "28px 28px 24px" })}>
          <Eyebrow color={GOLD}>Checking in</Eyebrow>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 32,
              lineHeight: 1.05,
              color: CREAM,
              margin: 0,
              transform: `rotate(${STICKER_ROTATIONS.softNeg})`,
            }}
          >
            How&rsquo;s it going so far?
          </h1>
        </td>
      </tr>

      <tr>
        <td {...cellBg(CARD, { padding: "24px 28px 8px" })}>
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.55,
              color: TEXT,
              margin: "0 0 20px",
            }}
          >
            {greeting} you’ve been using Quiver for a little while now, so I
            wanted to check in.
          </p>

          <PaperPanel rotation={STICKER_ROTATIONS.softNeg}>
            <Eyebrow color={PAPER_MUTED}>Reply with a number</Eyebrow>
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              width="100%"
              style={{ borderCollapse: "collapse", width: "100%" }}
            >
              <tbody>
                {OPTIONS.map((option, index) => (
                  <tr key={option.n}>
                    <td
                      style={{
                        verticalAlign: "top",
                        width: 30,
                        paddingTop: index === 0 ? 4 : 10,
                        fontFamily: FONT_DISPLAY,
                        fontWeight: 700,
                        fontSize: 17,
                        lineHeight: 1.35,
                        color: PAPER_INK,
                      }}
                    >
                      {option.n}.
                    </td>
                    <td
                      style={{
                        verticalAlign: "top",
                        paddingTop: index === 0 ? 4 : 10,
                        fontFamily: FONT_BODY,
                        fontSize: 15,
                        lineHeight: 1.35,
                        color: PAPER_INK,
                      }}
                    >
                      {option.text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PaperPanel>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.55,
              color: TEXT,
              margin: "22px 0 0",
            }}
          >
            Just hit reply with the number. If you&rsquo;ve got a sentence about
            what would make it better, even better. I read every one.
          </p>

          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              lineHeight: 1.55,
              color: MUTED,
              margin: "14px 0 0",
            }}
          >
            Thanks for being here this early. It makes a real difference.
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
          &mdash; Steve
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
          Reply &ldquo;no thanks&rdquo; and I&rsquo;ll leave you out of these.
        </p>
      </Footer>
    </EmailShell>
  );
}
