import * as React from "react";

import {
  BeachBadge,
  CTAButton,
  EmailShell,
  Eyebrow,
  Footer,
  Stamp,
  StickerStrip,
  Wordmark,
} from "@/lib/mailer/components";
import {
  CARD,
  cellBg,
  CANVAS,
  CORAL,
  CREAM,
  CREAM_MUTED,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  GOLD,
  GRAY,
  INK,
  MUTED,
  ORANGE,
  STICKER_ROTATIONS,
  SURFACE,
  TEAL,
} from "@/lib/mailer/theme";

// ============================================================================
// Props
// ============================================================================

export interface ConditionsAlertWhyContent {
  /** Personalized "why this matches your playbook" bullets (digest service). */
  whyText: string[];
  /** Amber crowd-warning line (weekend + good conditions), or null. */
  crowdWarning: string | null;
}

export interface ConditionsAlertSignals {
  /** NWS rip-current risk for the day. Rendered only when moderate/high. */
  ripRisk: "low" | "moderate" | "high" | null;
  /** Physics estimate of rideable waves per hour. */
  rideableWavesPerHour: number | null;
  /** Dominant set/beat interval in seconds. */
  setIntervalSeconds: number | null;
  /** Confidence of the wave-frequency estimate. */
  waveFrequencyConfidence: "high" | "medium" | "low" | null;
  /** enhanced_forecasts.confidence_score (0-100). */
  forecastConfidence: number | null;
  /** Human condition-character headline, e.g. "Dialed — everything's lining up". */
  conditionCharacter: string | null;
  /** Current water-quality status. Rendered only when good/advisory/closure. */
  waterQuality: "good" | "advisory" | "closure" | "unknown" | null;
}

export interface ConditionsAlertEmailProps {
  beachName: string;
  decisionVerdict: "go" | "maybe";
  surfDescription: string | null;
  windDescription: string | null;
  /** Tide summary, e.g. "2.1 ft, incoming". */
  tideDescription: string | null;
  bestWindow: {
    start: string;
    end: string;
  } | null;
  /** Mono dateline shown in the masthead, e.g. "FRI · JUN 13". */
  dateline: string;
  /** New surf-decision signals from enrichBeachSignals (degrades gracefully). */
  signals: ConditionsAlertSignals;
  /** Personalized why bullets + crowd warning from the digest service. */
  why: ConditionsAlertWhyContent;
  ctaUrl: string;
  /** Settings page for managing alerts. */
  manageUrl: string;
  unsubscribeUrl: string;
}

// ============================================================================
// Derived copy / styling
// ============================================================================

interface Verdict {
  /** Background of the score chip. Never orange (CTA-only). */
  chipColor: string;
  /** Dark, same-family text on the chip. */
  inkColor: string;
  /** Short verdict phrase. */
  phrase: string;
  label: string;
}

function getVerdict(verdict: "go" | "maybe"): Verdict {
  if (verdict === "go") {
    return {
      chipColor: TEAL,
      inkColor: INK,
      phrase: "Go surf!",
      label: "GO",
    };
  }
  return {
    chipColor: GOLD,
    inkColor: INK,
    phrase: "Worth considering",
    label: "CONSIDER",
  };
}

function formatRideableCopy(
  rideableWavesPerHour: number | null,
  setIntervalSeconds: number | null
): string | null {
  if (rideableWavesPerHour === null) return null;
  const perHour = `~${Math.round(rideableWavesPerHour)}`;
  if (setIntervalSeconds === null) return perHour;
  return `${perHour} · sets ~${Math.round(setIntervalSeconds)}s`;
}

interface RipPresentation {
  label: string;
  color: string;
}

function getRipPresentation(
  ripRisk: "low" | "moderate" | "high" | null
): RipPresentation | null {
  if (ripRisk === "moderate") return { label: "Moderate", color: GOLD };
  if (ripRisk === "high") return { label: "High", color: CORAL };
  // Omit low/null entirely — no need to alarm or clutter.
  return null;
}

interface WaterQualityPresentation {
  label: string;
  color: string;
  /** Closure is more urgent than an advisory — render it bolder + uppercased. */
  urgent: boolean;
}

function getWaterQualityPresentation(
  waterQuality: "good" | "advisory" | "closure" | "unknown" | null
): WaterQualityPresentation | null {
  if (waterQuality === "closure") {
    return { label: "Closed", color: CORAL, urgent: true };
  }
  if (waterQuality === "advisory") {
    return { label: "Advisory", color: GOLD, urgent: false };
  }
  if (waterQuality === "good") {
    return { label: "Clean", color: TEAL, urgent: false };
  }
  // Omit unknown/null entirely — no actionable signal.
  return null;
}

