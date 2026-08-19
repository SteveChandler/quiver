import {
  dispatchPushMessages,
  type PushMessage,
} from "@/lib/services/push-delivery";

const message = (token: string): PushMessage => ({
  to: token,
  title: "Surf alert",
  body: "Conditions are changing.",
});

describe("dispatchPushMessages per-token outcomes", () => {
  it("correlates FCM sent, failed, and unknown responses by token", async () => {
    const result = await dispatchPushMessages({
      messages: [message("token-sent"), message("token-failed"), message("token-missing")],
      fcm: {
        sendEach: jest.fn().mockResolvedValue({
          successCount: 1,
          failureCount: 1,
          responses: [
            { success: true },
            { success: false, error: { code: "messaging/internal-error", message: "temporary" } },
          ],
        }),
      } as never,
    });

    expect(result.outcomes).toEqual([
      { token: "token-sent", status: "sent", invalidToken: false },
      {
        token: "token-failed",
        status: "unknown",
        invalidToken: false,
        error: "messaging/internal-error: temporary",
      },
      { token: "token-missing", status: "unknown", invalidToken: false },
    ]);
  });

  it("marks transport rejection as unknown by leaving dispatch to the worker", async () => {
    const fcm = {
      sendEach: jest.fn().mockRejectedValue(new Error("transport failed")),
    };

    await expect(
      dispatchPushMessages({ messages: [message("token-ambiguous")], fcm: fcm as never }),
    ).rejects.toThrow("transport failed");
  });

  it("treats a malformed FCM response as unknown for every message", async () => {
    const result = await dispatchPushMessages({
      messages: [message("token-malformed")],
      fcm: { sendEach: jest.fn().mockResolvedValue({}) } as never,
    });

    expect(result.outcomes[0]).toMatchObject({
      status: "unknown",
      invalidToken: false,
    });
  });

  it("marks a definitive FCM invalid-token rejection as failed", async () => {
    const result = await dispatchPushMessages({
      messages: [message("token-invalid")],
      fcm: {
        sendEach: jest.fn().mockResolvedValue({
          successCount: 0,
          failureCount: 1,
          responses: [{
            success: false,
            error: {
              code: "messaging/registration-token-not-registered",
              message: "not registered",
            },
          }],
        }),
      } as never,
    });

    expect(result.outcomes[0]).toMatchObject({
      status: "failed",
      invalidToken: true,
    });
  });

  it("keeps unconfigured FCM outcomes ambiguous", async () => {
    const result = await dispatchPushMessages({
      messages: [message("token-without-provider")],
      fcm: null,
    });

    expect(result.outcomes[0]).toMatchObject({
      status: "unknown",
      invalidToken: false,
    });
  });

  it("correlates Expo tickets and marks missing tickets unknown", async () => {
    const result = await dispatchPushMessages({
      messages: [
        message("ExponentPushToken[sent]"),
        message("ExponentPushToken[failed]"),
        message("ExponentPushToken[missing]"),
      ],
      fcm: null,
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { status: "ok" },
            { status: "error", message: "temporary failure" },
          ],
        }),
      }) as never,
    });

    expect(result.outcomes).toEqual([
      { token: "ExponentPushToken[sent]", status: "sent", invalidToken: false },
      {
        token: "ExponentPushToken[failed]",
        status: "failed",
        invalidToken: false,
        error: "temporary failure",
      },
      { token: "ExponentPushToken[missing]", status: "unknown", invalidToken: false },
    ]);
  });

  it("treats an Expo ticket without a recognized status as unknown", async () => {
    const result = await dispatchPushMessages({
      messages: [message("ExponentPushToken[malformed]")],
      fcm: null,
      fetchImpl: jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{}] }),
      }) as never,
    });

    expect(result.outcomes[0]).toMatchObject({ status: "unknown", invalidToken: false });
  });

  it.each([400, 408, 429, 500, 503])("treats Expo HTTP %s as ambiguous", async (status) => {
    const result = await dispatchPushMessages({
      messages: [message("ExponentPushToken[ambiguous]")],
      fcm: null,
      fetchImpl: jest.fn().mockResolvedValue({ ok: false, status }) as never,
    });

    expect(result.outcomes[0]).toMatchObject({ status: "unknown", invalidToken: false });
  });

});
