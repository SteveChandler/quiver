import { describeThrownError } from "@/lib/services/forecast/error-message";

describe("describeThrownError", () => {
  it("returns the message of an Error", () => {
    expect(describeThrownError(new Error("boom"))).toBe("boom");
  });

  it("falls back to the name of an Error with an empty message", () => {
    expect(describeThrownError(new TypeError(""))).toBe("TypeError");
  });

  it("reads message and code from a Supabase-style plain error object", () => {
    expect(
      describeThrownError({
        message: "canceling statement due to statement timeout",
        code: "57014",
        details: null,
        hint: null,
      }),
    ).toBe("canceling statement due to statement timeout (57014)");
  });

  it("omits the code when the object has none", () => {
    expect(describeThrownError({ message: "nope" })).toBe("nope");
  });

  it("serialises an object without a message instead of printing [object Object]", () => {
    expect(describeThrownError({ code: "PGRST000" })).toBe('{"code":"PGRST000"}');
  });

  it("appends the code of an Error the same way (throwOnError path)", () => {
    const error = Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" });
    expect(describeThrownError(error)).toBe("canceling statement due to statement timeout (57014)");
  });

  it("does not repeat a code the message already carries", () => {
    const error = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    expect(describeThrownError(error)).toBe("read ECONNRESET");
  });

  it("keeps a numeric code", () => {
    expect(describeThrownError({ message: "fetch failed", code: 500 })).toBe("fetch failed (500)");
  });

  it("caps a large serialised object", () => {
    expect(describeThrownError({ payload: "x".repeat(2000) }).length).toBeLessThanOrEqual(500);
  });

  it("returns a string when toJSON yields undefined", () => {
    expect(describeThrownError({ toJSON: () => undefined })).toBe("Unknown error");
  });

  it("handles strings, null and undefined", () => {
    expect(describeThrownError("plain")).toBe("plain");
    expect(describeThrownError(null)).toBe("Unknown error");
    expect(describeThrownError(undefined)).toBe("Unknown error");
  });

  it("does not throw on a circular object", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(describeThrownError(circular)).toBe("Unknown error");
  });
});
