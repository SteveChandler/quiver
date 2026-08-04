/** @jest-environment node */

const mockResendSend = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: (...args: unknown[]) => mockResendSend(...args),
    },
  })),
}));

describe("mailer client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      RESEND_API_KEY: "test-resend-key",
    };
    delete process.env.E2E_ALLOW_EMAIL_SENDS;
    delete process.env.PLAYWRIGHT_TEST;
    delete process.env.NEXT_PUBLIC_E2E_DISABLE_EMAIL_SENDS;
    mockResendSend.mockResolvedValue({
      data: { id: "email-123" },
      error: null,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("adds an angle-bracketed List-Unsubscribe header without replacing caller headers", async () => {
    const { sendEmail } = await import("@/lib/mailer/client");
    const unsubscribeUrl =
      "https://www.quiversurf.app/api/alerts/unsubscribe-email?user_id=user-1&token=signed";

    await sendEmail({
      from: "Quiver <test@quiversurf.app>",
      to: "surfer@example.com",
      subject: "Conditions are lining up",
      html: "<p>Go surf.</p>",
      headers: {
        "X-Campaign": "condition-alert",
      },
      unsubscribeUrl,
    });

    expect(mockResendSend).toHaveBeenCalledWith({
      from: "Quiver <test@quiversurf.app>",
      to: "surfer@example.com",
      subject: "Conditions are lining up",
      html: "<p>Go surf.</p>",
      headers: {
        "X-Campaign": "condition-alert",
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
      },
    });

    const resendPayload = mockResendSend.mock.calls[0][0];
    expect(resendPayload).not.toHaveProperty("unsubscribeUrl");
    expect(resendPayload.headers).not.toHaveProperty("List-Unsubscribe-Post");
  });

  it("rejects non-HTTPS unsubscribe URLs in production", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };
    const { sendEmail } = await import("@/lib/mailer/client");

    await expect(
      sendEmail({
        from: "Quiver <test@quiversurf.app>",
        to: "surfer@example.com",
        subject: "Weekly recap",
        text: "One session this week.",
        unsubscribeUrl:
          "http://www.quiversurf.app/api/alerts/unsubscribe-email?user_id=user-1&token=signed",
      })
    ).rejects.toThrow("unsubscribeUrl must use HTTPS in production");
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("retains E2E email suppression for wrapper sends", async () => {
    process.env.PLAYWRIGHT_TEST = "true";
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import("@/lib/mailer/client");
    const { Resend } = jest.requireMock("resend") as {
      Resend: jest.Mock;
    };

    const result = await sendEmail({
      from: "Quiver <test@quiversurf.app>",
      to: "surfer@example.com",
      subject: "Suppressed send",
      text: "This must not reach Resend.",
      unsubscribeUrl:
        "https://www.quiversurf.app/api/alerts/unsubscribe-email?user_id=user-1&token=signed",
    });

    expect(result).toEqual({
      data: { id: expect.stringMatching(/^e2e-email-/) },
      error: null,
    });
    expect(Resend).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
  });
});
