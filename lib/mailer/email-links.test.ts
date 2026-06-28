import {
  buildBeachEmailLink,
  buildSessionPromptAppLink,
} from "@/lib/mailer/email-links";

describe("buildBeachEmailLink", () => {
  const baseParams = {
    origin: "https://quiversurf.app/",
    beachSlug: "ocean-beach",
    emailType: "conditions_alert",
    utmMedium: "conditions_alert",
    utmCampaign: "conditions_alert",
    source: "conditions_alert_email",
    messageInstanceId: "msg-123",
  };

  it("builds a native-claimed spot link with email attribution params", () => {
    const url = new URL(buildBeachEmailLink(baseParams));

    expect(url.origin).toBe("https://www.quiversurf.app");
    expect(url.pathname).toBe("/app/spot/ocean-beach");
    expect(url.searchParams.get("utm_source")).toBe("email");
    expect(url.searchParams.get("utm_medium")).toBe("conditions_alert");
    expect(url.searchParams.get("utm_campaign")).toBe("conditions_alert");
    expect(url.searchParams.get("email_type")).toBe("conditions_alert");
    expect(url.searchParams.get("source")).toBe("conditions_alert_email");
    expect(url.searchParams.get("message_instance_id")).toBe("msg-123");
  });

  it("encodes a beach slug as one path segment", () => {
    const url = new URL(
      buildBeachEmailLink({
        ...baseParams,
        beachSlug: "big slab/left bowl",
      })
    );

    expect(url.pathname).toBe("/app/spot/big%20slab%2Fleft%20bowl");
  });
});

describe("buildSessionPromptAppLink", () => {
  it("builds a native-claimed session form link with email attribution params", () => {
    const url = new URL(
      buildSessionPromptAppLink({
        origin: "https://quiversurf.app/",
        beachId: "beach-1",
        beachName: "Ocean Beach",
        startedAt: "2026-06-27T12:00:00.000Z",
        messageInstanceId: "session-prompt-msg-1",
      })
    );

    expect(url.origin).toBe("https://www.quiversurf.app");
    expect(url.pathname).toBe("/sessions/new");
    expect(url.searchParams.get("entrySource")).toBe("email");
    expect(url.searchParams.get("beachId")).toBe("beach-1");
    expect(url.searchParams.get("beachName")).toBe("Ocean Beach");
    expect(url.searchParams.get("startedAt")).toBe("2026-06-27T12:00:00.000Z");
    expect(url.searchParams.get("utm_source")).toBe("quiver");
    expect(url.searchParams.get("utm_medium")).toBe("email");
    expect(url.searchParams.get("utm_campaign")).toBe("session_prompt");
    expect(url.searchParams.get("email_type")).toBe("session_prompt");
    expect(url.searchParams.get("message_instance_id")).toBe("session-prompt-msg-1");
  });
});
