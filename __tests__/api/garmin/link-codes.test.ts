/** @jest-environment node */
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("server-only", () => ({}));
const mockAuth = jest.fn();
const mockFrom = jest.fn();
const mockRandomInt = jest.fn();
jest.mock("node:crypto", () => ({ ...jest.requireActual("node:crypto"), randomInt: (...args: unknown[]) => mockRandomInt(...args) }));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => ({ auth: { getUser: mockAuth } }) }));
jest.mock("@/lib/supabase", () => ({
  ...jest.requireActual("@/lib/supabase"),
  createServiceRoleClient: () => ({ from: mockFrom }),
}));
jest.mock("@/lib/middleware/api-wrappers/rate-limit-wrapper", () => ({ withRateLimit: (handler: unknown) => handler }));

import { NextRequest } from "next/server";
import { POST as create } from "@/app/api/v1/garmin/link-codes/route";
import { GET as poll } from "@/app/api/v1/garmin/link-codes/[id]/route";
import { POST as confirm } from "@/app/api/v1/garmin/link-codes/[id]/confirm/route";
import { hashSecret } from "@/lib/watch/device-token";
import { deviceNameForPartNumber } from "@/lib/watch/link-codes";

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;
const userId = "987fcdeb-51a2-43c1-a123-456789abcdef";
const linkId = "123e4567-e89b-42d3-a456-426614174000";
const deviceId = "123e4567-e89b-42d3-a456-426614174001";
const path = "http://localhost/api/v1/garmin/link-codes";
const payload = { deviceUid: "garmin-123", partNumber: "006-B4432-00", appVersion: "1.0.0" };
const context = (id: string): { params: Promise<{ id: string }> } => ({ params: Promise.resolve({ id }) });
const post = (body: unknown = payload): NextRequest => new NextRequest(path, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const get = (id: string, pollSecret: string): NextRequest =>
  new NextRequest(`${path}/${id}?pollSecret=${encodeURIComponent(pollSecret)}`);
let codes: Row[];
let devices: Row[];
let events: Row[];
let eventError: boolean;
let nextId: number;
const savedEnv = { enabled: process.env.GARMIN_WATCH_ENABLED, allowed: process.env.GARMIN_WATCH_USER_ALLOWLIST };

function databaseQuery(table: string): Record<string, jest.Mock> {
  let filters: Filter[] = [];
  let action: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  let value: Row = {};
  const query: Record<string, jest.Mock> = {};
  const collection = (): Row[] => table === "watch_link_codes" ? codes : table === "watch_devices" ? devices : events;
  const run = (): { data: Row | null; error: { code?: string; message: string } | null } => {
    const rows = collection();
    if (action === "insert") {
      if (table === "user_events" && eventError) return { data: null, error: { message: "event unavailable" } };
      if (table === "watch_link_codes" && rows.some(row => row.code === value.code && row.confirmed_at == null)) {
        return { data: null, error: { code: "23505", message: "duplicate code" } };
      }
      const inserted = { ...value, id: value.id ?? `generated-${++nextId}`, confirmed_at: null, claimed_at: null };
      rows.push(inserted);
      return { data: inserted, error: null };
    }
    if (action === "upsert") {
      const existing = rows.find(row => row.user_id === value.user_id && row.device_uid === value.device_uid);
      if (existing) { Object.assign(existing, value); return { data: existing, error: null }; }
      const inserted = { ...value, id: deviceId };
      rows.push(inserted);
      return { data: inserted, error: null };
    }
    const found = rows.find(row => filters.every(filter => filter(row)));
    if (action === "update") {
      if (found) Object.assign(found, value);
      return { data: found ?? null, error: null };
    }
    if (action === "delete") {
      for (let i = rows.length - 1; i >= 0; i--) if (filters.every(filter => filter(rows[i]))) rows.splice(i, 1);
      return { data: null, error: null };
    }
    return { data: found ?? null, error: null };
  };
  query.select = jest.fn(() => query);
  query.order = jest.fn(() => query);
  query.limit = jest.fn(() => query);
  query.eq = jest.fn((key: string, expected: unknown) => { filters.push(row => row[key] === expected); return query; });
  query.is = jest.fn((key: string, expected: unknown) => { filters.push(row => row[key] == expected); return query; });
  query.lt = jest.fn((key: string, expected: string) => { filters.push(row => String(row[key]) < expected); return query; });
  query.insert = jest.fn((row: Row) => { action = "insert"; value = row; return query; });
  query.upsert = jest.fn((row: Row) => { action = "upsert"; value = row; return query; });
  query.update = jest.fn((row: Row) => { action = "update"; value = row; return query; });
  query.delete = jest.fn(() => { action = "delete"; return query; });
  query.single = jest.fn(async () => run());
  query.maybeSingle = jest.fn(async () => run());
  query.then = jest.fn((resolve: (value: ReturnType<typeof run>) => void) => Promise.resolve(resolve(run())));
  return query;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GARMIN_WATCH_ENABLED = "true";
  process.env.GARMIN_WATCH_USER_ALLOWLIST = userId;
  mockAuth.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mockRandomInt.mockReturnValue(482913);
  codes = [];
  devices = [];
  events = [];
  eventError = false;
  nextId = 0;
  mockFrom.mockImplementation(databaseQuery);
});

