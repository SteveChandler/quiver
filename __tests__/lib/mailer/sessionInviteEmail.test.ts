// Mock the mailer client wrapper to avoid importing the real 'resend' package
jest.mock("@/lib/mailer/client", () => ({
  resend: { emails: { send: jest.fn() } },
  MAIL_FROM: "Quiver <invites@quiversurf.app>",
}));
import * as client from "@/lib/mailer/client";
import { sendSessionInviteEmail } from "@/lib/mailer/sessionInviteEmail";

describe("sendSessionInviteEmail", () => {
  it("sends with subject including inviter and beach, includes CTA url", async () => {
    await sendSessionInviteEmail({
      toEmail: "invitee@example.com",
      inviter: { id: "u1", name: "Alex" },
      session: {
        id: "s1",
        arrival_time: "2025-08-10T08:00:00Z",
        beach_name: "Ocean Beach",
      },
      message: "Let's go",
      activityId: "a1",
      appUrl: "http://localhost:3000",
    });

    const call = (client as any).resend.emails.send.mock.calls[0][0];
    expect(call.subject).toMatch(/Alex invited you to surf at Ocean Beach/);
    expect(call.react).toBeTruthy();
  });
});
