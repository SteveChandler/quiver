import { safeGetItem, safeSetItem, safeRemoveItem } from "@/lib/utils/safe-storage";

describe("safe-storage", () => {
  const originalLocalStorage = globalThis.localStorage;

  afterEach(() => {
    // Restore real localStorage after each test
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  describe("safeGetItem", () => {
    it("returns value when localStorage works normally", () => {
      const mockStorage = {
        getItem: jest.fn().mockReturnValue("test-value"),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        length: 0,
        key: jest.fn(),
      };
      Object.defineProperty(globalThis, "localStorage", {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      expect(safeGetItem("my-key")).toBe("test-value");
      expect(mockStorage.getItem).toHaveBeenCalledWith("my-key");
    });

    it("returns null when key does not exist", () => {
      const mockStorage = {
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        length: 0,
        key: jest.fn(),
      };
      Object.defineProperty(globalThis, "localStorage", {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      expect(safeGetItem("missing-key")).toBeNull();
    });

    it("returns null when localStorage throws", () => {
      const mockStorage = {
        getItem: jest.fn().mockImplementation(() => {
          throw new DOMException("Access denied", "SecurityError");
        }),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        length: 0,
        key: jest.fn(),
      };
      Object.defineProperty(globalThis, "localStorage", {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      expect(safeGetItem("any-key")).toBeNull();
    });
  });

  describe("safeSetItem", () => {
    it("sets value when localStorage works normally", () => {
      const mockStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        length: 0,
        key: jest.fn(),
      };
      Object.defineProperty(globalThis, "localStorage", {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      safeSetItem("my-key", "my-value");
      expect(mockStorage.setItem).toHaveBeenCalledWith("my-key", "my-value");
    });

    it("does not throw when localStorage throws", () => {
      const mockStorage = {
        getItem: jest.fn(),
        setItem: jest.fn().mockImplementation(() => {
          throw new DOMException("QuotaExceededError", "QuotaExceededError");
        }),
        removeItem: jest.fn(),
        clear: jest.fn(),
        length: 0,
        key: jest.fn(),
      };
      Object.defineProperty(globalThis, "localStorage", {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      expect(() => safeSetItem("my-key", "my-value")).not.toThrow();
    });
  });

  describe("safeRemoveItem", () => {
    it("removes value when localStorage works normally", () => {
      const mockStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        length: 0,
        key: jest.fn(),
      };
      Object.defineProperty(globalThis, "localStorage", {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      safeRemoveItem("my-key");
      expect(mockStorage.removeItem).toHaveBeenCalledWith("my-key");
    });

    it("does not throw when localStorage throws", () => {
      const mockStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn().mockImplementation(() => {
          throw new DOMException("Access denied", "SecurityError");
        }),
        clear: jest.fn(),
        length: 0,
        key: jest.fn(),
      };
      Object.defineProperty(globalThis, "localStorage", {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      expect(() => safeRemoveItem("my-key")).not.toThrow();
    });
  });
});
