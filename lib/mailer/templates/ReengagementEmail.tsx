import * as React from "react";
import { getConditionLabel } from "@/lib/email/email-formatters";
import type { IntelPost } from "@/lib/email/email-types";

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
  beachSlug,
  conditionsScore,
  surfDescription,
  windDescription,
  bestWindow,
  recentIntel,
  ctaUrl,
  unsubscribeUrl,
  baseUrl = "https://quiversurf.app",
}: ReengagementEmailProps) {
  const greeting = displayName ? `Hey ${displayName}!` : "Hey there!";
  const { label: conditionLabel, color: conditionColor } = getConditionLabel(conditionsScore);
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
          Conditions are Looking Good!
        </h1>
      </div>

      {/* Content Section */}
      <div style={{ padding: "24px 20px", backgroundColor: "#2D357D" }}>
        {/* Greeting */}
        <p style={{ fontSize: 16, margin: "0 0 16px 0", color: "#ffffff" }}>
          {greeting}
        </p>

        <p style={{ fontSize: 16, margin: "0 0 20px 0", color: "#ffffff" }}>
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

        {/* Recent Community Intel */}
        {recentIntel.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: "bold",
                color: "#4A70D9",
                margin: "0 0 12px 0",
                textTransform: "uppercase" as const,
                letterSpacing: "0.5px",
              }}
            >
              Recent Community Intel
            </h3>
            {recentIntel.map((intel) => (
              <div
                key={intel.id}
                style={{
                  backgroundColor: "#354090",
                  padding: "12px 16px",
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    backgroundColor: "#404C92",
                    color: "rgba(255,255,255,0.87)",
                    fontSize: 11,
                    fontWeight: "bold",
                    padding: "2px 8px",
                    borderRadius: 4,
                    marginRight: 8,
                  }}
                >
                  {formatTag(intel.tag)}
                </span>
                <span style={{ color: "#ffffff", fontSize: 14 }}>
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
            Check the forecast &rarr;
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
          You&apos;re receiving this because you have forecast alerts enabled for{" "}
          {beachName}.
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
