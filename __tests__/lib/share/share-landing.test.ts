import {
  buildOpenInQuiverUrl,
  isGoHost,
  parseShareId,
} from "@/lib/share/share-landing";

const SHARE_ID = "7c1d7f4e-2b6a-4a57-9a5e-3d8f0b2f6a11";

describe("share landing helpers", () => {
  it("accepts only UUID share ids and lowercases them", () => {
    expect(parseShareId(SHARE_ID.toUpperCase())).toBe(SHARE_ID);
    expect(parseShareId(` ${SHARE_ID} `)).toBe(SHARE_ID);
    expect(parseShareId("32.7157,-117.1611")).toBeNull();
    expect(parseShareId("user@example.com")).toBeNull();
    expect(parseShareId("")).toBeNull();
    expect(parseShareId(undefined)).toBeNull();
  });

  it("recognises the go host only", () => {
    expect(isGoHost("go.quiversurf.app")).toBe(true);
    expect(isGoHost("GO.quiversurf.app")).toBe(true);
    expect(isGoHost("www.quiversurf.app")).toBe(false);
    expect(isGoHost(null)).toBe(false);
  });

  it("builds a go-host link that marks the app attempt with o=1", () => {
    const url = new URL(
      buildOpenInQuiverUrl({
        slug: "la-jolla-shores",
        windowValue: "2026-06-03T14:30:00.000Z",
        shareId: SHARE_ID,
        inviteToken: "crew+token/=",
      }),
    );

    expect(url.origin).toBe("https://go.quiversurf.app");
    expect(url.pathname).toBe("/app/spot/la-jolla-shores");
    expect(url.searchParams.get("window")).toBe("2026-06-03T14:30:00.000Z");
    expect(url.searchParams.get("sid")).toBe(SHARE_ID);
    expect(url.searchParams.get("invite")).toBe("crew+token/=");
    expect(url.searchParams.get("o")).toBe("1");
  });

  it("carries email attribution through the go-host hop and drops other params", () => {
    const url = new URL(
      buildOpenInQuiverUrl({
        slug: "capitola-capitola-ca",
        emailAttribution: {
          utm_medium: "email",
          utm_campaign: "conditions_alert",
          email_type: "conditions_alert",
          message_instance_id: "d28ee41c-a826-4b52-b1af-eef932d5d892",
          utm_source: " ",
        },
      }),
    );

    expect(url.searchParams.get("utm_medium")).toBe("email");
    expect(url.searchParams.get("email_type")).toBe("conditions_alert");
    expect(url.searchParams.get("message_instance_id")).toBe("d28ee41c-a826-4b52-b1af-eef932d5d892");
    expect(url.searchParams.has("utm_source")).toBe(false);
    expect(url.searchParams.get("o")).toBe("1");
  });

  it("omits window, sid, and invite when absent", () => {
    const url = new URL(buildOpenInQuiverUrl({ slug: "blacks" }));

    expect([...url.searchParams.keys()]).toEqual(["o"]);
  });
});
