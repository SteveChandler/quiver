import * as React from "react";

export interface FirstSessionNudgeEmailProps {
  displayName: string | null;
  logSessionUrl: string;
  unsubscribeUrl: string;
}

export function FirstSessionNudgeEmail({
  displayName,
  logSessionUrl,
  unsubscribeUrl,
}: FirstSessionNudgeEmailProps) {
  const greeting = displayName ? `Hey ${displayName}!` : "Hey there!";

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
          Your First Forecast Is Waiting
        </h1>
      </div>

      {/* Content Section */}
      <div style={{ padding: "24px 20px" }}>
        <p style={{ fontSize: 16, margin: "0 0 16px 0" }}>
          {greeting}
        </p>

        <p style={{ fontSize: 16, margin: "0 0 20px 0", color: "#333333" }}>
          Welcome to Quiver! The more you use it, the smarter your forecasts
          get. Log your first session to start building a personalized
          experience tuned to how you surf.
        </p>

        {/* Value Proposition */}
        <div
          style={{
            backgroundColor: "#f5f9ff",
            padding: "16px 20px",
            borderLeft: "4px solid #0066cc",
            borderRadius: "0 8px 8px 0",
            marginBottom: 24,
            color: "#333333",
            fontSize: 15,
          }}
        >
          After just 3 sessions, Quiver learns your ideal wave size, wind
          tolerance, and favorite time slots — so you always know when
          conditions match <em>your</em> style.
        </div>

        {/* Primary CTA Button */}
        <div style={{ textAlign: "center" as const, marginBottom: 32 }}>
          <a
            href={logSessionUrl}
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
            Log Your First Session &rarr;
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
          You&apos;re receiving this because you recently signed up for Quiver.
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
