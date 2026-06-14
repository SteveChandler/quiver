import * as React from "react";
import { getConditionLabel } from "@/lib/email/email-formatters";

/**
 * The `bgcolor` HTML attribute is the most reliable way to paint a solid
 * background on a table cell in Outlook (it ignores `background` on divs).
 * React's DOM typings omit `bgcolor`, so this helper applies it (plus the
 * matching inline-style background for every other client) in a typed way.
 */
function cellBg(color: string, style: React.CSSProperties = {}): React.TdHTMLAttributes<HTMLTableCellElement> {
  return {
    ...({ bgcolor: color } as React.TdHTMLAttributes<HTMLTableCellElement>),
    style: { backgroundColor: color, ...style },
  };
}

// ============================================================================
// Brand tokens (inline-only; email clients ignore <style> + CSS variables)
// ============================================================================

const NAVY_CANVAS = "#1E2456"; // outer canvas
const NAVY_MAST = "#0F1330"; // masthead bar
const NAVY_HERO = "#252D6B"; // hero / Deep Twilight
const NAVY_PANEL = "#2D357D"; // body panel
const NAVY_CELL = "#354090"; // signal cells / why bullets
const NAVY_BORDER = "#404C92";
const CREAM = "#F5EEDC";
const CREAM_MUTED = "rgba(245,238,220,0.62)";
const TEAL = "#00D4AA"; // YES / go-worthy
const GOLD = "#FDB84B"; // marginal / best-of flags
const GRAY = "#888780"; // low verdict
const ORANGE = "#F78E42"; // CTA only
const CORAL = "#FF6B5C"; // high rip risk
const INK = "#0F1330"; // dark text on bright chips

// Email-safe font stacks — web fonts won't load in most clients.
const FONT_DISPLAY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
const FONT_MONO = "'Space Mono','Courier New',monospace";
const FONT_BODY = "'DM Sans',Arial,sans-serif";

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
}

export interface ConditionsAlertEmailProps {
  beachName: string;
  conditionsScore: number;
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
}

function getVerdict(score: number): Verdict {
  if (score >= 70) {
    return { chipColor: TEAL, inkColor: INK, phrase: "Go surf!" };
  }
  if (score >= 55) {
    return { chipColor: GOLD, inkColor: INK, phrase: "Might work" };
  }
  return { chipColor: GRAY, inkColor: "#1A1A1A", phrase: "Skip it" };
}

/** Fallback headline when the engine has no condition-character label. */
function getFallbackHeadline(score: number): string {
  if (score >= 85) return "It's firing — go now";
  if (score >= 70) return "Clean window lining up";
  if (score >= 55) return "Could work if you time it";
  return "Marginal, but it's your call";
}

