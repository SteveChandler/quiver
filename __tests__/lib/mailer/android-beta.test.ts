import { render } from "@testing-library/react";

const mockSend = jest.fn();

export {};

jest.mock("@/lib/mailer/client", () => ({
  MAIL_FROM: "Quiver <invites@send.quiversurf.app>",
  MAIL_REPLY_TO: "Quiver <invites@send.quiversurf.app>",
  // Wordmark renders the brand lockup as an absolute-URL <img>, so every
  // template now resolves getBaseUrl at render time.
  getBaseUrl: () => "https://www.quiversurf.app",
  resend: {
    emails: {
      send: mockSend,
    },
  },
}));

describe("sendAndroidBetaInstructionsEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
  });

  it("sends Android beta instructions from the verified sender", async () => {
    const { sendAndroidBetaInstructionsEmail } = await import(
      "@/lib/mailer/android-beta"
    );

    await expect(
      sendAndroidBetaInstructionsEmail("surfer@example.com"),
    ).resolves.toEqual({ success: true, messageId: "email-1" });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Quiver <invites@send.quiversurf.app>",
        replyTo: "Quiver <invites@send.quiversurf.app>",
        to: "surfer@example.com",
        subject: "Your Quiver Android beta steps",
        text: expect.stringContaining(
          "https://groups.google.com/g/quiver-android-testers",
        ),
      }),
    );

    const message = mockSend.mock.calls[0]?.[0];
    expect(message.text).toContain("personalized surf decisions");
    expect(message.text).toContain("saved spots, alerts, and session logging");
    expect(message.text).not.toMatch(/free year|year of pro/i);

    const { container } = render(message.react);
    const html = container.textContent ?? "";
    expect(html).toMatch(/personalized surf decisions/i);
    expect(html).not.toMatch(/free year|year of Pro/i);
  });
});
