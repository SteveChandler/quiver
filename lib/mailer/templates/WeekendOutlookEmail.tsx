import * as React from "react";

interface DailyForecast {
  dayName: string; // e.g., "Friday"
  date: string; // e.g., "Jan 24"
  condition: "Good" | "Fair" | "Poor";
  waveHeight: string; // e.g., "3-4ft"
  wind: string; // e.g., "Light Offshores"
  bestWindow: string; // e.g., "6am - 9am"
}

export interface WeekendOutlookEmailProps {
  userName: string | null;
  spotName: string;
  forecasts: [DailyForecast, DailyForecast, DailyForecast]; // Fri, Sat, Sun
  ctaUrl: string;
  unsubscribeUrl: string;
}

const conditionColor: Record<string, string> = {
  Good: "#00cc66",
  Fair: "#ff9900",
  Poor: "#cc3300",
};

export function WeekendOutlookEmail({
  userName,
  spotName,
  forecasts,
  ctaUrl,
  unsubscribeUrl,
}: WeekendOutlookEmailProps) {
  const greeting = userName ? `Hey ${userName},` : "Hey,";

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
            backgroundColor: "#0066cc",
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
            Weekend Outlook
          </h1>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 32px" }}>
          <p style={{ fontSize: 16, margin: "0 0 16px 0", color: "#333" }}>
            {greeting}
          </p>
          <p style={{ fontSize: 16, margin: "0 0 24px 0", color: "#333" }}>
            Here&apos;s what {spotName} looks like this weekend.
          </p>

          {/* Day Cards */}
          {forecasts.map((day, index) => (
            <div
              key={index}
              style={{
                borderTop: index === 0 ? "none" : "1px solid #e6ebf1",
                padding: "20px 0",
              }}
            >
              {/* Day Header - using table for email client compatibility */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
                <tbody>
                  <tr>
                    <td style={{ textAlign: "left" as const }}>
                      <span style={{ fontSize: 18, fontWeight: "bold", color: "#333" }}>
                        {day.dayName}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: "normal", color: "#8898aa", marginLeft: 8 }}>
                        {day.date}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" as const }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: "bold",
                          color: conditionColor[day.condition] || "#8898aa",
                        }}
                      >
                        {day.condition}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Stats Row */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ width: "33%", verticalAlign: "top", paddingRight: 10 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#8898aa",
                          textTransform: "uppercase" as const,
                          letterSpacing: "0.5px",
                          marginBottom: 4,
                        }}
                      >
                        Wave Height
                      </div>
                      <div style={{ fontSize: 14, color: "#333", fontWeight: 500 }}>
                        {day.waveHeight}
                      </div>
                    </td>
                    <td style={{ width: "33%", verticalAlign: "top", paddingRight: 10 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#8898aa",
                          textTransform: "uppercase" as const,
                          letterSpacing: "0.5px",
                          marginBottom: 4,
                        }}
                      >
                        Wind
                      </div>
                      <div style={{ fontSize: 14, color: "#333", fontWeight: 500 }}>
                        {day.wind}
                      </div>
                    </td>
                    <td style={{ width: "33%", verticalAlign: "top" }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#8898aa",
                          textTransform: "uppercase" as const,
                          letterSpacing: "0.5px",
                          marginBottom: 4,
                        }}
                      >
                        Best Window
                      </div>
                      <div style={{ fontSize: 14, color: "#333", fontWeight: 500 }}>
                        {day.bestWindow}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          {/* CTA Button */}
          <div style={{ textAlign: "center" as const, marginTop: 24 }}>
            <a
              href={ctaUrl}
              style={{
                backgroundColor: "#0066cc",
                color: "#ffffff",
                padding: "14px 32px",
                textDecoration: "none",
                borderRadius: 6,
                display: "inline-block",
                fontSize: 16,
                fontWeight: "bold",
              }}
            >
              View Full Forecast
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
            You&apos;re receiving this because you have weekend forecast alerts enabled.
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

export default WeekendOutlookEmail;
