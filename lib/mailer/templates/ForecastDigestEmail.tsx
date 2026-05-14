import * as React from "react";

export interface ForecastDigestEmailProps {
  displayName: string | null;
  beachName: string;
  beachSlug: string;
  forecastDate: string; // "Monday, January 6"
  matchQuality: "perfect" | "excellent" | "good" | "fair";
  waveHeight: string; // "3-5ft"
  wavePeriod: string; // "12s"
  windSpeed: string; // "5mph"
  windDirection: string; // "NE (offshore)"
  tideStatus: string; // "Low, incoming"
  whyText: string[]; // Personalized reasons from digest service
  crowdWarning: string | null; // Recent crowd intel
  bestWindow: {
    startTime: string; // "8:30 AM"
    endTime: string; // "9:30 AM"
  } | null;
  ctaUrl: string; // Deep link to beach page
  unsubscribeUrl: string;
}

const MATCH_EMOJI: Record<ForecastDigestEmailProps["matchQuality"], string> = {
  perfect: "🔥",
  excellent: "✨",
  good: "👍",
  fair: "🌊",
};

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function ForecastDigestEmail({
  displayName,
  beachName,
  beachSlug,
  forecastDate,
  matchQuality,
  waveHeight,
  wavePeriod,
  windSpeed,
  windDirection,
  tideStatus,
  whyText,
  crowdWarning,
  bestWindow,
  ctaUrl,
  unsubscribeUrl,
}: ForecastDigestEmailProps) {
  const greeting = displayName ? `Hey ${displayName},` : "Hey there,";
  const emoji = MATCH_EMOJI[matchQuality];
  const qualityTitle = toTitleCase(matchQuality);

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        lineHeight: 1.6,
        maxWidth: 600,
        margin: "0 auto",
        backgroundColor: "#ffffff",
      }}
    >
      {/* Header Section */}
      <div
        style={{
          backgroundColor: "#0066cc",
          padding: "24px 20px",
          textAlign: "center" as const,
        }}
      >
        <h1
          style={{
            color: "#ffffff",
            margin: 0,
            fontSize: 24,
            fontWeight: "bold",
          }}
        >
          Today's Surf Call
        </h1>
        <p
          style={{
            color: "#ffffff",
            margin: "8px 0 0 0",
            fontSize: 16,
            opacity: 0.9,
          }}
        >
          {forecastDate}
        </p>
      </div>

      {/* Content Section */}
      <div style={{ padding: "24px 20px" }}>
        {/* Greeting */}
        <p style={{ fontSize: 16, margin: "0 0 16px 0" }}>
          {`${greeting} ${emoji}`}
        </p>

        {/* Match Quality Headline */}
        <h2
          style={{
            fontSize: 22,
            margin: "0 0 20px 0",
            color: "#333333",
          }}
        >
          {`${qualityTitle} Conditions at ${beachName}`}
        </h2>

        {/* Forecast Snapshot Table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse" as const,
            marginBottom: 24,
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e5e5e5",
                  fontWeight: "bold",
                  color: "#555555",
                  width: "35%",
                }}
              >
                Waves
              </td>
              <td
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e5e5e5",
                  color: "#333333",
                }}
              >
                {`${waveHeight} @ ${wavePeriod}`}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e5e5e5",
                  fontWeight: "bold",
                  color: "#555555",
                }}
              >
                Wind
              </td>
              <td
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e5e5e5",
                  color: "#333333",
                }}
              >
                {`${windSpeed} ${windDirection}`}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e5e5e5",
                  fontWeight: "bold",
                  color: "#555555",
                }}
              >
                Tide
              </td>
              <td
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e5e5e5",
                  color: "#333333",
                }}
              >
                {tideStatus}
              </td>
            </tr>
            {bestWindow && (
              <tr>
                <td
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #e5e5e5",
                    fontWeight: "bold",
                    color: "#555555",
                  }}
                >
                  Best Window
                </td>
                <td
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #e5e5e5",
                    color: "#333333",
                  }}
                >
                  {`${bestWindow.startTime} - ${bestWindow.endTime}`}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Why Section */}
        <div
          style={{
            backgroundColor: "#f5f9ff",
            padding: "20px",
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: "bold",
              color: "#0066cc",
              margin: "0 0 12px 0",
              textTransform: "uppercase" as const,
              letterSpacing: "0.5px",
            }}
          >
            Why This Matches Your Playbook
          </h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              color: "#333333",
            }}
          >
            {whyText.map((reason, index) => (
              <li key={index} style={{ marginBottom: 8 }}>
                {reason}
              </li>
            ))}
          </ul>
        </div>

        {/* Crowd Warning (conditional) */}
        {crowdWarning && (
          <div
            style={{
              backgroundColor: "#fff3cd",
              borderLeft: "4px solid #ffc107",
              padding: "16px 20px",
              borderRadius: "0 8px 8px 0",
              marginBottom: 24,
            }}
          >
            <p style={{ margin: 0, color: "#664d03" }}>
              <strong>⚠️ Heads up:</strong>
              {` ${crowdWarning}`}
            </p>
          </div>
        )}

        {/* CTA Button */}
        <div style={{ textAlign: "center" as const, marginBottom: 32 }}>
          <a
            href={ctaUrl}
            style={{
              backgroundColor: "#0066cc",
              color: "#ffffff",
              padding: "14px 28px",
              textDecoration: "none",
              borderRadius: 8,
              display: "inline-block",
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            Check Today&apos;s Forecast →
          </a>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid #e5e5e5",
          padding: "20px",
          textAlign: "center" as const,
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: "#666666",
            margin: "0 0 8px 0",
          }}
        >
          {`You're receiving this because you have forecast alerts enabled for ${beachName}.`}
        </p>
        <a
          href={unsubscribeUrl}
          style={{
            fontSize: 12,
            color: "#0066cc",
            textDecoration: "underline",
          }}
        >
          Unsubscribe from these alerts
        </a>
      </div>
    </div>
  );
}