afterAll(() => {
  if (savedEnv.enabled === undefined) delete process.env.GARMIN_WATCH_ENABLED;
  else process.env.GARMIN_WATCH_ENABLED = savedEnv.enabled;
  if (savedEnv.allowed === undefined) delete process.env.GARMIN_WATCH_USER_ALLOWLIST;
  else process.env.GARMIN_WATCH_USER_ALLOWLIST = savedEnv.allowed;
});

async function created(): Promise<{ code: string; linkId: string; pollSecret: string; expiresAt: string }> {
  const response = await create(post());
  expect(response.status).toBe(201);
  return (await response.json()).data;
}

it("creates the exact contract and stores only the poll secret hash", async () => {
  const before = Date.now();
  const result = await created();
  expect(result).toEqual({ code: "482913", linkId: expect.stringMatching(/^[0-9a-f-]{36}$/), pollSecret: expect.any(String), expiresAt: expect.any(String) });
  expect(Date.parse(result.expiresAt)).toBeGreaterThanOrEqual(before + 600_000);
  expect(Date.parse(result.expiresAt)).toBeLessThanOrEqual(Date.now() + 600_000);
  expect(codes[0]).toMatchObject({ id: result.linkId, code: result.code, poll_secret_hash: hashSecret(result.pollSecret), device_uid: payload.deviceUid });
  expect(JSON.stringify(codes[0])).not.toContain(result.pollSecret);
});

it("hides creation and polling when disabled", async () => {
  process.env.GARMIN_WATCH_ENABLED = "false";
  expect((await create(post())).status).toBe(404);
  expect((await poll(get(linkId, "secret"), context(linkId))).status).toBe(404);
  expect(mockFrom).not.toHaveBeenCalled();
});

it("rejects invalid creation bodies", async () => {
  for (const body of [{ ...payload, deviceUid: "" }, { ...payload, partNumber: "x".repeat(33) }, { ...payload, appVersion: "x".repeat(17) }]) {
    expect((await create(post(body))).status).toBe(400);
  }
  expect(mockFrom).not.toHaveBeenCalled();
});

it("polls pending, confirms, then issues one device token and reports claimed", async () => {
  const link = await created();
  const pending = await poll(get(link.linkId, link.pollSecret), context(link.linkId));
  expect(pending.status).toBe(200);
  expect(await pending.json()).toMatchObject({ data: { status: "pending" } });
  const confirmed = await confirm(post(), context(link.code));
  expect(confirmed.status).toBe(200);
  expect(await confirmed.json()).toMatchObject({ data: { linked: true, deviceName: "Forerunner 165" } });
  expect(devices[0]).toMatchObject({ id: deviceId, user_id: userId, device_uid: payload.deviceUid, token_hash: null });
  expect(events).toContainEqual(expect.objectContaining({ user_id: userId, event_type: "garmin_link_confirmed" }));
  const linked = await poll(get(link.linkId, link.pollSecret), context(link.linkId));
  expect(linked.status).toBe(200);
  const token = (await linked.json()).data.deviceToken;
  expect(token).toEqual(expect.any(String));
  expect(devices[0].token_hash).toBe(hashSecret(token));
  expect(JSON.stringify(devices[0])).not.toContain(token);
  expect(codes[0].claimed_at).toEqual(expect.any(String));
  const claimed = await poll(get(link.linkId, link.pollSecret), context(link.linkId));
  expect(claimed.status).toBe(200);
  expect(await claimed.json()).toMatchObject({ data: { status: "claimed" } });
});

