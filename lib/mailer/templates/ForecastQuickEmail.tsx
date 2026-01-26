import * as React from "react";

export interface ForecastQuickEmailProps {
  displayName: string | null;
  beachName: string;
  beachSlug: string;
  forecastDate: string;
  waveHeight: string;
  windSpeed: string;
  windDirection: string;
  lookAheadText: string | null;
  ctaUrl: string;
  unsubscribeUrl: string;
}

/**
 * Short "bad day" email variant for days when conditions don't match.
 * Keeps users engaged with a daily touchpoint and a look-ahead tease.
 */
export function ForecastQuickEmail({
  displayName,
  beachName,
  forecastDate,
  waveHeight,
  windSpeed,
  windDirection,
  lookAheadText,
  ctaUrl,
  unsubscribeUrl,
}: ForecastQuickEmailProps) {
  const greeting = displayName ? `Hey ${displayName},` : "Hey,";

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
      {/* Header */}
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
          Your Quiver Daily Playbook
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

      {/* Body */}
      <div style={{ padding: "24px 20px" }}>
        <p style={{ fontSize: 16, margin: "0 0 16px 0" }}>{greeting}</p>

        <p
          style={{
            fontSize: 18,
            margin: "0 0 20px 0",
            color: "#333333",
            fontWeight: 600,
          }}
        >
          Not worth paddling out today at {beachName}.
        </p>

        <p
          style={{
            fontSize: 15,
            margin: "0 0 24px 0",
            color: "#555555",
          }}
        >
          {waveHeight} with {windSpeed} {windDirection} winds.
        </p>

        {/* Look-ahead section */}
        {lookAheadText && (
          <div
            style={{
              backgroundColor: "#f0f7ff",
              border: "1px solid #cce0ff",
              borderRadius: 8,
              padding: "16px 20px",
              marginBottom: 24,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 15,
                color: "#0055aa",
                fontWeight: 600,
              }}
            >
              Looking ahead:
            </p>
            <p
              style={{
                margin: "8px 0 0 0",
                fontSize: 15,
                color: "#333333",
              }}
            >
              {lookAheadText}
            </p>
          </div>
        )}

        {/* CTA */}
        <div style={{ textAlign: "center" as const, marginBottom: 32 }}>
          <a
            href={ctaUrl}
            style={{
              backgroundColor: "#0066cc",
              color: "#ffffff",
              padding: "12px 24px",
              textDecoration: "none",
              borderRadius: 8,
              display: "inline-block",
              fontSize: 15,
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
          Unsubscribe from these alerts
        </a>
      </div>
    </div>
  );
}
