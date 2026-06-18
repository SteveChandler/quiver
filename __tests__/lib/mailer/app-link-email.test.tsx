import { AppLinkEmail } from "@/lib/mailer/templates/AppLinkEmail";
import { AppLinkEmailSchema } from "@/lib/validation/schemas";

describe("AppLinkEmail", () => {
  it("renders the handoff URL in the transactional email body", () => {
    const appUrl = "https://www.quiversurf.app/app?source=landing_hero";
    const email = AppLinkEmail({ appUrl });
    expect(JSON.stringify(email)).toContain(appUrl);
    expect(JSON.stringify(email)).toContain("Open Quiver on your phone");
  });
});

describe("AppLinkEmailSchema", () => {
  it("accepts a valid recipient and source metadata", () => {
    expect(
      AppLinkEmailSchema.safeParse({
        email: "surfer@example.com",
        source: "landing_hero",
        surface: "landing-page",
        placement: "hero_primary",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid emails with user-facing copy", () => {
    const result = AppLinkEmailSchema.safeParse({ email: "nope" });
    expect(result.success).toBe(false);
    const message = result.success ? "" : result.error.issues[0]?.message;
    expect(message).toBe("Enter a valid email address.");
  });
});