it("hides an incorrect poll secret and malformed IDs", async () => {
  const link = await created();
  const wrong = await poll(get(link.linkId, "wrong"), context(link.linkId));
  expect(wrong.status).toBe(404);
  expect(await wrong.json()).toMatchObject({ error: "not_found" });
  expect((await poll(get("bad", link.pollSecret), context("bad"))).status).toBe(404);
  expect((await confirm(post(), context("bad"))).status).toBe(404);
});

it("returns 410 for an expired unconfirmed code and 404 when confirming it", async () => {
  const link = await created();
  codes[0].expires_at = new Date(Date.now() - 1000).toISOString();
  const expired = await poll(get(link.linkId, link.pollSecret), context(link.linkId));
  expect(expired.status).toBe(410);
  expect(await expired.json()).toMatchObject({ error: "expired" });
  expect((await confirm(post(), context(link.code))).status).toBe(404);
});

it("returns 404 for unknown or disallowed codes and 409 for a second confirmation", async () => {
  expect((await confirm(post(), context("123456"))).status).toBe(404);
  const link = await created();
  process.env.GARMIN_WATCH_USER_ALLOWLIST = "";
  expect((await confirm(post(), context(link.code))).status).toBe(404);
  process.env.GARMIN_WATCH_USER_ALLOWLIST = userId;
  expect((await confirm(post(), context(link.code))).status).toBe(200);
  const again = await confirm(post(), context(link.code));
  expect(again.status).toBe(409);
  expect(await again.json()).toMatchObject({ error: "already_confirmed" });
});

it("relinks the same device row and clears revocation and the old token", async () => {
  const first = await created();
  expect((await confirm(post(), context(first.code))).status).toBe(200);
  devices[0].revoked_at = new Date().toISOString();
  devices[0].token_hash = "old-token-hash";
  mockRandomInt.mockReturnValue(482914);
  const second = await created();
  expect((await confirm(post(), context(second.code))).status).toBe(200);
  expect(devices).toHaveLength(1);
  expect(devices[0]).toMatchObject({ id: deviceId, revoked_at: null, token_hash: null });
  expect(codes[1].device_id).toBe(deviceId);
});

it("deletes an expired unconfirmed collision, then creates the reused code", async () => {
  codes.push({ id: linkId, code: "482913", confirmed_at: null, expires_at: new Date(Date.now() - 1000).toISOString() });
  const link = await created();
  expect(link.code).toBe("482913");
  expect(codes).toHaveLength(1);
  expect(codes[0].id).toBe(link.linkId);
});

it("retries a live collision and zero-pads the next code", async () => {
  codes.push({ id: linkId, code: "482913", confirmed_at: null, expires_at: new Date(Date.now() + 600_000).toISOString() });
  mockRandomInt.mockReturnValueOnce(482913).mockReturnValueOnce(7);
  expect((await created()).code).toBe("000007");
  expect(codes).toHaveLength(2);
});

it("stops after five live code collisions", async () => {
  codes.push({ id: linkId, code: "482913", confirmed_at: null, expires_at: new Date(Date.now() + 600_000).toISOString() });
  const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await create(post())).status).toBe(500);
    expect(mockRandomInt).toHaveBeenCalledTimes(5);
    expect(codes).toHaveLength(1);
  } finally { errorLog.mockRestore(); }
});

it("does not fail confirmation when the user event insert fails", async () => {
  const link = await created();
  eventError = true;
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    expect((await confirm(post(), context(link.code))).status).toBe(200);
    expect(warn).toHaveBeenCalled();
  } finally { warn.mockRestore(); }
});

it("maps known part numbers and falls back for unknown hardware", () => {
  expect(deviceNameForPartNumber("006-B4257-00")).toBe("Forerunner 265");
  expect(deviceNameForPartNumber("unknown")).toBe("Garmin watch");
});
