// lib/mailer/templates/ConsolidatedAlertEmail.tsx
import type { MatchingWindow } from "@/lib/alerts/types";

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
            {greeting}, your surf alert for {alertDate}
          </p>

          {matches.map((match, i) => {
            const timeWindow = formatWindow(match);
            const snap = match.conditions_snapshot;
            const conditionsLine = buildConditionsLine(snap);
            const beachUrl = `${baseUrl}/surf/${match.beach_name.toLowerCase().replace(/\s+/g, "-")}`;
            const disableUrl = `${baseUrl}/api/alerts/rules/${match.rule_id}/disable-email`;

            return (
              <div key={match.rule_id + i} style={beachSection}>
                <p style={beachNameStyle}>{match.beach_name}</p>
                <p style={ruleNameStyle}>{match.rule_name} alert matched</p>
                <p style={windowTextStyle}>Best window: {timeWindow}</p>
                <p style={conditionsTextStyle}>{conditionsLine}</p>

                <div style={{ marginBottom: "8px" }}>
                  <a href={beachUrl} style={ctaButton}>
                    Check {match.beach_name} Forecast
                  </a>
                </div>

                <p style={disableLinkStyle}>
                  <a href={disableUrl} style={linkStyle}>Not relevant? Disable this rule</a>
                </p>

                {i < matches.length - 1 && <hr style={divider} />}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={footer}>
          <p style={footerText}>
            <a href={manageAlertsUrl} style={linkStyle}>Manage your alerts</a>
            {" · "}
            <a href={unsubscribeUrl} style={linkStyle}>Unsubscribe</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function formatWindow(match: MatchingWindow): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: match.beach_timezone };
  const start = new Date(match.window_start).toLocaleTimeString("en-US", opts);
  const end = new Date(match.window_end).toLocaleTimeString("en-US", opts);
  const best = new Date(match.best_hour).toLocaleTimeString("en-US", opts);
  const tzAbbr = new Date(match.best_hour)
    .toLocaleTimeString("en-US", { timeZone: match.beach_timezone, timeZoneName: "short" })
    .split(" ")
    .pop();
  return `${start} – ${end} ${tzAbbr}, peak around ${best}`;
}

function buildConditionsLine(snap: Record<string, unknown>): string {
  const parts: string[] = [];
  if (snap.wave_height) parts.push(`${snap.wave_height}ft`);
  if (snap.swell_1_period) parts.push(`@ ${snap.swell_1_period}s`);
  if (snap.wind_speed) parts.push(`${snap.wind_speed}kt wind`);
  if (snap.tide_height && snap.tide_status) parts.push(`tide ${snap.tide_height}ft ${snap.tide_status}`);
  return parts.join(", ");
}

// Styles — Quiver dark navy palette
const body: React.CSSProperties = { backgroundColor: "#1a1f4e", margin: "0", padding: "0", fontFamily: "'DM Sans', sans-serif" };
const container: React.CSSProperties = { maxWidth: "600px", margin: "0 auto" };
const header: React.CSSProperties = { backgroundColor: "#252D6B", padding: "24px 32px", textAlign: "center" };
const logoText: React.CSSProperties = { color: "#F78E42", fontSize: "28px", fontWeight: "700", margin: "0", fontFamily: "'Space Grotesk', sans-serif" };
const content: React.CSSProperties = { backgroundColor: "#2D357D", padding: "24px 32px" };
const headingText: React.CSSProperties = { color: "#ffffff", fontSize: "20px", fontWeight: "600", marginBottom: "24px" };
const beachSection: React.CSSProperties = { marginBottom: "16px" };
const beachNameStyle: React.CSSProperties = { color: "#ffffff", fontSize: "18px", fontWeight: "700", margin: "0 0 4px 0", fontFamily: "'Space Grotesk', sans-serif" };
const ruleNameStyle: React.CSSProperties = { color: "#9ca3af", fontSize: "13px", margin: "0 0 8px 0" };
const windowTextStyle: React.CSSProperties = { color: "#F78E42", fontSize: "16px", fontWeight: "600", margin: "0 0 4px 0" };
const conditionsTextStyle: React.CSSProperties = { color: "#d1d5db", fontSize: "14px", margin: "0 0 16px 0" };
const ctaButton: React.CSSProperties = { backgroundColor: "#F78E42", color: "#ffffff", padding: "12px 24px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", textDecoration: "none", display: "inline-block" };
const disableLinkStyle: React.CSSProperties = { fontSize: "12px", margin: "8px 0 0 0" };
const linkStyle: React.CSSProperties = { color: "#9ca3af", textDecoration: "underline" };
const divider: React.CSSProperties = { borderColor: "#404C92", margin: "24px 0" };
const footer: React.CSSProperties = { padding: "16px 32px", textAlign: "center" };
const footerText: React.CSSProperties = { color: "#6b7280", fontSize: "12px" };
