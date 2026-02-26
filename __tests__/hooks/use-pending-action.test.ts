import { renderHook, act } from "@testing-library/react";
import { usePendingAction } from "@/hooks/use-pending-action";

const STORAGE_KEY = "pendingAction";
const FIVE_MINUTES = 300_000;

// Mock safe-storage so we control localStorage behaviour in tests
jest.mock("@/lib/utils/safe-storage", () => ({
  safeGetItem: jest.fn(),
  safeSetItem: jest.fn(),
  safeRemoveItem: jest.fn(),
}));

import {
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
} from "@/lib/utils/safe-storage";

const mockGetItem = safeGetItem as jest.Mock;
const mockSetItem = safeSetItem as jest.Mock;
const mockRemoveItem = safeRemoveItem as jest.Mock;

describe("usePendingAction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Default: nothing stored
    mockGetItem.mockReturnValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns null when no pending action is in localStorage", () => {
    mockGetItem.mockReturnValue(null);

    const { result } = renderHook(() => usePendingAction());

    expect(result.current.pendingAction).toBeNull();
  });

  it("returns the pending action from localStorage on mount", () => {
    const stored = {
      type: "favorite",
      beachId: "beach-abc",
      beachName: "Ocean Beach",
      timestamp: Date.now(),
    };
    mockGetItem.mockReturnValue(JSON.stringify(stored));

    const { result } = renderHook(() => usePendingAction());

    expect(result.current.pendingAction).toEqual(stored);
  });

  it("ignores and clears an expired action (older than 5 minutes)", () => {
    const stored = {
      type: "alert",
      beachId: "beach-xyz",
      beachName: "Blacks Beach",
      timestamp: Date.now() - FIVE_MINUTES - 1,
    };
    mockGetItem.mockReturnValue(JSON.stringify(stored));

    const { result } = renderHook(() => usePendingAction());

    expect(result.current.pendingAction).toBeNull();
    expect(mockRemoveItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it("does not expire an action that is exactly at the expiry boundary", () => {
    const stored = {
      type: "favorite",
      beachId: "beach-def",
      beachName: "Trestles",
      // Exactly 5 minutes old — not yet expired
      timestamp: Date.now() - FIVE_MINUTES,
    };
    mockGetItem.mockReturnValue(JSON.stringify(stored));

    const { result } = renderHook(() => usePendingAction());

    // Date.now() - timestamp === FIVE_MINUTES is NOT > FIVE_MINUTES, so it's valid
    expect(result.current.pendingAction).toEqual(stored);
  });

  it("setPendingAction writes to localStorage with an auto-generated timestamp", () => {
    const now = 1_700_000_000_000;
    jest.setSystemTime(now);

    const { result } = renderHook(() => usePendingAction());

    act(() => {
      result.current.setPendingAction({
        type: "favorite",
        beachId: "beach-123",
        beachName: "Rincon",
      });
    });

    const expectedPayload = {
      type: "favorite",
      beachId: "beach-123",
      beachName: "Rincon",
      timestamp: now,
    };

    expect(mockSetItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(expectedPayload)
    );
    expect(result.current.pendingAction).toEqual(expectedPayload);
  });

  it("clearPendingAction removes from localStorage and sets state to null", () => {
    const stored = {
      type: "alert",
      beachId: "beach-999",
      beachName: "Mavericks",
      timestamp: Date.now(),
    };
    mockGetItem.mockReturnValue(JSON.stringify(stored));

    const { result } = renderHook(() => usePendingAction());

    expect(result.current.pendingAction).toEqual(stored);

    act(() => {
      result.current.clearPendingAction();
    });

    expect(mockRemoveItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(result.current.pendingAction).toBeNull();
  });

  it("is SSR-safe: handles corrupt JSON in localStorage without throwing", () => {
    // Simulates a scenario where localStorage holds corrupt data
    // (e.g., written by an older version of the app, or truncated during SSR).
    // The hook must not propagate the JSON.parse error to callers.
    mockGetItem.mockReturnValue("not-valid-json{{{");

    let result: ReturnType<typeof renderHook<ReturnType<typeof usePendingAction>, unknown>>;
    expect(() => {
      result = renderHook(() => usePendingAction());
    }).not.toThrow();

    // Corrupt data is silently cleared and state stays null
    expect(result!.result.current.pendingAction).toBeNull();
    expect(mockRemoveItem).toHaveBeenCalledWith(STORAGE_KEY);
  });
});
