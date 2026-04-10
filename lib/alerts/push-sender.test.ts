import { sendPushNotifications } from "./push-sender";
import * as firebaseAdminModule from "../services/firebase-admin";

jest.mock("../services/firebase-admin");

const mockGetFirebaseAdminMessaging = jest.mocked(firebaseAdminModule.getFirebaseAdminMessaging);

const mockSendEach = jest.fn();

function makeFetchOk(): jest.Mock {
  return jest.fn().mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue("") });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSendEach.mockResolvedValue({ responses: [] });
  mockGetFirebaseAdminMessaging.mockReturnValue({ sendEach: mockSendEach } as unknown as ReturnType<typeof firebaseAdminModule.getFirebaseAdminMessaging>);
  global.fetch = makeFetchOk();
});

describe("sendPushNotifications", () => {
  it("is a no-op when given an empty array", async () => {
    await sendPushNotifications([]);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSendEach).not.toHaveBeenCalled();
  });

  it("routes ExponentPushToken messages to the Expo push endpoint", async () => {
    await sendPushNotifications([
      { to: "ExponentPushToken[abc123]", title: "Test", body: "Hello" },
    ]);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({ method: "POST" })
    );
    expect(mockSendEach).not.toHaveBeenCalled();
  });

  it("routes raw FCM tokens through firebase-admin sendEach", async () => {
    await sendPushNotifications([
      { to: "fcm-token-xyz", title: "Wave Alert", body: "Perfect conditions" },
    ]);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSendEach).toHaveBeenCalledTimes(1);

    const messages = mockSendEach.mock.calls[0][0];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      token: "fcm-token-xyz",
      notification: { title: "Wave Alert", body: "Perfect conditions" },
    });
  });

  it("handles mixed Expo + FCM batches in one call", async () => {
    await sendPushNotifications([
      { to: "ExponentPushToken[abc]", title: "T1", body: "B1" },
      { to: "fcm-token-xyz", title: "T2", body: "B2" },
    ]);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.anything()
    );
    expect(mockSendEach).toHaveBeenCalledTimes(1);
  });

  it("serializes data payload entries as strings for FCM", async () => {
    await sendPushNotifications([
      {
        to: "fcm-token-abc",
        title: "Alert",
        body: "Check it",
        data: { count: 42, nested: { foo: "bar" }, flag: true },
      },
    ]);

    const messages = mockSendEach.mock.calls[0][0];
    expect(messages[0].data).toEqual({
      count: "42",
      nested: '{"foo":"bar"}',
      flag: "true",
    });
  });

  it("logs and does not throw when firebase-admin is unavailable", async () => {
    mockGetFirebaseAdminMessaging.mockReturnValue(null);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendPushNotifications([{ to: "fcm-token-unavailable", title: "T", body: "B" }])
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    expect(mockSendEach).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
