import { categorizeError, isChunkLoadError } from "@/components/error-boundaries/utils/error-categorizer";

describe("isChunkLoadError", () => {
  it("returns true for ChunkLoadError name", () => {
    const error = new Error("Something failed");
    error.name = "ChunkLoadError";
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('returns true for "Loading chunk" message', () => {
    const error = new Error(
      "Loading chunk 12345 failed. (missing: /_next/static/chunks/12345-abc.js)"
    );
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('returns true for "failed to fetch dynamically imported module" message', () => {
    const error = new Error(
      "Failed to fetch dynamically imported module: /_next/static/chunks/pages/home.js"
    );
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('returns true for "/_next/static/chunks/" in message', () => {
    const error = new Error(
      "Error loading /_next/static/chunks/vendor-abc123.js"
    );
    expect(isChunkLoadError(error)).toBe(true);
  });

  it("returns false for non-Error values", () => {
    expect(isChunkLoadError("string error")).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError(42)).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
  });

  it("returns false for unrelated errors", () => {
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
    expect(isChunkLoadError(new TypeError("Cannot read properties of null"))).toBe(false);
    expect(isChunkLoadError(new Error("fetch failed"))).toBe(false);
  });

  it("is case-insensitive for message matching", () => {
    expect(isChunkLoadError(new Error("LOADING CHUNK abc failed"))).toBe(true);
    expect(
      isChunkLoadError(new Error("FAILED TO FETCH DYNAMICALLY IMPORTED MODULE"))
    ).toBe(true);
  });

  it("is case-sensitive for error name (Webpack uses exact 'ChunkLoadError')", () => {
    const error = new Error("something");
    error.name = "chunkloaderror";
    // name check is exact, but message doesn't match either
    expect(isChunkLoadError(error)).toBe(false);
  });
});

describe("categorizeError", () => {
  it("categorizes chunk load errors before network errors", () => {
    // "fetch" would match network, but ChunkLoadError name takes priority
    const error = new Error("Failed to fetch dynamically imported module");
    error.name = "ChunkLoadError";
    expect(categorizeError(error)).toBe("chunk_load");
  });

  it('categorizes chunk load errors by message containing "loading chunk"', () => {
    expect(categorizeError(new Error("Loading chunk 999 failed"))).toBe(
      "chunk_load"
    );
  });

  it("categorizes network errors", () => {
    expect(categorizeError(new Error("Network request failed"))).toBe(
      "network"
    );
  });

  it("categorizes data parsing errors", () => {
    expect(categorizeError(new Error("Unexpected token in JSON"))).toBe(
      "data_parsing"
    );
  });

  it("categorizes rendering errors", () => {
    const error = new TypeError("Cannot read properties of undefined");
    expect(categorizeError(error)).toBe("rendering");
  });

  it("categorizes system errors", () => {
    expect(categorizeError(new Error("QuotaExceededError: storage quota"))).toBe(
      "system"
    );
  });

  it("returns unknown for unrecognized errors", () => {
    expect(categorizeError(new Error("Something went wrong"))).toBe("unknown");
  });
});
