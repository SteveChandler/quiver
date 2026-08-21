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
  ROW,
  STICKER_ROTATIONS,
  SURFACE,
  TEXT,
} from "@/lib/mailer/theme";

export interface PersonalizedNudgeEmailProps {
  displayName: string | null;
  beachName: string;
  conditionsScore: number | null;
  surfDescription: string | null;
  windDescription: string | null;
  bestWindow: { start: string; end: string } | null;
  ctaUrl: string;
  logSessionUrl: string;
  unsubscribeUrl: string;
}

/** One mono key/value row on a ROW surface. Skipped by the caller when null. */
function ConditionRow({ label, value }: { label: string; value: string }) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      width="100%"
      style={{
        borderCollapse: "collapse",
        width: "100%",
        backgroundColor: ROW,
        borderRadius: 8,
        marginBottom: 7,
      }}
    >
      <tbody>
        <tr>
          <td
            style={{
              verticalAlign: "middle",
              width: 116,
              padding: "11px 0 11px 14px",
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {label}
          </td>
          <td
            style={{
              verticalAlign: "middle",
              padding: "11px 14px 11px 8px",
              fontFamily: FONT_MONO,
              fontSize: 13,
              color: TEXT,
            }}
          >
            {value}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function PersonalizedNudgeEmail({
  displayName,
  beachName,
  conditionsScore,
  surfDescription,
  windDescription,
  bestWindow,
  ctaUrl,
  logSessionUrl,
  unsubscribeUrl,
}: PersonalizedNudgeEmailProps) {
  const greeting = displayName ? `Hey ${displayName}!` : "Hey there!";
  const hasConditions = conditionsScore !== null;

  return (
    <EmailShell>
      <Wordmark />

      {/* Masthead — "your home break" kicker + the beach name as the headline,
          with the curated beach badge taped into the right cell. */}
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
                  <Eyebrow color={GOLD}>Your home break</Eyebrow>
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
                    {beachName}
                  </h1>
                </td>
                <td
                  align="right"
                  width="68"
                  style={{ verticalAlign: "top", width: 68 }}
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
              margin: "0 0 18px",
            }}
          >
            {greeting}
          </p>

          {hasConditions ? (
            <>
              {/* Score chip — big display number + label colored by verdict */}
              {(() => {
                const { label, color } = getConditionLabel(conditionsScore);
                return (
                  <table
                    role="presentation"
                    cellPadding={0}
                    cellSpacing={0}
                    style={{
                      borderCollapse: "collapse",
                      marginBottom: 22,
                    }}
                  >
                    <tbody>
                      <tr>
                        <td
                          {...cellBg(SURFACE, {
                            verticalAlign: "middle",
                            padding: "14px 22px",
                            borderRadius: 12,
                          })}
                        >
                          <table
                            role="presentation"
                            cellPadding={0}
                            cellSpacing={0}
                            style={{ borderCollapse: "collapse" }}
                          >
                            <tbody>
                              <tr>
                                <td
                                  style={{
                                    verticalAlign: "middle",
                                    paddingRight: 14,
                                    fontFamily: FONT_DISPLAY,
                                    fontWeight: 700,
                                    fontSize: 44,
                                    lineHeight: 0.9,
                                    color,
                                  }}
                                >
                                  {conditionsScore}
                                </td>
                                <td style={{ verticalAlign: "middle" }}>
                                  <Stamp bg={color} ink={CANVAS} fontSize={11}>
                                    {label} CONDITIONS
                                  </Stamp>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()}

              {/* Conditions list — mono rows, null values skipped */}
              <div style={{ marginBottom: 22 }}>
                {surfDescription ? (
                  <ConditionRow label="Waves" value={surfDescription} />
                ) : null}
                {windDescription ? (
                  <ConditionRow label="Wind" value={windDescription} />
                ) : null}
                {bestWindow ? (
                  <ConditionRow
                    label="Best window"
                    value={`${bestWindow.start} - ${bestWindow.end}`}
                  />
                ) : null}
              </div>

              {/* CTAs — primary orange, secondary ghost */}
              <div style={{ textAlign: "center", padding: "2px 0 10px" }}>
                <CTAButton href={ctaUrl}>Check the full forecast</CTAButton>
              </div>
              <div style={{ textAlign: "center", paddingBottom: 2 }}>
                <CTAButton href={logSessionUrl} variant="secondary">
                  Tell us how it went
                </CTAButton>
              </div>
            </>
          ) : (
            <>
              {/* No-conditions fallback — cream paper note + single CTA */}
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
                  Your home break forecast is live — check it before you paddle
                  out.
                </p>
              </PaperPanel>
              <div style={{ textAlign: "center", padding: "18px 0 4px" }}>
                <CTAButton href={ctaUrl}>Check {beachName}</CTAButton>
              </div>
              <p
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  letterSpacing: "0.5px",
                  textAlign: "center",
                  color: MUTED,
                  margin: "12px 0 2px",
                }}
              >
                After you surf, log it so you can compare the next call.
              </p>
            </>
          )}
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
          You set {beachName} as your home break ·{" "}
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
