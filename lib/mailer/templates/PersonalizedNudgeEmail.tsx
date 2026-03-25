import * as React from "react";
import { getConditionLabel } from "@/lib/email/email-formatters";

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

        {hasConditions ? (
          <>
            {/* Context line */}
            <p
              style={{
                fontSize: 15,
                margin: "0 0 24px 0",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              You set {beachName} as your home break. Here&apos;s what it&apos;s
              looking like:
            </p>

            {/* Score Badge */}
            {(() => {
              const { label: conditionLabel, color: conditionColor } =
                getConditionLabel(conditionsScore);
              return (
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
              );
            })()}

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

            {/* Primary CTA */}
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

            {/* Secondary CTA */}
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
                Paddle out? Tell us how it was &rarr;
              </a>
            </div>
          </>
        ) : (
          <>
            {/* Fallback — no conditions data */}
            <p
              style={{
                fontSize: 15,
                margin: "0 0 24px 0",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              Your home beach forecast is live. Check conditions before you head
              out.
            </p>

            {/* Primary CTA */}
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
                Check {beachName} Forecast &rarr;
              </a>
            </div>

            {/* Secondary text */}
            <p
              style={{
                fontSize: 14,
                textAlign: "center" as const,
                color: "rgba(255,255,255,0.6)",
                margin: "0 0 32px 0",
              }}
            >
              After you surf, log your session to make your forecasts smarter.
            </p>
          </>
        )}
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
          You&apos;re receiving this because you recently signed up for Quiver.
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
