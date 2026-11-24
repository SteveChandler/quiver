/** @jest-environment node */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.generated";
import { importUserEvents } from "../import-posthog-history";

const since = "2026-11-01T00:00:00.000Z";
const until = "2026-11-02T00:00:00.000Z";
const tiedTimestamp = "2026-11-01T12:00:00.123456+00:00";
const posthogHost = "https://posthog.invalid";
const originalFetch = globalThis.fetch;

const first = {
  id: "00000000-0000-4000-8000-000000000001",
  user_id: "member",
  session_id: null,
  event_type: "beach_view",
  beach_id: "beach",
  metadata: { source: "map", email: "redacted@example.invalid" },
  created_at: tiedTimestamp,
};
const mock = {
  ...first,
  id: "00000000-0000-4000-8000-000000000002",
  user_id: "mock-user",
};
const anonymous = {
  ...first,
  id: "00000000-0000-4000-8000-000000000003",
  user_id: null,
  session_id: "session",
};

function makeSource() {
  const fetchPage = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
    .mockImplementation(() => Promise.reject(new Error("Unexpected Supabase request")));
  const client = createClient<Database>("https://supabase.invalid", "placeholder", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchPage },
  });
  return { client, fetchPage };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

it("defaults to a bounded keyset and preserves import payloads across a tied timestamp", async () => {
  jest.replaceProperty(process, "env", { ...process.env, USER_EVENTS_KEYSET_EXPORT: undefined });
  const { client, fetchPage } = makeSource();
  fetchPage
    .mockResolvedValueOnce(Response.json([first, mock]))
    .mockResolvedValueOnce(Response.json([anonymous]));
  const sendBatch = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
  globalThis.fetch = sendBatch;

  const stats = await importUserEvents(client, posthogHost, "placeholder", new Set(["mock-user"]), {
    source: "user-events",
    since,
    until,
    limit: 3,
    batchSize: 2,
    confirmSend: true,
    includeMockUsers: false,
  });

  const urls = fetchPage.mock.calls.map(([url]) => new URL(String(url)));
  expect(urls.map(({ pathname }) => pathname)).toEqual([
    "/rest/v1/user_events", "/rest/v1/user_events",
  ]);
  const [firstPage, nextPage] = urls.map(({ searchParams }) => searchParams);
  expect(firstPage.get("select")).toBe("id,user_id,session_id,event_type,beach_id,metadata,created_at");
  expect(firstPage.get("order")).toBe("created_at.asc,id.asc");
  expect(nextPage.get("order")).toBe(firstPage.get("order"));
  expect(firstPage.get("limit")).toBe("2");
  expect(nextPage.get("limit")).toBe("1");
  expect(firstPage.get("offset")).toBeNull();
  expect(nextPage.get("offset")).toBeNull();
  expect(firstPage.getAll("created_at")).toEqual([`gte.${since}`, `lte.${until}`]);
  expect(nextPage.getAll("created_at")).toEqual([
    `gte.${since}`, `lte.${until}`, `gte.${tiedTimestamp}`,
  ]);
  expect(firstPage.get("or")).toBeNull();
  expect(nextPage.get("or")).toBe(
    `(created_at.gt.${tiedTimestamp},and(created_at.eq.${tiedTimestamp},id.gt.${mock.id}))`,
  );
  expect(stats).toEqual({ scanned: 3, skippedMock: 1, skippedInvalid: 0, prepared: 2, sent: 2 });
  expect(sendBatch).toHaveBeenCalledTimes(2);
  expect(sendBatch.mock.calls.map(([url]) => url)).toEqual([
    `${posthogHost}/batch/`, `${posthogHost}/batch/`,
  ]);
  expect(sendBatch.mock.calls.map(([, init]) => JSON.parse(init.body).batch)).toEqual(
    [first, anonymous].map((row) => [{
      event: "beach_view",
      distinct_id: row.user_id ?? "anon:session",
      timestamp: tiedTimestamp,
      properties: {
        source: "map",
        beach_id: "beach",
        import_source: "supabase_user_events",
        original_event_id: row.id,
        $insert_id: `supabase_user_events:${row.id}`,
      },
    }]),
  );
});

it("keeps the legacy offset queries when the flag is false", async () => {
  jest.replaceProperty(process, "env", { ...process.env, USER_EVENTS_KEYSET_EXPORT: "false" });
  const { client, fetchPage } = makeSource();
  fetchPage
    .mockResolvedValueOnce(Response.json([first]))
    .mockResolvedValueOnce(Response.json([]));
  const sendBatch = jest.fn();
  globalThis.fetch = sendBatch;

  const stats = await importUserEvents(client, posthogHost, "placeholder", new Set(), {
    source: "user-events",
    batchSize: 1,
    confirmSend: false,
    includeMockUsers: false,
  });

  const pages = fetchPage.mock.calls.map(([url]) => new URL(String(url)).searchParams);
  expect(pages.map((params) => [params.get("order"), params.get("offset"), params.get("limit"), params.get("or")]))
    .toEqual([["created_at.asc", "0", "1", null], ["created_at.asc", "1", "1", null]]);
  expect(stats).toEqual({ scanned: 1, skippedMock: 0, skippedInvalid: 0, prepared: 1, sent: 0 });
  expect(sendBatch).not.toHaveBeenCalled();
});
