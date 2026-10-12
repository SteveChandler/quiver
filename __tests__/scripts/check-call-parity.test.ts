/** @jest-environment node */

import { missingParityEnv, parseParityArgs } from "@/scripts/check-call-parity";

const USER_ID = "00000000-0000-4000-8000-000000000001";

describe("parseParityArgs", () => {
  it("accepts a UUID and an optional local date in either flag order", () => {
    expect(parseParityArgs(["--user", USER_ID])).toEqual({ userId: USER_ID });
    expect(parseParityArgs(["--date", "2024-02-29", "--user", USER_ID])).toEqual({ userId: USER_ID, date: "2024-02-29" });
  });

  it("requires --user", () => {
    expect(() => parseParityArgs([])).toThrow("--user is required");
    expect(() => parseParityArgs(["--date", "2026-10-11"])).toThrow("--user is required");
    expect(() => parseParityArgs(["--user"])).toThrow("Missing value for --user");
  });

  it("rejects a bad UUID", () => {
    expect(() => parseParityArgs(["--user", "nope"])).toThrow("--user must be a UUID");
    expect(() => parseParityArgs(["--user", `${USER_ID}x`])).toThrow("--user must be a UUID");
  });

  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-10-00", "2026-1-01", "tomorrow"])("rejects invalid date %s", (date) => {
    expect(() => parseParityArgs(["--user", USER_ID, "--date", date])).toThrow("--date must be a valid YYYY-MM-DD");
  });

  it("rejects missing dates, unknown flags and duplicate flags", () => {
    expect(() => parseParityArgs(["--user", USER_ID, "--date"])).toThrow("Missing value for --date");
    expect(() => parseParityArgs(["--user", USER_ID, "--other", "value"])).toThrow("Unknown flag: --other");
    expect(() => parseParityArgs(["--user", "--date", "2026-10-11"])).toThrow("Missing value for --user");
    expect(() => parseParityArgs(["--user", USER_ID, "--user", USER_ID])).toThrow("Duplicate flag: --user");
  });
});

describe("missingParityEnv", () => {
  it("names both missing variables", () => {
    expect(missingParityEnv({})).toEqual(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  });

  it("names only the missing variable", () => {
    expect(missingParityEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9" })).toEqual(["SUPABASE_SERVICE_ROLE_KEY"]);
    expect(missingParityEnv({ SUPABASE_SERVICE_ROLE_KEY: "placeholder" })).toEqual(["NEXT_PUBLIC_SUPABASE_URL"]);
  });

  it("accepts both variables and ignores unrelated variables", () => {
    expect(missingParityEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_SERVICE_ROLE_KEY: "placeholder", OTHER: "value" })).toEqual([]);
  });

  it("treats empty and whitespace-only values as missing", () => {
    expect(missingParityEnv({ NEXT_PUBLIC_SUPABASE_URL: " ", SUPABASE_SERVICE_ROLE_KEY: "" })).toEqual(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  });
});

it("imports without fetching, installing guards or running main", () => {
  const fetchSpy = jest.spyOn(globalThis, "fetch");
  const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  const originalExitCode = process.exitCode;
  const originalLogLevel = process.env.LOG_LEVEL;
  try {
    jest.isolateModules(() => {
      const imported = require("@/scripts/check-call-parity") as typeof import("@/scripts/check-call-parity");
      expect(imported.parseParityArgs(["--user", USER_ID])).toEqual({ userId: USER_ID });
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(globalThis.fetch).toBe(fetchSpy);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(originalExitCode);
    expect(process.env.LOG_LEVEL).toBe(originalLogLevel);
  } finally {
    fetchSpy.mockRestore();
    errorSpy.mockRestore();
  }
});