/** A single signal cell: mono eyebrow + mono datum. Returns null when no datum. */
function SignalCell({
  label,
  value,
  valueColor = CREAM,
}: {
  label: string;
  value: string | null;
  valueColor?: string;
}) {
  if (!value) return null;
  return (
    <td
      width="33%"
      valign="top"
      style={{
        padding: "12px 10px",
        backgroundColor: SURFACE,
        verticalAlign: "top" as const,
      }}
    >
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: "1.2px",
          textTransform: "uppercase" as const,
          color: CREAM_MUTED,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 13,
          lineHeight: 1.35,
          color: valueColor,
        }}
      >
        {value}
      </div>
    </td>
  );
}

// ============================================================================
// Template
// ============================================================================

export function ConditionsAlertEmail({
  beachName,
  decisionVerdict,
  surfDescription,
  windDescription,
  tideDescription,
  bestWindow,
  dateline,
  signals,
  why,
  ctaUrl,
  manageUrl,
  unsubscribeUrl,
}: ConditionsAlertEmailProps) {
  const verdict = getVerdict(decisionVerdict);
  const headline =
    signals.conditionCharacter ??
    (decisionVerdict === "go"
      ? "Your best session window is lining up"
      : "A session window is worth watching");
  const showFiringSticker = decisionVerdict === "go";

  const rideableCopy = formatRideableCopy(
    signals.rideableWavesPerHour,
    signals.setIntervalSeconds
  );
  const bestWindowCopy = bestWindow ? `${bestWindow.start}–${bestWindow.end}` : null;
  const rip = getRipPresentation(signals.ripRisk);
  const water = getWaterQualityPresentation(signals.waterQuality);

  // The signal grid keeps a fixed three-column structure; cells render null when
  // their datum is missing so the table stays balanced without empty boxes.
  const primaryCells = [
    { label: "SWELL", value: surfDescription },
    { label: "WIND", value: windDescription },
    { label: "TIDE", value: tideDescription },
  ];
  const secondaryCells = [
    { label: "RIDEABLE / HR", value: rideableCopy, color: TEAL },
    { label: "BEST WINDOW", value: bestWindowCopy, color: CREAM },
  ];

  const hasPrimaryRow = primaryCells.some((c) => c.value);
  const hasSecondaryRow = secondaryCells.some((c) => c.value);
  const hasWhy = why.whyText.length > 0;

  return (
    <EmailShell>
      <Wordmark dateline={dateline} />

      {/* Hero — kicker + condition-character headline + NOW FIRING stamp */}
      <tr>
        <td {...cellBg(CANVAS, { padding: "26px 24px 22px 24px" })}>
          <Eyebrow color={GOLD}>{`TODAY'S SURF CALL · ${beachName}`}</Eyebrow>
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            width="100%"
            style={{ borderCollapse: "collapse" as const }}
          >
            <tbody>
              <tr>
                <td valign="top" style={{ verticalAlign: "top" as const }}>
                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 29,
                      lineHeight: 1.12,
                      color: CREAM,
                      margin: 0,
                      transform: `rotate(${STICKER_ROTATIONS.softNeg})`,
                    }}
                  >
                    {headline}
                  </div>
                </td>
                {showFiringSticker && (
                  <td
                    valign="top"
                    width="120"
                    align="right"
                    style={{ verticalAlign: "top" as const, width: 120 }}
                  >
                    <Stamp
                      ink={INK}
                      rotation={STICKER_ROTATIONS.hardNeg}
                      fontSize={11}
                      padding="7px 10px"
                    >
                      NOW FIRING
                    </Stamp>
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </td>
      </tr>

      {/* Score block — verdict chip + phrase + beach badge */}
      <tr>
        <td {...cellBg(CARD, { padding: "24px 24px 8px 24px" })}>
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            width="100%"
            style={{ borderCollapse: "collapse" as const }}
          >
            <tbody>
              <tr>
                <td
                  align="center"
                  {...cellBg(verdict.chipColor, {
                    padding: "14px 22px",
                    borderRadius: "12px 4px 14px 6px",
                  })}
                >
                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 50,
                      lineHeight: 1,
                      color: verdict.inkColor,
                    }}
                  >
                    {verdict.label}
                  </div>
                </td>
                <td
                  valign="middle"
                  style={{
                    paddingLeft: 18,
                    verticalAlign: "middle" as const,
                  }}
                >
                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 22,
                      color: CREAM,
                    }}
                  >
                    {verdict.phrase}
                  </div>
                </td>
                <td
                  valign="middle"
                  align="right"
                  style={{ verticalAlign: "middle" as const, width: 64 }}
                >
                  <BeachBadge beach={beachName} size={56} />
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>

      {/* Signal grid */}
      {(hasPrimaryRow || hasSecondaryRow) && (
        <tr>
          <td {...cellBg(CARD, { padding: "16px 24px 8px 24px" })}>
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              width="100%"
              style={{ borderCollapse: "separate" as const, borderSpacing: "6px" }}
            >
              <tbody>
                {hasPrimaryRow && (
                  <tr>
                    {primaryCells.map((cell) => (
                      <SignalCell
                        key={cell.label}
                        label={cell.label}
                        value={cell.value}
                      />
                    ))}
                  </tr>
                )}
                {hasSecondaryRow && (
                  <tr>
                    {secondaryCells.map((cell) => (
                      <SignalCell
                        key={cell.label}
                        label={cell.label}
                        value={cell.value}
                        valueColor={cell.color}
                      />
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </td>
        </tr>
      )}

      {/* Safety strip (rip risk + water quality) */}
      {(rip || water) && (
        <tr>
          <td {...cellBg(CARD, { padding: "4px 24px 8px 24px" })}>
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              style={{ borderCollapse: "collapse" as const }}
            >
              <tbody>
                {rip && (
                  <tr>
                    <td
                      valign="middle"
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 11,
                        letterSpacing: "1.2px",
                        textTransform: "uppercase" as const,
                        color: CREAM_MUTED,
                        paddingRight: 10,
                        verticalAlign: "middle" as const,
                      }}
                    >
                      RIP RISK
                    </td>
                    <td valign="middle" style={{ verticalAlign: "middle" as const }}>
                      <span
                        style={{
                          fontFamily: FONT_MONO,
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: "0.5px",
                          color: rip.color,
                        }}
                      >
                        {rip.label}
                      </span>
                    </td>
                  </tr>
                )}
                {water && (
                  <tr>
                    <td
                      valign="middle"
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 11,
                        letterSpacing: "1.2px",
                        textTransform: "uppercase" as const,
                        color: CREAM_MUTED,
                        paddingRight: 10,
                        paddingTop: rip ? 6 : 0,
                        verticalAlign: "middle" as const,
                      }}
                    >
                      WATER
                    </td>
                    <td
                      valign="middle"
                      style={{
                        paddingTop: rip ? 6 : 0,
                        verticalAlign: "middle" as const,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: FONT_MONO,
                          fontSize: water.urgent ? 13 : 12,
                          fontWeight: 700,
                          letterSpacing: water.urgent ? "1px" : "0.5px",
                          textTransform: water.urgent
                            ? ("uppercase" as const)
                            : ("none" as const),
                          color: water.color,
                        }}
                      >
                        {water.label}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </td>
        </tr>
      )}

      {/* Why this matches your playbook */}
      {hasWhy && (
        <tr>
          <td {...cellBg(CARD, { padding: "12px 24px 4px 24px" })}>
            <Eyebrow color={ORANGE}>WHY THIS MATCHES YOUR PLAYBOOK</Eyebrow>
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              width="100%"
              style={{ borderCollapse: "collapse" as const }}
            >
              <tbody>
                {why.whyText.map((reason, index) => (
                  <tr key={index}>
                    <td
                      valign="top"
                      width="18"
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 15,
                        color: TEAL,
                        verticalAlign: "top" as const,
                        paddingTop: 5,
                        paddingBottom: 6,
                      }}
                    >
                      &rsaquo;
                    </td>
                    <td
                      valign="top"
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 14,
                        lineHeight: 1.45,
                        color: CREAM,
                        verticalAlign: "top" as const,
                        paddingTop: 4,
                        paddingBottom: 6,
                      }}
                    >
                      {reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}

      {/* Crowd warning */}
      {why.crowdWarning && (
        <tr>
          <td {...cellBg(CARD, { padding: "8px 24px" })}>
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              width="100%"
              style={{ borderCollapse: "collapse" as const }}
            >
              <tbody>
                <tr>
                  <td
                    {...cellBg("#3D3A1A", {
                      padding: "12px 16px",
                      borderLeft: `4px solid ${GOLD}`,
                      borderRadius: "0 8px 8px 0",
                    })}
                  >
                    <span
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "1px",
                        textTransform: "uppercase" as const,
                        color: GOLD,
                      }}
                    >
                      HEADS UP{" "}
                    </span>
                    <span
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 14,
                        color: CREAM,
                      }}
                    >
                      {why.crowdWarning}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      )}

      {/* CTA */}
      <tr>
        <td align="center" {...cellBg(CARD, { padding: "20px 24px 28px 24px" })}>
          <CTAButton href={ctaUrl}>See the full forecast &rarr;</CTAButton>
        </td>
      </tr>

      {/* Footer */}
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
            color: CREAM_MUTED,
            margin: "0 0 10px 0",
          }}
        >
          You set a daily alert for {beachName}. One call a day, only when
          it&apos;s worth it.
        </p>
        <a
          href={manageUrl}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: MUTED,
            textDecoration: "underline",
          }}
        >
          Manage alerts
        </a>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: CREAM_MUTED,
            padding: "0 6px",
          }}
        >
          ·
        </span>
        <a
          href={unsubscribeUrl}
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: MUTED,
            textDecoration: "underline",
          }}
        >
          Unsubscribe
        </a>
      </Footer>
    </EmailShell>
  );
}
