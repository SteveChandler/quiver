import { getVisitorId, getExistingVisitorId, clearVisitorId } from "@/lib/utils/visitor-id";

const VISITOR_ID_KEY = "quiver_visitor_id";

function makeMockStorage(): Storage & {
  _store: Record<string, string>;
} {
  const store: Record<string, string> = {};
  return {
    _store: store,
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
  };
}

describe("visitor-id", () => {
  let mockStorage: ReturnType<typeof makeMockStorage>;

  beforeEach(() => {
    mockStorage = makeMockStorage();
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: jest.fn(() => "test-uuid-1234-5678-abcd-ef0123456789") },
      writable: true,
      configurable: true,
    });
  });

  describe("getVisitorId", () => {
    it("creates a new UUID when none exists", () => {
      const id = getVisitorId();
      expect(id).toBe("test-uuid-1234-5678-abcd-ef0123456789");
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        VISITOR_ID_KEY,
        "test-uuid-1234-5678-abcd-ef0123456789"
      );
    });

    it("returns existing UUID on second call without creating a new one", () => {
      const first = getVisitorId();
      const second = getVisitorId();

      expect(first).toBe(second);
      // randomUUID should only be called once
      expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
    });

    it("returns empty string in SSR (no window)", () => {
      const originalWindow = globalThis.window;
      // Simulate SSR by removing window
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(getVisitorId()).toBe("");

      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("getExistingVisitorId", () => {
    it("returns null when no ID is stored", () => {
      expect(getExistingVisitorId()).toBeNull();
    });

    it("returns existing ID without creating a new one", () => {
      mockStorage._store[VISITOR_ID_KEY] = "existing-id";

      const id = getExistingVisitorId();

      expect(id).toBe("existing-id");
      expect(crypto.randomUUID).not.toHaveBeenCalled();
      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });

    it("returns null in SSR (no window)", () => {
      const originalWindow = globalThis.window;
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(getExistingVisitorId()).toBeNull();

      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("clearVisitorId", () => {
    it("removes the stored ID", () => {
      mockStorage._store[VISITOR_ID_KEY] = "some-id";

      clearVisitorId();

      expect(mockStorage.removeItem).toHaveBeenCalledWith(VISITOR_ID_KEY);
      expect(getExistingVisitorId()).toBeNull();
    });

    it("is a noop in SSR (no window)", () => {
      const originalWindow = globalThis.window;
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(() => clearVisitorId()).not.toThrow();
      expect(mockStorage.removeItem).not.toHaveBeenCalled();

      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        writable: true,
        configurable: true,
      });
    });
  });
});
