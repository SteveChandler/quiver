import * as React from "react";

export function SessionInviteEmail({
  inviterName,
  beachName,
  whenIso,
  ctaUrl,
  note,
}: {
  inviterName: string;
  beachName?: string;
  whenIso?: string;
  ctaUrl: string;
  note?: string;
}) {
  const when = whenIso ? new Date(whenIso).toLocaleString() : undefined;
  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.5 }}>
      <h2>Surf session invite from {inviterName}</h2>
      <p>
        {inviterName} invited you to a session
        {beachName ? ` at ${beachName}` : ""}
        {when ? ` on ${when}` : " soon"}.
      </p>
      {note && <blockquote>“{note}”</blockquote>}
      <p>
        <a
          href={ctaUrl}
          style={{
            padding: "10px 16px",
            textDecoration: "none",
            borderRadius: 8,
            border: "1px solid #333",
            display: "inline-block",
          }}
        >
          View & respond
        </a>
      </p>
      <hr />
      <p style={{ fontSize: 12 }}>
        Manage notifications in Settings. If you didn’t expect this, you can
        report or unsubscribe.
      </p>
    </div>
  );
}

