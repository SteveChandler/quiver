import { validateAnonCapture } from "@/lib/alerts/anon-capture-validator";

const valid = {
  email: "user@example.com",
  beach_id: "00000000-0000-0000-0000-000000000001",
  preset_type: "glass_off",
  return_path: "/ca/san-diego/blacks-beach",
  website: "", // honeypot
};

describe("validateAnonCapture", () => {
  it("accepts valid input", () => {
    expect(validateAnonCapture(valid)).toEqual({ ok: true, value: { ...valid, email: "user@example.com" } });
  });

  it("normalizes email to lowercase + trimmed", () => {
    const result = validateAnonCapture({ ...valid, email: "  USER@Example.COM  " });
    expect(result.ok && result.value.email).toBe("user@example.com");
  });

  it("rejects malformed email", () => {
    expect(validateAnonCapture({ ...valid, email: "not-an-email" })).toEqual({ ok: false, error: "invalid_email" });
  });

  it("rejects bad uuid in beach_id", () => {
    expect(validateAnonCapture({ ...valid, beach_id: "not-a-uuid" })).toEqual({ ok: false, error: "invalid_beach_id" });
  });

  it("rejects unknown preset_type", () => {
    expect(validateAnonCapture({ ...valid, preset_type: "epic_conditions" })).toEqual({ ok: false, error: "invalid_preset" });
    expect(validateAnonCapture({ ...valid, preset_type: "evil" })).toEqual({ ok: false, error: "invalid_preset" });
  });

  it("rejects return_path with leading // (open redirect)", () => {
    expect(validateAnonCapture({ ...valid, return_path: "//evil.com/path" })).toEqual({ ok: false, error: "invalid_return_path" });
  });

  it("rejects return_path with javascript: protocol", () => {
    expect(validateAnonCapture({ ...valid, return_path: "javascript:alert(1)" })).toEqual({ ok: false, error: "invalid_return_path" });
  });

  it("rejects return_path with absolute http URL", () => {
    expect(validateAnonCapture({ ...valid, return_path: "https://evil.com/" })).toEqual({ ok: false, error: "invalid_return_path" });
  });

  it("flags honeypot tripped", () => {
    expect(validateAnonCapture({ ...valid, website: "https://spam.com" })).toEqual({ ok: false, error: "honeypot" });
  });

  it("rejects missing fields", () => {
    expect(validateAnonCapture({ ...valid, email: undefined as unknown as string })).toEqual({ ok: false, error: "missing_email" });
  });
});
