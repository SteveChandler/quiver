/**
 * @jest-environment node
 */

var mockCapture = jest.fn();
var mockFlush = jest.fn(async () => undefined);
var mockPostHogConstructor = jest.fn();

function mockPostHogClass(...args: unknown[]) {
  mockPostHogConstructor(...args);
  return {
    capture: mockCapture,
    flush: mockFlush,
  };
}

jest.mock("posthog-node", () => ({
  __esModule: true,
  PostHog: mockPostHogClass,
}));

import {
  _resetPostHogServerClientForTesting,
  capturePostHogEvent,
} from "@/lib/posthog-server";

describe("posthog-server", () => {
  const originalToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const originalHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const originalVercelEnv = process.env.VERCEL_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetPostHogServerClientForTesting();
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com";
    process.env.VERCEL_ENV = "production";
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = originalToken;
    process.env.NEXT_PUBLIC_POSTHOG_HOST = originalHost;
    process.env.VERCEL_ENV = originalVercelEnv;
  });

  it("does nothing without a token", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

    await capturePostHogEvent({
      distinctId: "user-123",
      event: "invite_generated",
    });

    expect(mockPostHogConstructor).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("uses a shared client and standard properties", async () => {
    await capturePostHogEvent({
      distinctId: "user-123",
      event: "invite_generated",
      properties: { source: "profile" },
    });
    await capturePostHogEvent({
      distinctId: "user-123",
      event: "invite_consumed",
    });

    expect(mockPostHogConstructor).toHaveBeenCalledTimes(1);
    expect(mockPostHogConstructor).toHaveBeenCalledWith("phc_test", {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: "user-123",
      event: "invite_generated",
      properties: {
        app: "quiver-web",
        platform: "server",
        environment: "production",
        source: "profile",
      },
    });
    expect(mockFlush).toHaveBeenCalledTimes(2);
  });

  it("swallows capture failures", async () => {
    mockCapture.mockImplementationOnce(() => {
      throw new Error("posthog unavailable");
    });

    await expect(
      capturePostHogEvent({
        distinctId: "user-123",
        event: "notification_delivery_attempt",
      })
    ).resolves.toBeUndefined();
  });
});
