import {
  isSessionImportsEnabled,
  isSessionImportsUserAllowed,
} from "@/lib/flags/session-imports";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("session imports flag", () => {
  it("allows nobody with an empty allowlist", () => {
    process.env.SESSION_IMPORTS_ENABLED = "true";
    delete process.env.SESSION_IMPORTS_USER_ALLOWLIST;
    expect(isSessionImportsUserAllowed("surfer-1")).toBe(false);
    process.env.SESSION_IMPORTS_USER_ALLOWLIST = " , ";
    expect(isSessionImportsUserAllowed("surfer-1")).toBe(false);
  });

  it("allows only listed IDs when enabled", () => {
    process.env.SESSION_IMPORTS_ENABLED = "true";
    process.env.SESSION_IMPORTS_USER_ALLOWLIST = "surfer-1, surfer-2";
    expect(isSessionImportsEnabled()).toBe(true);
    expect(isSessionImportsUserAllowed("surfer-2")).toBe(true);
    expect(isSessionImportsUserAllowed("surfer-3")).toBe(false);
  });

  it("allows nobody when the flag is off", () => {
    process.env.SESSION_IMPORTS_ENABLED = "false";
    process.env.SESSION_IMPORTS_USER_ALLOWLIST = "surfer-1";
    expect(isSessionImportsEnabled()).toBe(false);
    expect(isSessionImportsUserAllowed("surfer-1")).toBe(false);
  });
});
