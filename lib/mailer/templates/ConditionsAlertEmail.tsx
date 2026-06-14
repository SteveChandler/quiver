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
  if (score >= 85) {
    return "Clean window showing. Check the details before you commit.";
  } else if (score >= 70) {
    return "Looks worth a closer look if the tide and wind still fit.";
  } else {
    return "A manageable window may be lining up. Confirm the local details first.";
  }
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
  const {
    label: conditionLabel,
    color: conditionColor,
  } = getConditionLabel(conditionsScore);
  const motivationalCopy = getMotivationalCopy(conditionsScore);

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        lineHeight: 1.6,
        maxWidth: 600,
        margin: "0 auto",
        backgroundColor: "#1E2456",
      }}
    >
      {/* Header Section */}
      <div
        style={{
          backgroundColor: "#252D6B",
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
          {beachName}
        </h1>
      </div>

      {/* Content Section */}
      <div style={{ padding: "24px 20px", backgroundColor: "#2D357D" }}>
        {/* Greeting */}
        <p style={{ fontSize: 16, margin: "0 0 16px 0", color: "#ffffff" }}>
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
              {conditionsScore}
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
            backgroundColor: "#354090",
            padding: "16px 20px",
            borderLeft: "4px solid #F78E42",
            borderRadius: "0 8px 8px 0",
            marginBottom: 24,
            fontStyle: "italic",
            color: "#ffffff",
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
                      borderBottom: "1px solid #404C92",
                      fontWeight: "bold",
                      color: "rgba(255,255,255,0.6)",
                      width: "35%",
                    }}
                  >
                    Waves
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #404C92",
                      color: "#ffffff",
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
                      borderBottom: "1px solid #404C92",
                      fontWeight: "bold",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    Wind
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #404C92",
                      color: "#ffffff",
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
                      borderBottom: "1px solid #404C92",
                      fontWeight: "bold",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    Best Window
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #404C92",
                      color: "#ffffff",
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
              backgroundColor: "#F78E42",
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
              backgroundColor: "transparent",
              color: "#4A70D9",
              padding: "12px 24px",
              textDecoration: "none",
              borderRadius: 8,
              display: "inline-block",
              fontSize: 14,
              fontWeight: "bold",
              border: "2px solid #4A70D9",
            }}
          >
            Log Your Session
          </a>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid #404C92",
          padding: "20px",
          textAlign: "center" as const,
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.6)",
            margin: "0 0 8px 0",
          }}
        >
          You&apos;re receiving this because you have forecast alerts enabled
          for {beachName}.
        </p>
        <a
          href={unsubscribeUrl}
          style={{
            fontSize: 12,
            color: "#4A70D9",
            textDecoration: "underline",
          }}
        >
          Manage notification preferences
        </a>
      </div>
    </div>
  );
}
