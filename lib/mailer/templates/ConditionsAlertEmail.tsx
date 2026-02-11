import * as React from "react";
import { getConditionLabel } from "@/lib/email/email-formatters";

export interface ConditionsAlertEmailProps {
  displayName: string | null;
  beachName: string;
  conditionsScore: number;
  surfDescription: string | null;
  windDescription: string | null;
  bestWindow: {
    start: string;
    end: string;
  } | null;
  ctaUrl: string;
  logSessionUrl: string;
  unsubscribeUrl: string;
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

export function ConditionsAlertEmail({
  displayName,
  beachName,
  conditionsScore,
  surfDescription,
  windDescription,
  bestWindow,
  ctaUrl,
  logSessionUrl,
  unsubscribeUrl,
}: ConditionsAlertEmailProps) {
  const greeting = displayName ? `Hey ${displayName}!` : "Hey there!";
  const { label: conditionLabel, color: conditionColor, emoji } = getConditionLabel(conditionsScore);
  const displayScore = scoreToDisplayPercent(conditionsScore);
  const motivationalCopy = getMotivationalCopy(conditionsScore);

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
          {beachName} {emoji}
        </h1>
      </div>

      {/* Content Section */}
      <div style={{ padding: "24px 20px" }}>
        {/* Greeting */}
        <p style={{ fontSize: 16, margin: "0 0 16px 0" }}>
          {greeting}
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

        {/* Conditions Summary Table */}
        {(surfDescription || windDescription || bestWindow) && (
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
        )}

        {/* Primary CTA Button */}
        <div style={{ textAlign: "center" as const, marginBottom: 16 }}>
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

        {/* Secondary CTA Button */}
        <div style={{ textAlign: "center" as const, marginBottom: 32 }}>
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
