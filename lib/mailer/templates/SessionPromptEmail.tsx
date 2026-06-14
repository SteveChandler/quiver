import * as React from "react";
import { getConditionLabel } from "@/lib/email/email-formatters";

export interface SessionPromptEmailProps {
  displayName: string | null;
  beachName: string;
  conditionsScore: number; // 0-100 scale, yesterday's score
  surfDescription: string | null;
  confirmUrl: string;
  skipUrl: string;
  unsubscribeUrl: string;
}

export function SessionPromptEmail({
  displayName,
  beachName,
  conditionsScore,
  surfDescription,
  confirmUrl,
  skipUrl,
  unsubscribeUrl,
}: SessionPromptEmailProps) {
  const greeting = displayName ? `Hey ${displayName}!` : "Hey there!";
  const { label: conditionLabel } = getConditionLabel(conditionsScore);

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
          How Was Your Session?
        </h1>
      </div>

      {/* Content Section */}
      <div style={{ padding: "24px 20px" }}>
        {/* Greeting */}
        <p style={{ fontSize: 16, margin: "0 0 16px 0" }}>
          {greeting}
        </p>

        <p style={{ fontSize: 16, margin: "0 0 20px 0", color: "#333333" }}>
          Conditions were looking <strong>{conditionLabel.toLowerCase()}</strong> at{" "}
          <strong>{beachName}</strong> yesterday (scored {conditionsScore}).
          {surfDescription && ` ${surfDescription}.`}{" "}If you got out there, we&apos;d love to hear how it was!
        </p>

        {/* Motivational Line */}
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
          Your session logs help the community and improve our forecasts.
        </div>

        {/* Two-button CTA layout: confirm session vs. skip */}
        <div style={{ textAlign: "center" as const, marginBottom: 32 }}>
          <a
            href={confirmUrl}
            style={{
              backgroundColor: "#0066cc",
              color: "#ffffff",
              padding: "14px 28px",
              textDecoration: "none",
              borderRadius: 8,
              display: "inline-block",
              fontSize: 16,
              fontWeight: "bold",
              marginBottom: 12,
            }}
          >
            Yes, I surfed! &rarr;
          </a>
          <br />
          <a
            href={skipUrl}
            style={{
              backgroundColor: "#f3f4f6",
              color: "#374151",
              padding: "12px 28px",
              textDecoration: "none",
              borderRadius: 8,
              display: "inline-block",
              fontSize: 14,
              fontWeight: "500",
            }}
          >
            No, I didn&apos;t surf
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
