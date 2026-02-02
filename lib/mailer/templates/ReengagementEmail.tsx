import * as React from "react";

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
  recentIntel: Array<{
    tag: string;
    description: string;
  }>;
  ctaUrl: string;
  unsubscribeUrl: string;
}

function getConditionLabel(score: number): { label: string; color: string; emoji: string } {
  // Score is 0-10 scale from beach_daily_intel
  if (score >= 9) {
    return { label: "Perfect", color: "#10b981", emoji: "🔥" };
  } else if (score >= 8) {
    return { label: "Excellent", color: "#3b82f6", emoji: "✨" };
  } else {
    return { label: "Good", color: "#22c55e", emoji: "🌊" };
  }
}

/**
 * Get motivational copy based on conditions score.
 * Replaces the generic database recommendation with engaging, score-specific messaging.
 */
function getMotivationalCopy(score: number): string {
  if (score >= 9) {
    return "This is as good as it gets. Drop what you're doing.";
  } else if (score >= 8) {
    return "Conditions are dialed. Worth rearranging your schedule.";
  } else {
    return "Solid conditions today. A good day to shake off the rust.";
  }
}

/**
 * Convert 0-10 score to display percentage (0-100)
 */
function scoreToDisplayPercent(score: number): number {
  return Math.round(score * 10);
}

function formatTag(tag: string): string {
  return tag.toUpperCase();
}

export function ReengagementEmail({
  displayName,
  beachName,
  beachSlug,
  conditionsScore,
  surfDescription,
  windDescription,
  bestWindow,
  recentIntel,
  ctaUrl,
  unsubscribeUrl,
}: ReengagementEmailProps) {
  const greeting = displayName ? `Hey ${displayName}!` : "Hey there!";
  const { label: conditionLabel, color: conditionColor, emoji } = getConditionLabel(conditionsScore);
  const displayScore = scoreToDisplayPercent(conditionsScore);
  const motivationalCopy = getMotivationalCopy(conditionsScore);
  const logSessionUrl = `https://quiversurf.app/sessions/log?beach=${beachSlug}`;

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
            fontSize: 22,
            fontWeight: "bold",
          }}
        >
          Conditions are Looking Good! {emoji}
        </h1>
      </div>

      {/* Content Section */}
      <div style={{ padding: "24px 20px" }}>
        {/* Greeting */}
        <p style={{ fontSize: 16, margin: "0 0 16px 0" }}>
          {greeting}
        </p>

        <p style={{ fontSize: 16, margin: "0 0 20px 0", color: "#333333" }}>
          We noticed you haven&apos;t been in the water lately. Good news though &mdash;{" "}
          <strong>{beachName}</strong> is looking great today!
        </p>

        {/* Score Badge */}
        <div
          style={{
            textAlign: "center" as const,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "inline-block",
              backgroundColor: conditionColor,
              color: "#ffffff",
              padding: "20px 40px",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: "bold",
                lineHeight: 1,
              }}
            >
              {displayScore}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: "bold",
                textTransform: "uppercase" as const,
                letterSpacing: "1px",
                marginTop: 4,
              }}
            >
              {conditionLabel} Conditions
            </div>
          </div>
        </div>

        {/* Conditions Summary Table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse" as const,
            marginBottom: 24,
          }}
        >
          <tbody>
            {surfDescription && (
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
                  {surfDescription}
                </td>
              </tr>
            )}
            {windDescription && (
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
                  {windDescription}
                </td>
              </tr>
            )}
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
                  {bestWindow.start} - {bestWindow.end}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Motivational Copy */}
        <div
          style={{
            backgroundColor: "#f5f9ff",
            padding: "16px 20px",
            borderLeft: "4px solid #0066cc",
            borderRadius: "0 8px 8px 0",
            marginBottom: 24,
            fontStyle: "italic",
            color: "#333333",
          }}
        >
          &ldquo;{motivationalCopy}&rdquo;
        </div>

        {/* Recent Community Intel */}
        {recentIntel.length > 0 && (
          <div style={{ marginBottom: 24 }}>
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
              Recent Community Intel
            </h3>
            {recentIntel.map((intel, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: "#f9fafb",
                  padding: "12px 16px",
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    backgroundColor: "#e5e7eb",
                    color: "#374151",
                    fontSize: 11,
                    fontWeight: "bold",
                    padding: "2px 8px",
                    borderRadius: 4,
                    marginRight: 8,
                  }}
                >
                  {formatTag(intel.tag)}
                </span>
                <span style={{ color: "#333333", fontSize: 14 }}>
                  {intel.description}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* CTA Button */}
        <div style={{ textAlign: "center" as const, marginBottom: 24 }}>
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
            Check Full Forecast &rarr;
          </a>
        </div>

        {/* Log Session CTA */}
        <div style={{ textAlign: "center" as const, marginBottom: 32 }}>
          <p
            style={{
              fontSize: 14,
              color: "#666666",
              margin: "0 0 12px 0",
            }}
          >
            Going surfing? Let us know how it was:
          </p>
          <a
            href={logSessionUrl}
            style={{
              backgroundColor: "#ffffff",
              color: "#0066cc",
              padding: "12px 24px",
              textDecoration: "none",
              borderRadius: 8,
              display: "inline-block",
              fontSize: 14,
              fontWeight: "bold",
              border: "2px solid #0066cc",
            }}
          >
            Log Your Session
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
          You&apos;re receiving this because you have forecast alerts enabled for{" "}
          {beachName}.
        </p>
        <a
          href={unsubscribeUrl}
          style={{
            fontSize: 12,
            color: "#0066cc",
            textDecoration: "underline",
          }}
        >
          Manage notification preferences
        </a>
      </div>
    </div>
  );
}
