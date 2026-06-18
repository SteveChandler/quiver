/** @jest-environment node */

if (typeof (globalThis as any).Response?.json !== "function") {
  (globalThis as any).Response.json = (data: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(data), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
    });
}

import { POST } from "@/app/api/app-link-email/route";

const send = jest.fn<
  Promise<{ data: { id: string }; error: Error | null }>,
  [unknown]
>(() =>
  Promise.resolve({ data: { id: "email_1" }, error: null }),
);

jest.mock("@/lib/mailer/client", () => ({
  resend: { emails: { send: (arg: unknown) => send(arg) } },
  MAIL_FROM: "Quiver <invites@send.quiversurf.app>",
  MAIL_REPLY_TO: "Quiver <invites@send.quiversurf.app>",
  getBaseUrl: () => "https://www.quiversurf.app",
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return { ...actual, withBotBlockingAndRateLimit: (handler: unknown) => handler };
});

function req(body: unknown): never {
  return new Request("http://localhost/api/app-link-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/app-link-email", () => {
  const originalResendKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = "test-resend-key";
  });

  afterAll(() => {
    process.env.RESEND_API_KEY = originalResendKey;
  });

  it("rejects an invalid email with 400 and does not send", async () => {
    const res = await POST(req({ email: "nope" }), undefined as never);
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the handoff email for a valid address", async () => {
    const res = await POST(
      req({ email: "surf@gmail.com", source: "landing_hero" }),
      undefined as never,
    );
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Open Quiver on your phone" }),
    );
  });

  it("never echoes the recipient address into the email body", async () => {
    await POST(req({ email: "surf@gmail.com" }), undefined as never);
    const arg = send.mock.calls[0]?.[0] as { react: unknown };
    expect(JSON.stringify(arg.react)).not.toContain("surf@gmail.com");
  });
});
