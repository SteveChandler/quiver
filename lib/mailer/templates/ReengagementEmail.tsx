import * as React from "react";

import {
  BeachBadge,
  CTAButton,
  EmailShell,
  Eyebrow,
  Footer,
  PaperPanel,
  Stamp,
  Wordmark,
} from "@/lib/mailer/components";
import { getConditionLabel } from "@/lib/email/email-formatters";
import type { IntelPost } from "@/lib/email/email-types";
import {
  BORDER,
  CANVAS,
  CARD,
  cellBg,
  CREAM,
  FONT_DISPLAY,
  FONT_MONO,
  GOLD,
  MUTED,
  PAPER_INK,
  ROW,
  STICKER_ROTATIONS,
  SURFACE,
  TEXT,
} from "@/lib/mailer/theme";

export interface ReengagementEmailProps {
  displayName: string | null;
  beachName: string;
  beachSlug: string;
  conditionsScore: number;
  surfDescription: string | null;
  windDescription: string | null;
  bestWindow: {
    start: string;
    end: string;
  } | null;
  recentIntel: IntelPost[];
  ctaUrl: string;
  unsubscribeUrl: string;
  baseUrl?: string;
}

/**
 * Get motivational copy based on conditions score.
 * Replaces the generic database recommendation with engaging, score-specific messaging.
 */
function getMotivationalCopy(score: number): string {
  if (score >= 85) {
    return "This is as good as it gets. Drop what you're doing.";
  } else if (score >= 70) {
    return "Conditions are dialed. Worth rearranging your schedule.";
  } else {
    return "Solid conditions today. A good day to shake off the rust.";
  }
}

function formatTag(tag: string): string {
  return tag.toUpperCase();
}

export function ReengagementEmail({
  displayName,
  beachName,
  conditionsScore,
  surfDescription,
  windDescription,
  bestWindow,
  recentIntel,
  ctaUrl,
  unsubscribeUrl,
}: ReengagementEmailProps) {
  const greeting = displayName ? `Hey ${displayName}!` : "Hey there!";
  const { label: conditionLabel, color: conditionColor } =
    getConditionLabel(conditionsScore);
  const motivationalCopy = getMotivationalCopy(conditionsScore);
  const hasBadge = beachName != null;

  const conditionRows: Array<{ label: string; value: string }> = [];
  if (surfDescription) conditionRows.push({ label: "Waves", value: surfDescription });
  if (windDescription) conditionRows.push({ label: "Wind", value: windDescription });
  if (bestWindow)
    conditionRows.push({
      label: "Best Window",
      value: `${bestWindow.start} - ${bestWindow.end}`,
    });

  return (
    <EmailShell>
      <Wordmark />

      {/* Masthead — "it's back on" eyebrow + rotated headline, beach badge */}
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
                  <Eyebrow color={GOLD}>It&apos;s back on</Eyebrow>
                  <h1
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 28,
                      lineHeight: 1.06,
                      color: CREAM,
                      margin: 0,
                      transform: `rotate(${STICKER_ROTATIONS.softNeg})`,
                    }}
                  >
                    Conditions are Looking Good!
                  </h1>
                </td>
                {hasBadge ? (
                  <td
                    align="right"
                    width="72"
                    style={{ verticalAlign: "top", width: 72 }}
                  >
                    <BeachBadge beach={beachName} size={56} />
                  </td>
                ) : null}
              </tr>
            </tbody>
          </table>
        </td>
      </tr>

      {/* Body */}
      <tr>
        <td {...cellBg(CARD, { padding: "24px 28px" })}>
          {/* Greeting + win-back hook */}
          <p
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 18,
              color: CREAM,
              margin: "0 0 10px",
            }}
          >
            {greeting}
          </p>
          <p
            style={{
              fontFamily: "inherit",
              fontSize: 15,
              lineHeight: 1.5,
              color: TEXT,
              margin: "0 0 22px",
            }}
          >
            We noticed you haven&apos;t been in the water lately. Good news
            though &mdash; <strong style={{ color: CREAM }}>{beachName}</strong>{" "}
            is looking great today!
          </p>

          {/* Score stamp — semantic condition color drives the chip */}
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <Stamp
              bg={conditionColor}
              ink={CANVAS}
              rotation={STICKER_ROTATIONS.hardNeg}
              fontSize={12}
              padding="16px 30px"
            >
              <span
                style={{ fontSize: 42, display: "block", lineHeight: 1 }}
              >
                {conditionsScore}
              </span>
              {conditionLabel} Conditions
            </Stamp>
          </div>

          {/* Conditions list — data kept crisp/upright */}
          {conditionRows.length > 0 ? (
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              width="100%"
              style={{
                borderCollapse: "collapse",
                width: "100%",
                marginBottom: 22,
              }}
            >
              <tbody>
                {conditionRows.map((row, idx) => (
                  <tr key={row.label}>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom:
                          idx === conditionRows.length - 1
                            ? "none"
                            : `1px solid ${BORDER}`,
                        fontFamily: FONT_MONO,
                        fontSize: 11,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        color: MUTED,
                        width: "35%",
                        verticalAlign: "top",
                      }}
                    >
                      {row.label}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom:
                          idx === conditionRows.length - 1
                            ? "none"
                            : `1px solid ${BORDER}`,
                        fontFamily: FONT_DISPLAY,
                        fontSize: 14,
                        color: TEXT,
                      }}
                    >
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {/* Motivational quote — cream cut-paper panel */}
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
              &ldquo;{motivationalCopy}&rdquo;
            </p>
          </PaperPanel>

          {/* Recent Community Intel — brand pills + description */}
          {recentIntel.length > 0 ? (
            <div style={{ margin: "24px 0 4px" }}>
              <Eyebrow color={GOLD} marginBottom={12}>
                Recent Community Intel
              </Eyebrow>
              {recentIntel.map((intel) => (
                <div
                  key={intel.id}
                  style={{
                    backgroundColor: ROW,
                    borderLeft: `3px solid ${SURFACE}`,
                    borderRadius: "0 8px 8px 0",
                    padding: "12px 16px",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      fontFamily: FONT_MONO,
                      fontWeight: 700,
                      fontSize: 10,
                      letterSpacing: "1px",
                      color: GOLD,
                      backgroundColor: "rgba(253,184,75,0.14)",
                      padding: "3px 8px",
                      borderRadius: 4,
                      marginRight: 8,
                    }}
                  >
                    {formatTag(intel.tag)}
                  </span>
                  <span style={{ color: TEXT, fontSize: 14 }}>
                    {intel.description}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Primary CTA */}
          <div style={{ textAlign: "center", padding: "22px 0 2px" }}>
            <CTAButton href={ctaUrl}>Check the forecast &rarr;</CTAButton>
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
            margin: "0 0 8px",
          }}
        >
          You&apos;re receiving this because you have forecast alerts enabled
          for {beachName}.
        </p>
        <a
          href={unsubscribeUrl}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: "0.5px",
            color: MUTED,
            textDecoration: "underline",
          }}
        >
          Manage notification preferences
        </a>
      </Footer>
    </EmailShell>
  );
}
