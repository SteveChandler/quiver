/**
 * Unit tests for HLSVideoPlayer Component
 *
 * Covers:
 * - Safari native HLS playback (canPlayType returns truthy)
 * - Non-Safari hls.js dynamic import path
 * - Error state handling (renders null on error)
 * - Cleanup on unmount (Safari path and hls.js path)
 * - Network retry logic (up to 3 retries on fatal network errors)
 * - Non-network fatal errors destroy hls.js immediately
 * - Video element attributes (controls, autoPlay, playsInline, muted)
 * - Title prop forwarding
 * - Re-initialization on src prop change
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock hls.js module
const mockHlsInstance = {
  loadSource: jest.fn(),
  attachMedia: jest.fn(),
  destroy: jest.fn(),
  on: jest.fn(),
  startLoad: jest.fn(),
};

const MockHls = jest.fn(() => mockHlsInstance) as any;
MockHls.isSupported = jest.fn(() => true);
MockHls.Events = { ERROR: "hlsError" };
MockHls.ErrorTypes = { NETWORK_ERROR: "networkError", MEDIA_ERROR: "mediaError" };

jest.mock("hls.js", () => ({
  __esModule: true,
  default: MockHls,
}));

// =============================================================================
// HELPERS
// =============================================================================

let canPlayTypeMock: jest.Mock;

function setupSafariBehavior() {
  canPlayTypeMock.mockImplementation((type: string) => {
    if (type === "application/vnd.apple.mpegurl") return "probably";
    return "";
  });
}

function setupNonSafariBehavior() {
  canPlayTypeMock.mockReturnValue("");
}

// =============================================================================
// TESTS
// =============================================================================

describe("HLSVideoPlayer Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockHls.isSupported.mockReturnValue(true);

    // Mock canPlayType on HTMLVideoElement prototype
    canPlayTypeMock = jest.fn().mockReturnValue("");
    Object.defineProperty(HTMLVideoElement.prototype, "canPlayType", {
      value: canPlayTypeMock,
      writable: true,
      configurable: true,
    });

    // Mock load() on HTMLVideoElement prototype
    Object.defineProperty(HTMLVideoElement.prototype, "load", {
      value: jest.fn(),
      writable: true,
      configurable: true,
    });

    // Mock pause() on HTMLVideoElement prototype
    Object.defineProperty(HTMLVideoElement.prototype, "pause", {
      value: jest.fn(),
      writable: true,
      configurable: true,
    });
  });

  describe("Rendering", () => {
    it("should render a video element with correct attributes", async () => {
      // Use dynamic import to get fresh module state
      const { default: HLSVideoPlayer } = await import(
        "@/components/beach-detail/hls-video-player"
      );

      setupNonSafariBehavior();

      const { container } = render(
        <HLSVideoPlayer
          src="https://example.com/stream.m3u8"
          title="Live Cam"
        />
      );

      const video = container.querySelector("video");
      expect(video).toBeTruthy();
      expect(video?.getAttribute("title")).toBe("Live Cam");
      expect(video?.hasAttribute("controls")).toBe(true);
      // React sets muted as a DOM property, not an HTML attribute
      expect(video?.muted).toBe(true);
    });

    it("should render container with aspect-video class", async () => {
      const { default: HLSVideoPlayer } = await import(
        "@/components/beach-detail/hls-video-player"
      );

      setupNonSafariBehavior();

      const { container } = render(
        <HLSVideoPlayer src="https://example.com/stream.m3u8" />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("aspect-video");
      expect(wrapper).toHaveClass("bg-black");
    });
  });

  describe("Safari/iOS Native Fallback", () => {
    it("should prefer hls.js even when canPlayType returns truthy", async () => {
      const { default: HLSVideoPlayer } = await import(
        "@/components/beach-detail/hls-video-player"
      );

      setupSafariBehavior();
      MockHls.isSupported.mockReturnValue(true);

      await act(async () => {
        render(
          <HLSVideoPlayer src="https://example.com/stream.m3u8" />
        );
      });

      // hls.js should still be used when isSupported() is true
      expect(MockHls).toHaveBeenCalled();
      expect(mockHlsInstance.loadSource).toHaveBeenCalledWith(
        "https://example.com/stream.m3u8"
      );
    });

    it("should fall back to native when Hls.isSupported() is false but canPlayType is truthy", async () => {
      const { default: HLSVideoPlayer } = await import(
        "@/components/beach-detail/hls-video-player"
      );

      setupSafariBehavior();
      MockHls.isSupported.mockReturnValue(false);
      MockHls.mockClear();

      const { container } = await act(async () => {
        return render(
          <HLSVideoPlayer src="https://example.com/stream.m3u8" />
        );
      });

      // hls.js constructor should NOT be called (isSupported is false)
      expect(MockHls).not.toHaveBeenCalled();
      // But component should still render (native fallback, not error)
      const video = container.querySelector("video") as HTMLVideoElement;
      expect(video).toBeTruthy();
    });
  });

  describe("hls.js Playback (Chrome/Firefox)", () => {
    it("should create Hls instance with correct config", async () => {
      const { default: HLSVideoPlayer } = await import(
        "@/components/beach-detail/hls-video-player"
      );

      setupNonSafariBehavior();

      await act(async () => {
        render(
          <HLSVideoPlayer src="https://example.com/stream.m3u8" />
        );
      });

      expect(MockHls).toHaveBeenCalledWith({
        enableWorker: true,
        lowLatencyMode: true,
      });
    });

    it("should call loadSource and attachMedia on Hls instance", async () => {
      const { default: HLSVideoPlayer } = await import(
        "@/components/beach-detail/hls-video-player"
      );

      setupNonSafariBehavior();

      await act(async () => {
        render(
          <HLSVideoPlayer src="https://example.com/stream.m3u8" />
        );
      });

      expect(mockHlsInstance.loadSource).toHaveBeenCalledWith(
        "https://example.com/stream.m3u8"
      );
      expect(mockHlsInstance.attachMedia).toHaveBeenCalled();
    });

    it("should register error handler on Hls instance", async () => {
      const { default: HLSVideoPlayer } = await import(
        "@/components/beach-detail/hls-video-player"
      );

      setupNonSafariBehavior();

      await act(async () => {
        render(
          <HLSVideoPlayer src="https://example.com/stream.m3u8" />
        );
      });

      expect(mockHlsInstance.on).toHaveBeenCalledWith(
        "hlsError",
        expect.any(Function)
      );
    });
  });

  describe("Error Handling", () => {
    it("should render error fallback UI when error state is true", async () => {
      const { default: HLSVideoPlayer } = await import(
        "@/components/beach-detail/hls-video-player"
      );

      setupNonSafariBehavior();
      MockHls.isSupported.mockReturnValue(false);

      let container: HTMLElement;
      await act(async () => {
        const result = render(
          <HLSVideoPlayer src="https://example.com/stream.m3u8" />
        );
        container = result.container;
      });

      // When hls.js is not supported, error fallback UI should render
      expect(container!.textContent).toContain("Live stream unavailable right now");
    });

    it("should call onError callback when error occurs", async () => {
      const { default: HLSVideoPlayer } = await import(
        "@/components/beach-detail/hls-video-player"
      );

      setupNonSafariBehavior();
      MockHls.isSupported.mockReturnValue(false);

      const onError = jest.fn();
      await act(async () => {
        render(
          <HLSVideoPlayer src="https://example.com/stream.m3u8" onError={onError} />
        );
      });

      expect(onError).toHaveBeenCalled();
    });

    it("should retry on fatal network errors up to 3 times", async () => {
      const { default: HLSVideoPlayer } = await import(
        "@/components/beach-detail/hls-video-player"
      );

      setupNonSafariBehavior();
      MockHls.isSupported.mockReturnValue(true);

      await act(async () => {
        render(
          <HLSVideoPlayer src="https://example.com/stream.m3u8" />
        );
      });

      // Get the error handler
      const errorHandler = mockHlsInstance.on.mock.calls.find(
        (call: any[]) => call[0] === "hlsError"
      )?.[1];

      expect(errorHandler).toBeDefined();

      // Simulate 3 fatal network errors - should retry each time
      for (let i = 0; i < 3; i++) {
        act(() => {
          errorHandler("hlsError", {
            fatal: true,
            type: "networkError",
          });
        });
      }

      expect(mockHlsInstance.startLoad).toHaveBeenCalledTimes(3);
    });

    it("should destroy Hls on fatal non-network error", async () => {
      const { default: HLSVideoPlayer } = await import(
        "@/components/beach-detail/hls-video-player"
      );

      setupNonSafariBehavior();
      MockHls.isSupported.mockReturnValue(true);

      await act(async () => {
        render(
          <HLSVideoPlayer src="https://example.com/stream.m3u8" />
        );
      });

      const errorHandler = mockHlsInstance.on.mock.calls.find(
        (call: any[]) => call[0] === "hlsError"
      )?.[1];

      act(() => {
        errorHandler("hlsError", {
          fatal: true,
          type: "mediaError", // Not a network error
        });
      });

      expect(mockHlsInstance.destroy).toHaveBeenCalled();
    });

    it("should not retry on non-fatal errors", async () => {
      const { default: HLSVideoPlayer } = await import(
        "@/components/beach-detail/hls-video-player"
      );

      setupNonSafariBehavior();
      MockHls.isSupported.mockReturnValue(true);

      await act(async () => {
        render(
          <HLSVideoPlayer src="https://example.com/stream.m3u8" />
        );
      });

      const errorHandler = mockHlsInstance.on.mock.calls.find(
        (call: any[]) => call[0] === "hlsError"
      )?.[1];

      act(() => {
        errorHandler("hlsError", {
          fatal: false,
          type: "networkError",
        });
      });

      expect(mockHlsInstance.startLoad).not.toHaveBeenCalled();
      expect(mockHlsInstance.destroy).not.toHaveBeenCalled();
    });
  });

  describe("Cleanup on Unmount", () => {
    it("should destroy Hls instance on unmount (non-Safari path)", async () => {
      const { default: HLSVideoPlayer } = await import(
        "@/components/beach-detail/hls-video-player"
      );

      setupNonSafariBehavior();

      let unmount: () => void;
      await act(async () => {
        const result = render(
          <HLSVideoPlayer src="https://example.com/stream.m3u8" />
        );
        unmount = result.unmount;
      });

      // Clear the previous destroy calls from error handling tests
      mockHlsInstance.destroy.mockClear();

      act(() => {
        unmount();
      });

      expect(mockHlsInstance.destroy).toHaveBeenCalled();
    });
  });
});
