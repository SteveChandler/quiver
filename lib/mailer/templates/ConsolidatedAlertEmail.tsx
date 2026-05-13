// lib/mailer/templates/ConsolidatedAlertEmail.tsx
import type { MatchingWindow } from "@/lib/alerts/types";
import {
  formatWaveHeightRange,
  formatWindSpeed,
  formatSwellPeriod,
} from "@/lib/formatters/surf-data";
import { degreesToCardinal } from "@/lib/utils/geo-utils";

const KNOTS_TO_MPH = 1.15078;

export interface ConsolidatedAlertEmailProps {
  displayName: string | null;
  alertDate: string;
  matches: MatchingWindow[];
  manageAlertsUrl: string;
  unsubscribeUrl: string;
  baseUrl: string;
}

export function ConsolidatedAlertEmail({
  displayName,
  alertDate,
  matches,
  manageAlertsUrl,
  unsubscribeUrl,
  baseUrl,
}: ConsolidatedAlertEmailProps) {
  const greeting = displayName ? `Hey ${displayName}` : "Hey";
  const headingDate = formatEmailHeadingDate(alertDate);

  return (
    <div style={body}>
      <div style={container}>
        {/* Header */}
        <div style={header}>
          <p style={logoText}>Quiver</p>
        </div>

        {/* Content */}
        <div style={content}>
          <p style={headingText}>
            {greeting}, your surf report for <span style={nowrapText}>{headingDate}</span>
          </p>

          {matches.map((match, i) => {
            const timeWindow = formatWindow(match);
            const snap = match.conditions_snapshot;
            const conditionsLine = buildConditionsLine(snap);
            const beachUrl = buildEmailBeachUrl(baseUrl, match);
            const ruleName = formatEmailRuleName(match.rule_name);
            const tokenParam = match.disable_token ? `?token=${match.disable_token}` : "";
            const disableUrl = `${baseUrl}/api/alerts/rules/${match.rule_id}/disable-email${tokenParam}`;

            return (
              <div
                key={match.rule_id + i}
                style={{
                  ...beachSection,
                  backgroundColor: i % 2 === 0 ? "#2D357D" : "#303A85",
                  borderRadius: "8px",
                  padding: "20px",
                  marginBottom: "12px",
                }}
              >
                <p style={beachNameStyle}>{match.beach_name}</p>
                <p style={ruleNameStyle}>Matches: {ruleName}</p>

                {/* Prominent time window */}
                <div style={windowBox}>
                  <p style={windowLabelStyle}>{timeWindow.label}</p>
                  <p style={windowTimeStyle}>{timeWindow.text}</p>
                </div>

                <p style={conditionsTextStyle}>
                  {conditionsLine
                    .split(", ")
                    .map((part, j) => (
                      <span key={j}>
                        {j > 0 ? " \u00B7 " : ""}
                        {part}
                      </span>
                    ))}
                </p>

                <div style={{ marginBottom: "8px" }}>
                  <a href={beachUrl} style={ctaButton}>
                    Check {match.beach_name} Forecast
                  </a>
                </div>

                <p style={disableLinkStyle}>
                  <a href={disableUrl} style={linkStyle}>
                    Not relevant? Disable this rule
                  </a>
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={footer}>
          <p style={footerText}>
            <a href={manageAlertsUrl} style={linkStyle}>
              Manage your alerts
            </a>
            {" \u00B7 "}
            <a href={unsubscribeUrl} style={linkStyle}>
              Unsubscribe
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export interface FormattedEmailWindow {
  label: "Best Around" | "Best Window";
  text: string;
}

export function formatEmailHeadingDate(alertDate: string): string {
  const [weekday, rest] = alertDate.split(", ");
  const weekdayMap: Record<string, string> = {
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
    Sunday: "Sun",
  };

  if (!rest || !weekdayMap[weekday]) return alertDate;
  return `${weekdayMap[weekday]}, ${rest}`;
}

export function formatWindow(match: MatchingWindow): FormattedEmailWindow {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone: match.beach_timezone,
  };
  const start = new Date(match.window_start).toLocaleTimeString("en-US", opts);
  const end = new Date(match.window_end).toLocaleTimeString("en-US", opts);
  const best = new Date(match.best_hour).toLocaleTimeString("en-US", opts);
  const tzAbbr = new Date(match.best_hour)
    .toLocaleTimeString("en-US", {
      timeZone: match.beach_timezone,
      timeZoneName: "short",
    })
    .split(" ")
    .pop();

  const startMs = new Date(match.window_start).getTime();
  const endMs = new Date(match.window_end).getTime();
  const durationMinutes = (endMs - startMs) / 60000;

  if (Number.isFinite(durationMinutes) && durationMinutes <= 75) {
    return {
      label: "Best Around",
      text: `${best} ${tzAbbr}`,
    };
  }

  return {
    label: "Best Window",
    text: `${start} \u2013 ${end} ${tzAbbr} · peak ${best}`,
  };
}

export function buildEmailBeachUrl(baseUrl: string, match: MatchingWindow): string {
  const beachIdentifier = match.beach_slug || match.beach_id;
  return `${baseUrl}/beach/${encodeURIComponent(beachIdentifier)}`;
}

export function formatEmailRuleName(ruleName: string): string {
  return ruleName.replace(/\s+at your home break$/i, "");
}

// Renders the conditions row using the same units + rounding as the live web
// CURRENT CONDITIONS card. Snapshot fields are independently optional so a
// partial forecast still produces a clean line (no "undefined NW" / "NaN mph").
// `wind_speed` is in knots per ForecastHour (lib/alerts/best-hour.ts); convert
// to mph here to match the website. Exported for unit tests.
//
// Period and direction prefer the total-spectrum `wave_period` /
// `wave_direction` (the same fields the web Current Conditions card reads, see
// components/beach-detail/tabs/forecast-tab.tsx) over the primary-train
// `swell_1_*`. wave_direction is already a cardinal string ("WSW") in
// enhanced_forecasts; swell_1_direction is numeric degrees and gets converted
// via degreesToCardinal as a fallback when wave_direction is absent.
export function buildConditionsLine(snap: Record<string, unknown>): string {
  const parts: string[] = [];

  if (typeof snap.wave_height === "number" && Number.isFinite(snap.wave_height)) {
    let swell = `\u{1F30A} ${formatWaveHeightRange(snap.wave_height)}`;

    const period =
      typeof snap.wave_period === "number" && Number.isFinite(snap.wave_period)
        ? snap.wave_period
        : typeof snap.swell_1_period === "number" && Number.isFinite(snap.swell_1_period)
        ? snap.swell_1_period
        : null;
    if (period !== null) swell += ` @ ${formatSwellPeriod(period)}`;

    const cardinal =
      typeof snap.wave_direction === "string" && snap.wave_direction.length > 0
        ? snap.wave_direction
        : typeof snap.swell_1_direction === "number" && Number.isFinite(snap.swell_1_direction)
        ? degreesToCardinal(snap.swell_1_direction)
        : null;
    if (cardinal !== null) swell += ` ${cardinal}`;

    parts.push(swell);
  }

  if (typeof snap.wind_speed === "number" && Number.isFinite(snap.wind_speed)) {
    let wind = `\u{1F4A8} ${formatWindSpeed(snap.wind_speed * KNOTS_TO_MPH)}`;
    if (typeof snap.wind_direction_deg === "number" && Number.isFinite(snap.wind_direction_deg)) {
      wind += ` ${degreesToCardinal(snap.wind_direction_deg)}`;
    }
    parts.push(wind);
  }

  if (typeof snap.tide_status === "string" && snap.tide_status.length > 0) {
    parts.push(`\u{1F4C9} tide ${snap.tide_status.toLowerCase()}`);
  }

  return parts.join(", ");
}

// Styles -- Quiver dark navy palette
const body: React.CSSProperties = {
  backgroundColor: "#1a1f4e",
  margin: "0",
  padding: "0",
  fontFamily: "'DM Sans', sans-serif",
};
const container: React.CSSProperties = {
  width: "100%",
  maxWidth: "600px",
  margin: "0 auto",
};
const header: React.CSSProperties = {
  backgroundColor: "#252D6B",
  padding: "24px 32px",
  textAlign: "center",
};
const logoText: React.CSSProperties = {
  color: "#F78E42",
  fontSize: "28px",
  fontWeight: "700",
  margin: "0",
  fontFamily: "'Space Grotesk', sans-serif",
};
const content: React.CSSProperties = {
  backgroundColor: "#252D6B",
  padding: "24px",
};
const headingText: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: "600",
  lineHeight: "1.35",
  marginBottom: "24px",
};
const nowrapText: React.CSSProperties = { whiteSpace: "nowrap" };
const beachSection: React.CSSProperties = { marginBottom: "16px" };
const beachNameStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: "700",
  margin: "0 0 4px 0",
  fontFamily: "'Space Grotesk', sans-serif",
  letterSpacing: "-0.01em",
  borderBottom: "2px solid #F78E42",
  paddingBottom: "6px",
  display: "inline-block",
};
const ruleNameStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  lineHeight: "1.4",
  margin: "8px 0 12px 0",
};
const windowBox: React.CSSProperties = {
  backgroundColor: "rgba(247, 142, 66, 0.1)",
  border: "1px solid rgba(247, 142, 66, 0.3)",
  borderRadius: "6px",
  padding: "10px 14px",
  marginBottom: "12px",
};
const windowLabelStyle: React.CSSProperties = {
  color: "#F78E42",
  fontSize: "11px",
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  margin: "0 0 4px 0",
};
const windowTimeStyle: React.CSSProperties = {
  color: "#F78E42",
  fontSize: "18px",
  fontWeight: "700",
  lineHeight: "1.3",
  margin: "0",
  fontFamily: "'Space Grotesk', sans-serif",
  wordBreak: "break-word",
};
const conditionsTextStyle: React.CSSProperties = {
  color: "#d1d5db",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 16px 0",
  fontFamily: "'Space Mono', monospace",
  wordBreak: "break-word",
};
const ctaButton: React.CSSProperties = {
  backgroundColor: "#F78E42",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  display: "inline-block",
  maxWidth: "100%",
  boxSizing: "border-box",
};
const disableLinkStyle: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: "1.4",
  margin: "8px 0 0 0",
};
const linkStyle: React.CSSProperties = {
  color: "#9ca3af",
  textDecoration: "underline",
};
const footer: React.CSSProperties = {
  padding: "16px 32px",
  textAlign: "center",
};
const footerText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
};
