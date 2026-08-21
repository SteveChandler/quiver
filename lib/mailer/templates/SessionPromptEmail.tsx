import * as React from "react";

import {
  BeachBadge,
  CTAButton,
  EmailShell,
  Eyebrow,
  Footer,
  PaperPanel,
  Wordmark,
} from "@/lib/mailer/components";
import { getConditionLabel } from "@/lib/email/email-formatters";
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

export interface SessionPromptEmailProps {
  displayName: string | null;
  beachName: string;
  conditionsScore: number; // 0-100 scale, yesterday's score
  surfDescription: string | null;
  appSessionUrl: string;
  confirmUrl: string;
  skipUrl: string;
  unsubscribeUrl: string;
}

export function SessionPromptEmail({
  displayName,
  beachName,
  conditionsScore,
  surfDescription,
  appSessionUrl,
  confirmUrl,
  skipUrl,
  unsubscribeUrl,
}: SessionPromptEmailProps) {
  const greeting = displayName ? `Hey ${displayName}!` : "Hey there!";
  const { label: conditionLabel } = getConditionLabel(conditionsScore);

  return (
    <EmailShell>
      <Wordmark dateline="Yesterday" />

      {/* Masthead — rotated editorial headline + optional beach crest */}
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
                  <Eyebrow color={GOLD}>Yesterday · {beachName}</Eyebrow>
                  <h1
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 31,
                      lineHeight: 1.04,
                      color: CREAM,
                      margin: 0,
                      transform: `rotate(${STICKER_ROTATIONS.softNeg})`,
                    }}
                  >
                    How Was Your Session?
                  </h1>
                </td>
                <td
                  align="right"
                  width="64"
                  style={{ verticalAlign: "top", width: 64 }}
                >
                  <BeachBadge beach={beachName} size={56} />
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
              fontFamily: FONT_DISPLAY,
              fontWeight: 500,
              fontSize: 18,
              lineHeight: 1.3,
              color: CREAM,
              margin: "0 0 14px",
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
              margin: "0 0 22px",
            }}
          >
            Conditions were looking{" "}
            <strong style={{ color: TEAL }}>{conditionLabel.toLowerCase()}</strong> at{" "}
            <strong style={{ color: CREAM }}>{beachName}</strong> yesterday (scored{" "}
            {conditionsScore}).
            {surfDescription ? ` ${surfDescription}.` : ""}{" "}
            If you got out there, we&apos;d love to hear how it was!
          </p>

          {/* Motivational note — cream paper taped into the twilight page */}
          <PaperPanel rotation={STICKER_ROTATIONS.softNeg}>
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
              Your session log is the record you&apos;ll compare the next call against.
            </p>
          </PaperPanel>

          {/* App CTA first; one-tap web actions stay available as fallbacks. */}
          <div style={{ textAlign: "center", padding: "20px 0 2px" }}>
            <CTAButton href={appSessionUrl}>Open in Quiver</CTAButton>
            <div style={{ height: 12, lineHeight: 0, fontSize: 0 }}>&nbsp;</div>
            <CTAButton href={confirmUrl} variant="secondary">
              Yes, I surfed!
            </CTAButton>
            <div style={{ height: 10, lineHeight: 0, fontSize: 0 }}>&nbsp;</div>
            <CTAButton href={skipUrl} variant="secondary">
              No, I didn&apos;t surf
            </CTAButton>
          </div>
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
          You&apos;re receiving this because you have forecast alerts enabled for{" "}
          {beachName}. ·{" "}
          <a
            href={unsubscribeUrl}
            style={{ color: MUTED, textDecoration: "underline" }}
          >
            Manage notification preferences
          </a>
        </p>
      </Footer>
    </EmailShell>
  );
}
