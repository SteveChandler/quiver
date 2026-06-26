import type { ReactElement } from "react";
import NewSessionPage from "@/app/sessions/new/page";
import { verifyEmailActionToken } from "@/lib/email/verify-email-action";
import { SessionEmailLogFallback } from "@/app/session/log/SessionEmailLogFallback";
import { NewSessionClientPage } from "@/app/sessions/new/NewSessionClientPage";

jest.mock("@/lib/email/verify-email-action", () => ({
  verifyEmailActionToken: jest.fn(),
}));

jest.mock("@/app/session/log/SessionEmailLogFallback", () => ({
  SessionEmailLogFallback: jest.fn(() => null),
}));

jest.mock("@/app/sessions/new/NewSessionClientPage", () => ({
  NewSessionClientPage: jest.fn(() => null),
}));

const mockVerifyEmailActionToken =
  verifyEmailActionToken as jest.MockedFunction<typeof verifyEmailActionToken>;

function propsOf(element: ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

describe("/sessions/new email token fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the existing one-tap fallback after verifying a log_session token", async () => {
    mockVerifyEmailActionToken.mockResolvedValue({ success: true, userId: "user-1" });

    const element = await NewSessionPage({
      searchParams: Promise.resolve({
        token: "signed-token",
        beachId: "beach-123",
        startedAt: "2026-06-25T12:00:00.000Z",
        entrySource: "email",
        beach_name: "Blacks",
        score: "82",
        email_type: "session_prompt",
        message_instance_id: "msg-123",
      }),
    });

    expect(mockVerifyEmailActionToken).toHaveBeenCalledWith(
      "signed-token",
      "log_session"
    );
    expect(element.type).toBe(SessionEmailLogFallback);
    expect(propsOf(element)).toMatchObject({
      token: "signed-token",
      beachId: "beach-123",
      windowStart: "2026-06-25T12:00:00.000Z",
      beachName: "Blacks",
      score: "82",
    });
  });

  it("renders the normal authenticated session form when no email token is present", async () => {
    const element = await NewSessionPage({
      searchParams: Promise.resolve({
        mode: "log",
      }),
    });

    expect(mockVerifyEmailActionToken).not.toHaveBeenCalled();
    expect(element.type).toBe(NewSessionClientPage);
  });

  it("renders an invalid-link response when token verification fails", async () => {
    mockVerifyEmailActionToken.mockResolvedValue({
      success: false,
      error: "Invalid or expired link",
      errorType: "invalid",
    });

    const element = await NewSessionPage({
      searchParams: Promise.resolve({
        token: "bad-token",
        beachId: "beach-123",
        startedAt: "2026-06-25T12:00:00.000Z",
      }),
    });

    expect(mockVerifyEmailActionToken).toHaveBeenCalledWith(
      "bad-token",
      "log_session"
    );
    expect(propsOf(element)).toMatchObject({
      title: "Invalid Link",
      message: "Invalid or expired link",
    });
  });
});
