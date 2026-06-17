import * as React from "react";

export interface AppLinkEmailProps {
  /** Absolute /app handoff URL with attribution params. */
  appUrl: string;
}

export function AppLinkEmail({ appUrl }: AppLinkEmailProps) {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        lineHeight: 1.6,
        maxWidth: 600,
        margin: "0 auto",
        backgroundColor: "#252D6B",
      }}
    >
      <div style={{ padding: "28px 20px", textAlign: "center" as const }}>
        <h1
          style={{
            color: "#ffffff",
            margin: 0,
            fontSize: 22,
            fontWeight: "bold",
          }}
        >
          Open Quiver on your phone
        </h1>
      </div>
      <div style={{ padding: "8px 20px 24px" }}>
        <p
          style={{
            fontSize: 16,
            margin: "0 0 20px 0",
            color: "#E7E9F5",
          }}
        >
          Tap the button on your phone to get the surf call, beach intel, and
          session log in the app.
        </p>
        <div style={{ textAlign: "center" as const, marginBottom: 24 }}>
          <a
            href={appUrl}
            style={{
              backgroundColor: "#F78E42",
              color: "#252D6B",
              padding: "14px 28px",
              textDecoration: "none",
              borderRadius: 8,
              display: "inline-block",
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            Get Quiver &rarr;
          </a>
        </div>
        <p style={{ fontSize: 13, margin: 0, color: "#AAB0D6" }}>
          Or paste this link into your phone browser:
          <br />
          <span style={{ wordBreak: "break-all" as const, color: "#FDB84B" }}>
            {appUrl}
          </span>
        </p>
      </div>
    </div>
  );
}
