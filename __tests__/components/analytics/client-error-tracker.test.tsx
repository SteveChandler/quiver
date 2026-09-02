import React from "react";
import { render, waitFor } from "@testing-library/react";
import { ClientErrorTracker } from "@/components/providers/client-error-tracker";
import * as Sentry from "@sentry/nextjs";

const mockTrack = jest.fn();

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

describe("ClientErrorTracker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.pushState({}, "", "/hi/honolulu/diamond-head-cliffs");
  });

  it("suppresses the known WKWebView postMessage unhandled rejection noise", async () => {
    render(<ClientErrorTracker />);

    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.assign(event, {
      reason: new Error("WKWebView API client did not respond to this postMessage"),
    });

    window.dispatchEvent(event);

    await waitFor(() => {
      expect(mockTrack).not.toHaveBeenCalled();
    });
  });

  it("suppresses stale Next Server Action ID noise after deploys", async () => {
    render(<ClientErrorTracker />);

    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.assign(event, {
      reason: new Error(
        'Server Action "40256c33e11f9018ae34e62550c3409e91112dabde" was not found on the server.'
      ),
    });

    window.dispatchEvent(event);

    await waitFor(() => {
      expect(mockTrack).not.toHaveBeenCalled();
    });
  });

  it("suppresses opaque cross-origin script errors without stack context", async () => {
    render(<ClientErrorTracker />);

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "Script error.",
      })
    );

    await waitFor(() => {
      expect(mockTrack).not.toHaveBeenCalled();
    });
  });

  it("suppresses browser-injected object update rejection noise", async () => {
    render(<ClientErrorTracker />);

    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.assign(event, {
      reason: "Object Not Found Matching Id:5, MethodName:update, ParamCount:4",
    });

    window.dispatchEvent(event);

    await waitFor(() => {
      expect(mockTrack).not.toHaveBeenCalled();
    });
  });

  it("still tracks other unhandled rejections", async () => {
    render(<ClientErrorTracker />);

    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.assign(event, {
      reason: new Error("Unexpected fetch failure"),
    });

    window.dispatchEvent(event);

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith("client_error", {
        metadata: expect.objectContaining({
          message: "Error: Unexpected fetch failure",
          route: "/hi/honolulu/diamond-head-cliffs",
          source: "unhandled_rejection",
        }),
      });
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Unexpected fetch failure" }),
        expect.objectContaining({
          tags: { client_error_source: "unhandled_rejection" },
          extra: expect.objectContaining({
            route: "/hi/honolulu/diamond-head-cliffs",
          }),
        }),
      );
    });
  });
});