function formatConfidenceCopy(
  forecastConfidence: number | null,
  waveFrequencyConfidence: "high" | "medium" | "low" | null
): string | null {
  // Prefer the explicit forecast confidence score when present; otherwise fall
  // back to the wave-frequency confidence bucket.
  if (typeof forecastConfidence === "number") {
    if (forecastConfidence >= 70) return "High · two models agree";
    if (forecastConfidence >= 45) return "Medium · per-beach calibrated";
    return "Low · single source";
  }
  if (waveFrequencyConfidence === "high") return "High · two models agree";
  if (waveFrequencyConfidence === "medium") return "Medium · per-beach calibrated";
  if (waveFrequencyConfidence === "low") return "Low · single source";
  return null;
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

// ============================================================================
// Small presentational helpers
// ============================================================================

function Eyebrow({
  children,
  color = CREAM_MUTED,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 11,
        letterSpacing: "1.5px",
        textTransform: "uppercase" as const,
        color,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
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
        backgroundColor: NAVY_CELL,
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
  conditionsScore,
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
  const { label: conditionLabel } = getConditionLabel(conditionsScore);
  const verdict = getVerdict(conditionsScore);
  const headline =
    signals.conditionCharacter ?? getFallbackHeadline(conditionsScore);
  const showFiringSticker = conditionsScore >= 85;

  const rideableCopy = formatRideableCopy(
    signals.rideableWavesPerHour,
    signals.setIntervalSeconds
  );
  const bestWindowCopy = bestWindow ? `${bestWindow.start}–${bestWindow.end}` : null;
  const confidenceCopy = formatConfidenceCopy(
    signals.forecastConfidence,
    signals.waveFrequencyConfidence
  );
  const rip = getRipPresentation(signals.ripRisk);

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
    { label: "CONFIDENCE", value: confidenceCopy, color: CREAM },
  ];

  const hasPrimaryRow = primaryCells.some((c) => c.value);
  const hasSecondaryRow = secondaryCells.some((c) => c.value);
  const hasWhy = why.whyText.length > 0;

  return (
    <div
      style={{
        backgroundColor: NAVY_CANVAS,
        fontFamily: FONT_BODY,
        lineHeight: 1.5,
        margin: 0,
        padding: 0,
      }}
    >
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        width="100%"
        style={{ borderCollapse: "collapse" as const, maxWidth: 600, margin: "0 auto" }}
      >
        <tbody>
          {/* ---------------------------------------------------------------- */}
          {/* Masthead */}
          {/* ---------------------------------------------------------------- */}
          <tr>
            <td {...cellBg(NAVY_MAST, { padding: "16px 24px" })}>
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
                      align="left"
                      style={{
                        fontFamily: FONT_DISPLAY,
                        fontWeight: 700,
                        fontSize: 20,
                        letterSpacing: "3px",
                        color: CREAM,
                      }}
                    >
                      QUIVER
                    </td>
                    <td
                      align="right"
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 12,
                        letterSpacing: "1px",
                        color: CREAM_MUTED,
                      }}
                    >
                      {dateline}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ---------------------------------------------------------------- */}
          {/* Hero */}
          {/* ---------------------------------------------------------------- */}
          <tr>
            <td {...cellBg(NAVY_HERO, { padding: "28px 24px 24px 24px" })}>
              <Eyebrow color={GOLD}>
                {`TODAY'S SURF CALL · ${beachName}`}
              </Eyebrow>
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
                          lineHeight: 1.15,
                          color: CREAM,
                          margin: 0,
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
                        <span
                          style={{
                            display: "inline-block",
                            backgroundColor: GOLD,
                            color: INK,
                            fontFamily: FONT_MONO,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "1.5px",
                            padding: "6px 10px",
                            borderRadius: "10px 3px 12px 4px",
                            transform: "rotate(-3deg)",
                          }}
                        >
                          NOW FIRING
                        </span>
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ---------------------------------------------------------------- */}
          {/* Score block */}
          {/* ---------------------------------------------------------------- */}
          <tr>
            <td {...cellBg(NAVY_PANEL, { padding: "24px 24px 8px 24px" })}>
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
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
                        {conditionsScore}
                      </div>
                      <div
                        style={{
                          fontFamily: FONT_MONO,
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: "1.5px",
                          textTransform: "uppercase" as const,
                          color: verdict.inkColor,
                          marginTop: 4,
                        }}
                      >
                        {conditionLabel}
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
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ---------------------------------------------------------------- */}
          {/* Signal grid */}
          {/* ---------------------------------------------------------------- */}
          {(hasPrimaryRow || hasSecondaryRow) && (
            <tr>
              <td {...cellBg(NAVY_PANEL, { padding: "16px 24px 8px 24px" })}>
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

          {/* ---------------------------------------------------------------- */}
          {/* Safety strip (rip risk) */}
          {/* ---------------------------------------------------------------- */}
          {rip && (
            <tr>
              <td {...cellBg(NAVY_PANEL, { padding: "4px 24px 8px 24px" })}>
                <table
                  role="presentation"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{ borderCollapse: "collapse" as const }}
                >
                  <tbody>
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
                  </tbody>
                </table>
              </td>
            </tr>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Why this matches your playbook */}
          {/* ---------------------------------------------------------------- */}
          {hasWhy && (
            <tr>
              <td {...cellBg(NAVY_PANEL, { padding: "12px 24px 4px 24px" })}>
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

          {/* ---------------------------------------------------------------- */}
          {/* Crowd warning */}
          {/* ---------------------------------------------------------------- */}
          {why.crowdWarning && (
            <tr>
              <td {...cellBg(NAVY_PANEL, { padding: "8px 24px" })}>
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

          {/* ---------------------------------------------------------------- */}
          {/* CTA */}
          {/* ---------------------------------------------------------------- */}
          <tr>
            <td
              align="center"
              {...cellBg(NAVY_PANEL, { padding: "20px 24px 28px 24px" })}
            >
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                style={{ borderCollapse: "collapse" as const }}
              >
                <tbody>
                  <tr>
                    <td
                      align="center"
                      {...cellBg(ORANGE, { borderRadius: 8 })}
                    >
                      <a
                        href={ctaUrl}
                        style={{
                          display: "inline-block",
                          fontFamily: FONT_DISPLAY,
                          fontWeight: 700,
                          fontSize: 16,
                          color: INK,
                          textDecoration: "none",
                          padding: "14px 30px",
                        }}
                      >
                        See the full forecast &rarr;
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ---------------------------------------------------------------- */}
          {/* Footer */}
          {/* ---------------------------------------------------------------- */}
          <tr>
            <td
              align="center"
              {...cellBg(NAVY_CANVAS, {
                padding: "20px 24px 28px 24px",
                borderTop: `1px solid ${NAVY_BORDER}`,
              })}
            >
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
                  color: CREAM_MUTED,
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
                  color: CREAM_MUTED,
                  textDecoration: "underline",
                }}
              >
                Unsubscribe
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
