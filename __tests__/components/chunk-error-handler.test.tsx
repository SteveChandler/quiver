import React from "react";
import { render, act } from "@testing-library/react";

// Mock Sentry
const mockCaptureException = jest.fn();
jest.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

// Mock isChunkLoadError (we test that separately in error-categorizer.test.ts)
const mockIsChunkLoadError = jest.fn();
jest.mock("@/components/error-boundaries/utils/error-categorizer", () => ({
  isChunkLoadError: (...args: unknown[]) => mockIsChunkLoadError(...args),
}));

import { ChunkErrorHandler } from "@/components/chunk-error-handler";

// sessionStorage mock
const storage: Record<string, string> = {};
const mockSessionStorage = {
  getItem: jest.fn((key: string) => storage[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    storage[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete storage[key];
  }),
};

const mockReload = jest.fn();

beforeAll(() => {
  Object.defineProperty(window, "sessionStorage", {
    value: mockSessionStorage,
    writable: true,
  });
  /* eslint-disable no-restricted-properties -- test needs to mock window.location.reload */
  Object.defineProperty(window, "location", {
    value: { ...window.location, reload: mockReload },
    writable: true,
  });
  /* eslint-enable no-restricted-properties */
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  // Clear storage
  Object.keys(storage).forEach((key) => delete storage[key]);
  mockIsChunkLoadError.mockReturnValue(false);
});

afterEach(() => {
  jest.useRealTimers();
});

function fireWindowError(error: Error) {
  const event = new ErrorEvent("error", { error });
  window.dispatchEvent(event);
}

function fireUnhandledRejection(reason: Error) {
  // PromiseRejectionEvent is not available in jsdom, so use a CustomEvent
  const event = new Event("unhandledrejection") as Event & { reason: Error };
  Object.defineProperty(event, "reason", { value: reason });
  window.dispatchEvent(event);
}

describe("ChunkErrorHandler", () => {
  it("renders nothing", () => {
    const { container } = render(<ChunkErrorHandler />);
    expect(container.innerHTML).toBe("");
  });

  it("reloads on chunk load error from window.error", () => {
    mockIsChunkLoadError.mockReturnValue(true);
    render(<ChunkErrorHandler />);

    const error = new Error("Loading chunk 123 failed");
    error.name = "ChunkLoadError";
    fireWindowError(error);

    expect(mockReload).toHaveBeenCalledTimes(1);
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      "quiver:chunk_reload_count",
      "1"
    );
  });

  it("reloads on chunk load error from unhandledrejection", () => {
    mockIsChunkLoadError.mockReturnValue(true);
    render(<ChunkErrorHandler />);

    const error = new Error("Failed to fetch dynamically imported module");
    fireUnhandledRejection(error);

    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it("does not reload for non-chunk errors", () => {
    mockIsChunkLoadError.mockReturnValue(false);
    render(<ChunkErrorHandler />);

    fireWindowError(new Error("Some other error"));

    expect(mockReload).not.toHaveBeenCalled();
  });

  it("stops reloading after MAX_RELOADS (2)", () => {
    mockIsChunkLoadError.mockReturnValue(true);
    // Simulate 2 previous reloads
    storage["quiver:chunk_reload_count"] = "2";
    render(<ChunkErrorHandler />);

    fireWindowError(new Error("Loading chunk 456 failed"));

    expect(mockReload).not.toHaveBeenCalled();
  });

  it("reports to Sentry with correct tags before reloading", () => {
    mockIsChunkLoadError.mockReturnValue(true);
    render(<ChunkErrorHandler />);

    const error = new Error("Loading chunk 789 failed");
    error.name = "ChunkLoadError";
    fireWindowError(error);

    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      tags: {
        errorCategory: "chunk_load",
        chunk_reload_attempt: 1,
      },
    });
  });

  it("increments reload attempt in Sentry tag", () => {
    mockIsChunkLoadError.mockReturnValue(true);
    storage["quiver:chunk_reload_count"] = "1";
    render(<ChunkErrorHandler />);

    const error = new Error("Loading chunk failed");
    fireWindowError(error);

    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      tags: {
        errorCategory: "chunk_load",
        chunk_reload_attempt: 2,
      },
    });
  });

  it("resets counter after RESET_DELAY_MS", () => {
    storage["quiver:chunk_reload_count"] = "1";
    render(<ChunkErrorHandler />);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
      "quiver:chunk_reload_count"
    );
  });

  it("cleans up event listeners and timer on unmount", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    const removeSpy = jest.spyOn(window, "removeEventListener");

    const { unmount } = render(<ChunkErrorHandler />);

    // Verify listeners were registered
    expect(addSpy).toHaveBeenCalledWith("error", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith(
      "unhandledrejection",
      expect.any(Function)
    );

    unmount();

    // Verify listeners were removed with the same references
    expect(removeSpy).toHaveBeenCalledWith("error", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith(
      "unhandledrejection",
      expect.any(Function)
    );

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("handles sessionStorage errors gracefully", () => {
    mockIsChunkLoadError.mockReturnValue(true);
    mockSessionStorage.getItem.mockImplementationOnce(() => {
      throw new Error("Storage access denied");
    });

    render(<ChunkErrorHandler />);

    const error = new Error("Loading chunk failed");
    fireWindowError(error);

    // Should still reload (getReloadCount falls back to 0)
    expect(mockReload).toHaveBeenCalledTimes(1);
  });
});
