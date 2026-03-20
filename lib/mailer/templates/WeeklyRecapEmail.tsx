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
        backgroundColor: "#1E2456",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#2D357D",
          maxWidth: 600,
          margin: "0 auto",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: "#252D6B",
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
          <p style={{ fontSize: 16, margin: "0 0 8px 0", color: "#ffffff", textAlign: "center" as const }}>
            {greeting}
          </p>
          <p style={{ fontSize: 16, margin: "0 0 24px 0", color: "rgba(255,255,255,0.87)", textAlign: "center" as const }}>
            Here&apos;s what you logged from {startDate} to {endDate}.
          </p>

          {/* Stats Section */}
          <div
            style={{
              backgroundColor: "#354090",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "24px",
              textAlign: "center" as const,
            }}
          >
            <div
              style={{
                display: "inline-block",
                width: "33%",
                minWidth: "150px",
                textAlign: "center" as const,
                verticalAlign: "top",
                padding: "8px 0",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  textTransform: "uppercase" as const,
                  color: "rgba(255,255,255,0.6)",
                  fontWeight: "bold",
                  marginBottom: 8,
                  letterSpacing: "0.5px",
                }}
              >
                Sessions
              </div>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#ffffff" }}>
                {stats.totalSessions}
              </div>
            </div>
            <div
              style={{
                display: "inline-block",
                width: "33%",
                minWidth: "150px",
                textAlign: "center" as const,
                verticalAlign: "top",
                padding: "8px 0",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  textTransform: "uppercase" as const,
                  color: "rgba(255,255,255,0.6)",
                  fontWeight: "bold",
                  marginBottom: 8,
                  letterSpacing: "0.5px",
                }}
              >
                Hours Surfed
              </div>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#ffffff" }}>
                {stats.totalHours}
              </div>
            </div>
            <div
              style={{
                display: "inline-block",
                width: "33%",
                minWidth: "150px",
                textAlign: "center" as const,
                verticalAlign: "top",
                padding: "8px 0",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  textTransform: "uppercase" as const,
                  color: "rgba(255,255,255,0.6)",
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
                  color: "#ffffff",
                  lineHeight: 1.3,
                  wordWrap: "break-word" as const,
                }}
              >
                {stats.topSpot}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              borderTop: "1px solid #404C92",
              margin: "24px 0",
            }}
          />

          {/* CTA Section */}
          <div style={{ textAlign: "center" as const }}>
            <p
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.6)",
                marginBottom: 20,
              }}
            >
              Want to see your detailed session logs and progression stats?
            </p>
            <a
              href={ctaUrl}
              style={{
                backgroundColor: "#F78E42",
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
            borderTop: "1px solid #404C92",
            padding: "20px 32px",
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
            You&apos;re receiving this because you logged sessions this week.
          </p>
          <a
            href={unsubscribeUrl}
            style={{
              fontSize: 12,
              color: "#4A70D9",
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

