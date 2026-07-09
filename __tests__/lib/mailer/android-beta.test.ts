const mockSend = jest.fn();

export {};

jest.mock("@/lib/mailer/client", () => ({
  MAIL_FROM: "Quiver <invites@send.quiversurf.app>",
  MAIL_REPLY_TO: "Quiver <invites@send.quiversurf.app>",
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
  });
});
