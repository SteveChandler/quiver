import * as React from "react";

interface SessionSummary {
  totalSessions: number;
  totalHours: string; // e.g., "4.5"
  topSpot: string; // e.g., "Blacks Beach"
}

export interface WeeklyRecapEmailProps {
  userName: string | null;
  startDate: string; // e.g., "Jan 20"
  endDate: string; // e.g., "Jan 26"
  stats: SessionSummary;
  ctaUrl: string;
  unsubscribeUrl: string;
}

export function WeeklyRecapEmail({
  userName,
  startDate,
  endDate,
  stats,
  ctaUrl,
  unsubscribeUrl,
}: WeeklyRecapEmailProps) {
  const greeting = userName ? `Nice work, ${userName}.` : "Nice work!";

  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: "#f6f9fc",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          maxWidth: 600,
          margin: "0 auto",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: "#1a365d",
            padding: "24px 32px",
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
            Weekly Recap
          </h1>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 32px" }}>
          <p style={{ fontSize: 16, margin: "0 0 8px 0", color: "#333", textAlign: "center" as const }}>
            {greeting}
          </p>
          <p style={{ fontSize: 16, margin: "0 0 24px 0", color: "#525f7f", textAlign: "center" as const }}>
            Here&apos;s what you logged from {startDate} to {endDate}.
          </p>

          {/* Stats Section */}
          <div
            style={{
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "24px",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ width: "33%", textAlign: "center" as const, verticalAlign: "top" }}>
                    <div
                      style={{
                        fontSize: 12,
                        textTransform: "uppercase" as const,
                        color: "#8898aa",
                        fontWeight: "bold",
                        marginBottom: 8,
                        letterSpacing: "0.5px",
                      }}
                    >
                      Sessions
                    </div>
                    <div style={{ fontSize: 28, fontWeight: "bold", color: "#32325d" }}>
                      {stats.totalSessions}
                    </div>
                  </td>
                  <td style={{ width: "33%", textAlign: "center" as const, verticalAlign: "top" }}>
                    <div
                      style={{
                        fontSize: 12,
                        textTransform: "uppercase" as const,
                        color: "#8898aa",
                        fontWeight: "bold",
                        marginBottom: 8,
                        letterSpacing: "0.5px",
                      }}
                    >
                      Hours Surfed
                    </div>
                    <div style={{ fontSize: 28, fontWeight: "bold", color: "#32325d" }}>
                      {stats.totalHours}
                    </div>
                  </td>
                  <td style={{ width: "33%", textAlign: "center" as const, verticalAlign: "top" }}>
                    <div
                      style={{
                        fontSize: 12,
                        textTransform: "uppercase" as const,
                        color: "#8898aa",
                        fontWeight: "bold",
                        marginBottom: 8,
                        letterSpacing: "0.5px",
                      }}
                    >
                      Top Spot
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: "bold",
                        color: "#32325d",
                        lineHeight: 1.3,
                      }}
                    >
                      {stats.topSpot}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Divider */}
          <div
            style={{
              borderTop: "1px solid #e6ebf1",
              margin: "24px 0",
            }}
          />

          {/* CTA Section */}
          <div style={{ textAlign: "center" as const }}>
            <p
              style={{
                fontSize: 14,
                color: "#8898aa",
                marginBottom: 20,
              }}
            >
              Want to see your detailed session logs and progression stats?
            </p>
            <a
              href={ctaUrl}
              style={{
                backgroundColor: "#007ee6",
                color: "#ffffff",
                padding: "14px 32px",
                textDecoration: "none",
                borderRadius: 6,
                display: "inline-block",
                fontSize: 16,
                fontWeight: "bold",
              }}
            >
              View My Analytics
            </a>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid #e6ebf1",
            padding: "20px 32px",
            textAlign: "center" as const,
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: "#8898aa",
              margin: "0 0 8px 0",
            }}
          >
            You&apos;re receiving this because you logged sessions this week.
          </p>
          <a
            href={unsubscribeUrl}
            style={{
              fontSize: 12,
              color: "#0066cc",
              textDecoration: "underline",
            }}
          >
            Manage email preferences
          </a>
        </div>
      </div>
    </div>
  );
}

export default WeeklyRecapEmail;
