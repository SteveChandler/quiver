import {
  buildAppEmailLink,
  buildBeachEmailLink,
  buildSessionEmailLink,
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

  it("defaults utm_medium to email", () => {
    const url = new URL(
      buildBeachEmailLink({
        ...baseParams,
        utmMedium: undefined,
      })
    );

    expect(url.searchParams.get("utm_medium")).toBe("email");
  });

  it("supports an exact forecast window and campaign source", () => {
    const url = new URL(
      buildBeachEmailLink({
        ...baseParams,
        utmSource: "quiver",
        utmMedium: "email",
        source: undefined,
        params: { window: "2026-08-28T14:00:00.000Z" },
      }),
    );

    expect(url.searchParams.get("window")).toBe("2026-08-28T14:00:00.000Z");
    expect(url.searchParams.get("utm_source")).toBe("quiver");
    expect(url.searchParams.get("source")).toBeNull();
  });
});

describe("buildAppEmailLink", () => {
  it("builds a covered app handoff link with email attribution", () => {
    const url = new URL(
      buildAppEmailLink({
        origin: "https://quiversurf.app/",
        emailType: "welcome",
        messageInstanceId: "msg-456",
        source: "welcome_email",
        utmCampaign: "no_home_beach",
        params: {
          onboarding: "required",
        },
      })
    );

    expect(url.origin).toBe("https://www.quiversurf.app");
    expect(url.pathname).toBe("/app");
    expect(url.searchParams.get("onboarding")).toBe("required");
    expect(url.searchParams.get("utm_source")).toBe("email");
    expect(url.searchParams.get("utm_medium")).toBe("email");
    expect(url.searchParams.get("email_type")).toBe("welcome");
    expect(url.searchParams.get("message_instance_id")).toBe("msg-456");
  });

  it("keeps an existing web destination while adding attribution", () => {
    const url = new URL(buildAppEmailLink({
      origin: "https://quiversurf.app",
      path: "/profile/analytics",
      emailType: "weekly_recap",
      messageInstanceId: "msg-weekly",
      utmCampaign: "weekly_recap",
    }));

    expect(url.pathname).toBe("/profile/analytics");
    expect(url.searchParams.get("message_instance_id")).toBe("msg-weekly");
  });
});

describe("buildSessionEmailLink", () => {
  it("builds a covered sessions link with token, beach, window, and attribution", () => {
    const url = new URL(
      buildSessionEmailLink({
        origin: "https://quiversurf.app/",
        token: "token-123",
        beachId: "beach-123",
        startedAt: "2026-06-25T12:00:00.000Z",
        emailType: "session_prompt",
        messageInstanceId: "msg-789",
        source: "session_prompt_email",
        utmCampaign: "session_prompt",
        params: {
          beachName: "Ocean Beach",
        },
      })
    );

    expect(url.origin).toBe("https://www.quiversurf.app");
    expect(url.pathname).toBe("/sessions/new");
    expect(url.searchParams.get("token")).toBe("token-123");
    expect(url.searchParams.get("beachId")).toBe("beach-123");
    expect(url.searchParams.get("beachName")).toBe("Ocean Beach");
    expect(url.searchParams.get("startedAt")).toBe("2026-06-25T12:00:00.000Z");
    expect(url.searchParams.get("entrySource")).toBe("email");
    expect(url.searchParams.get("beach_id")).toBeNull();
    expect(url.searchParams.get("window")).toBeNull();
    expect(url.searchParams.get("utm_source")).toBe("email");
    expect(url.searchParams.get("utm_medium")).toBe("email");
    expect(url.searchParams.get("utm_campaign")).toBe("session_prompt");
    expect(url.searchParams.get("email_type")).toBe("session_prompt");
    expect(url.searchParams.get("source")).toBe("session_prompt_email");
    expect(url.searchParams.get("message_instance_id")).toBe("msg-789");
  });
});
