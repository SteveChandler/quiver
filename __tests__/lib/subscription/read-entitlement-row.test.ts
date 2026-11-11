/**
 * @jest-environment node
 */
const mockCaptureException = jest.fn();
jest.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import {
  readEntitlementRow,
  resetEntitlementReadReportingForTests,
} from "@/lib/subscription/read-entitlement-row";

type Result = { data: unknown; error: unknown };

function clientReturning(...results: Array<Result | (() => never)>) {
  const maybeSingle = jest.fn(async () => {
    const next = results.shift();
    if (!next) throw new Error("unexpected extra read");
    return typeof next === "function" ? next() : next;
  });
  const eq = jest.fn(() => ({ maybeSingle }));
  const from = jest.fn(() => ({ select: () => ({ eq }) }));
  return { client: { from } as never, maybeSingle, eq, from };
}

const timeout = { code: "57014", message: "canceling statement due to statement timeout" };
const proRow = { is_pro: true, is_trialing: false, billing_issue: false, expires_at: null };

beforeEach(() => {
  jest.clearAllMocks();
  resetEntitlementReadReportingForTests();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
});

it("returns the row from the first read", async () => {
  const { client, maybeSingle, eq, from } = clientReturning({ data: proRow, error: null });
  await expect(readEntitlementRow(client, "user-1")).resolves.toEqual({ status: "ok", row: proRow });
  expect(maybeSingle).toHaveBeenCalledTimes(1);
  expect(from).toHaveBeenCalledWith("user_entitlements");
  expect(eq).toHaveBeenCalledWith("user_id", "user-1");
});

it("returns ok with a null row when the user has no row", async () => {
  const { client } = clientReturning({ data: null, error: null });
  await expect(readEntitlementRow(client, "user-1")).resolves.toEqual({ status: "ok", row: null });
  expect(mockCaptureException).not.toHaveBeenCalled();
});

it("retries once and returns the row when the second read succeeds", async () => {
  const { client, maybeSingle } = clientReturning({ data: null, error: timeout }, { data: proRow, error: null });
  await expect(readEntitlementRow(client, "user-1")).resolves.toEqual({ status: "ok", row: proRow });
  expect(maybeSingle).toHaveBeenCalledTimes(2);
  expect(mockCaptureException).not.toHaveBeenCalled();
});

it("returns unknown after two failed reads, never a free row", async () => {
  const { client, maybeSingle } = clientReturning({ data: null, error: timeout }, { data: null, error: timeout });
  await expect(readEntitlementRow(client, "user-1")).resolves.toEqual({ status: "unknown", error: timeout });
  expect(maybeSingle).toHaveBeenCalledTimes(2);
  expect(mockCaptureException).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining(timeout.message), cause: timeout }),
    { level: "warning", tags: { area: "entitlement-read" } },
  );
});

it("counts a network failure that supabase-js returns as an error result", async () => {
  const fetchFailed = { code: "", message: "TypeError: fetch failed", details: "", hint: "" };
  const { client } = clientReturning({ data: null, error: fetchFailed }, { data: null, error: fetchFailed });
  await expect(readEntitlementRow(client, "user-1")).resolves.toMatchObject({ status: "unknown" });
});

it("rethrows a value thrown by the client instead of calling it unknown", async () => {
  const bug = new TypeError("Cannot read properties of undefined (reading 'eq')");
  const { client, maybeSingle } = clientReturning(() => {
    throw bug;
  });
  await expect(readEntitlementRow(client, "user-1")).rejects.toBe(bug);
  expect(maybeSingle).toHaveBeenCalledTimes(1);
  expect(mockCaptureException).not.toHaveBeenCalled();
});

it("reports at most once per five minutes in one process", async () => {
  jest.useFakeTimers({ now: new Date("2026-11-11T12:00:00Z") });
  const failing = (): Result[] => [{ data: null, error: timeout }, { data: null, error: timeout }];

  await readEntitlementRow(clientReturning(...failing()).client, "user-1");
  await readEntitlementRow(clientReturning(...failing()).client, "user-2");
  jest.setSystemTime(new Date("2026-11-11T12:04:59Z"));
  await readEntitlementRow(clientReturning(...failing()).client, "user-3");
  expect(mockCaptureException).toHaveBeenCalledTimes(1);

  jest.setSystemTime(new Date("2026-11-11T12:05:00Z"));
  await readEntitlementRow(clientReturning(...failing()).client, "user-4");
  expect(mockCaptureException).toHaveBeenCalledTimes(2);
});
