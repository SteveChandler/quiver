/** @jest-environment node */
import React from "react";
import { NextRequest } from "next/server";

import {
  fakeSwellSupabase,
  swellSnapshot,
  SWELL_EVENT_KEY,
} from "@/__tests__/helpers/swell-share-fixtures";

let mockDb: Parameters<typeof fakeSwellSupabase>[0] = {};
let mockElement: React.ReactElement;
let mockOptions: { width: number; height: number };

jest.mock("next/og", () => ({
  ImageResponse: jest.fn().mockImplementation((element, options) => {
    mockElement = element;
    mockOptions = options;
    return { headers: new Headers() };
  }),
}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () =>
    jest.requireActual("@/__tests__/helpers/swell-share-fixtures").fakeSwellSupabase(mockDb),
}));

import { GET } from "@/app/api/og/swell/route";
import followupPool from "@/lib/notifications/copy/swell-followup-titles.v1.json";

interface HeadlineEntry {
  id: string;
  title: string;
  tags: string[];
}

const ARRIVED_POOL = followupPool.arrived as HeadlineEntry[];
/** A real arrived-pool entry the card can render from stored data alone. */
const ARRIVED_ENTRY = ARRIVED_POOL.find(
  (entry) => !entry.tags.includes("serious") && !/\{(?!beach\}|day\})/.test(entry.title),
)!;
const ARRIVED_HEADLINE = ARRIVED_ENTRY.title
  .replace("{beach}", "Trinidad State Beach")
  .replace("{day}", "Thursday");

function text(node: React.ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return typeof node === "string" || typeof node === "number" ? String(node) : "";
  }
  if (typeof node.type === "function") {
    return text((node.type as (props: unknown) => React.ReactNode)(node.props));
  }
  return text(node.props.children);
}

function render(query: Record<string, string>): Promise<{ headers: Headers }> {
  const search = new URLSearchParams(query);
  return GET(new NextRequest(`https://www.quiversurf.app/api/og/swell?${search}`)) as Promise<{ headers: Headers }>;
}

const originalFetch = global.fetch;

describe("GET /api/og/swell", () => {
  beforeEach(() => {
    mockDb = { snapshots: [swellSnapshot()] };
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("renders the 1200x630 link preview with the card content", async () => {
    const response = await render({ event_key: SWELL_EVENT_KEY, k: "arrived", t: ARRIVED_ENTRY.id, format: "og" });
    const output = text(mockElement);

    expect(mockOptions).toMatchObject({ width: 1200, height: 630 });
    for (const value of ["Trinidad State Beach", ARRIVED_HEADLINE, "6", "ft", "14", "Thu", "Oct 8", "QUIVER"]) {
      expect(output).toContain(value);
    }
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
  });

  it("resolves an uppercase event key", async () => {
    await render({ event_key: SWELL_EVENT_KEY.toUpperCase(), k: "arrived", t: ARRIVED_ENTRY.id });
    expect(text(mockElement)).toContain("Trinidad State Beach");
  });

  it("draws a serious-tagged headline for a serious swell even when t names a joke", async () => {
    mockDb = { snapshots: [swellSnapshot({ peak_face_height_ft: 10 })] };
    await render({ event_key: SWELL_EVENT_KEY, k: "arrived", t: ARRIVED_ENTRY.id });
    const output = text(mockElement);
    expect(output).not.toContain(ARRIVED_HEADLINE);
    expect(output).not.toMatch(/[{}]/);
    const seriousHeadlines = ARRIVED_POOL.filter((entry) => entry.tags.includes("serious")).map((entry) =>
      entry.title.replace("{beach}", "Trinidad State Beach").replace("{day}", "Thursday"),
    );
    expect(seriousHeadlines.some((headline) => output.includes(headline))).toBe(true);
  });

  it("renders the 1080x1350 portrait card", async () => {
    await render({ event_key: SWELL_EVENT_KEY, k: "dropped", format: "card" });
    expect(mockOptions).toMatchObject({ width: 1080, height: 1350 });
    expect(text(mockElement)).toContain("Was");
  });

  it("never draws text from the URL", async () => {
    await render({ event_key: SWELL_EVENT_KEY, k: "FREE BITCOIN", t: "Visit evil.example", format: "<svg>" });
    const output = text(mockElement);

    expect(mockOptions).toMatchObject({ width: 1200, height: 630 });
    expect(output).not.toMatch(/bitcoin|evil|svg/i);
    // Unknown kind falls back to "coming", unknown title id to the deterministic pick.
    const first = output;
    await render({ event_key: SWELL_EVENT_KEY, k: "coming" });
    expect(text(mockElement)).toBe(first);
  });

  it.each([
    ["a malformed key", { event_key: "Visit evil.example" }, {}],
    ["an unknown event", { event_key: SWELL_EVENT_KEY }, { snapshots: [] }],
    ["a failed read", { event_key: SWELL_EVENT_KEY }, { snapshotError: "boom" }],
    ["no key", {}, {}],
  ])("falls back to the generic card for %s", async (_name, query, db) => {
    mockDb = db;
    const response = await render(query);
    const output = text(mockElement);

    expect(output).toContain("There's swell on the way somewhere.");
    expect(output).not.toMatch(/evil/i);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
