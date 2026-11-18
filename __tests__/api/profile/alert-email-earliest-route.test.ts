/** @jest-environment node */
import { isMissingAlertEmailEarliestColumn } from "@/lib/profile/alert-email-earliest";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

const USER = "11111111-1111-4111-8111-111111111111";
const calls: unknown[][] = [];
let result: { data: unknown; error: unknown } = { data: null, error: null };
const chain = new Proxy({}, {
  get: (_target, key: string) => key === "then"
    ? (resolve: (value: unknown) => void) => resolve(result)
    : (...args: unknown[]) => { calls.push([key, ...args]); return chain; },
});
const supabase = { from: (...args: unknown[]) => { calls.push(["from", ...args]); return chain; } };

jest.mock("@/lib/middleware/api-wrappers", () => ({
  ...jest.requireActual("@/lib/middleware/api-wrappers"),
  withAuth: (handler: (request: unknown, context: unknown) => unknown) => async (request: unknown) => handler(request, { user: { id: USER }, supabase }),
}));
const { GET, PATCH } = require("@/app/api/profile/alert-email-earliest/route");

const missingRead = { code: "42703", message: "column profiles.alert_email_earliest does not exist" };
const missingWrite = { code: "PGRST204", message: "Could not find the 'alert_email_earliest' column of 'profiles' in the schema cache" };
const request = (body?: unknown) => new Request("http://localhost/api/profile/alert-email-earliest", body === undefined ? {} : { method: "PATCH", body: JSON.stringify(body) });

beforeEach(() => { calls.length = 0; result = { data: null, error: null }; });

it("reads only this column for the signed-in user", async () => {
  result = { data: { alert_email_earliest: "05:00" }, error: null };
  const response = await GET(request(), {});
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual({ earliest: "05:00", supported: true });
  expect(calls).toEqual([["from", "profiles"], ["select", "alert_email_earliest"], ["eq", "id", USER], ["maybeSingle"]]);
  expect(response.headers.get("Cache-Control")).toMatch(/no-store/);
});

it("reports the setting as not supported before the column exists", async () => {
  result = { data: null, error: missingRead };
  const response = await GET(request(), {});
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual({ earliest: "09:00", supported: false });
});

it("does not hide a different read error as 'not supported'", async () => {
  result = { data: null, error: { code: "42501", message: "permission denied for table profiles" } };
  expect((await GET(request(), {})).status).toBe(500);
  result = { data: null, error: { code: "42703", message: "column profiles.other_column does not exist" } };
  expect((await GET(request(), {})).status).toBe(500);
  expectConsoleErrors([/./]);
});

it("saves one of the four values on the user's own row", async () => {
  result = { data: { alert_email_earliest: "06:00" }, error: null };
  const response = await PATCH(request({ earliest: "06:00" }), {});
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual({ earliest: "06:00", supported: true });
  expect(calls).toEqual([["from", "profiles"], ["update", { alert_email_earliest: "06:00" }], ["eq", "id", USER], ["select", "alert_email_earliest"], ["single"]]);
});

it.each([["08:00"], [null], ["5 AM"]])("rejects %s with a 400 and writes nothing", async earliest => {
  const response = await PATCH(request({ earliest }), {});
  expect(response.status).toBe(400);
  expect(calls).toEqual([]);
});

it("returns 503 before the column exists, and 500 for any other write error", async () => {
  result = { data: null, error: missingWrite };
  expect((await PATCH(request({ earliest: "05:00" }), {})).status).toBe(503);
  result = { data: null, error: { code: "23514", message: "violates check constraint profiles_alert_email_earliest_check" } };
  expect((await PATCH(request({ earliest: "05:00" }), {})).status).toBe(500);
  expectConsoleErrors([/./]);
});

it("treats only a missing alert_email_earliest column as 'not there yet'", () => {
  expect(isMissingAlertEmailEarliestColumn(missingRead)).toBe(true);
  expect(isMissingAlertEmailEarliestColumn(missingWrite)).toBe(true);
  expect(isMissingAlertEmailEarliestColumn({ code: "42703", message: "column profiles.daily_call_time does not exist" })).toBe(false);
  expect(isMissingAlertEmailEarliestColumn({ code: "57014", message: "alert_email_earliest timeout" })).toBe(false);
  expect(isMissingAlertEmailEarliestColumn(new Error("network"))).toBe(false);
  expect(isMissingAlertEmailEarliestColumn(null)).toBe(false);
});
