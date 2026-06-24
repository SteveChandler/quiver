import { buildBeachEmailLink } from "@/lib/mailer/email-links";

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

    expect(url.origin).toBe("https://quiversurf.app");
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
