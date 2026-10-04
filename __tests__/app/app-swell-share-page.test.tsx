import { fireEvent, render, screen } from "@testing-library/react";

import {
  fakeSwellSupabase,
  swellSnapshot,
  SWELL_EVENT_KEY,
} from "@/__tests__/helpers/swell-share-fixtures";

let mockDb: Parameters<typeof fakeSwellSupabase>[0] = {};
const mockHeadersGet = jest.fn();
const mockTrack = jest.fn();

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => ({ get: mockHeadersGet })),
}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () =>
    jest.requireActual("@/__tests__/helpers/swell-share-fixtures").fakeSwellSupabase(mockDb),
}));
jest.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));
jest.mock("@/lib/posthog-client", () => ({
  getClientPostHogDistinctId: () => undefined,
}));

import SwellSharePage, { generateMetadata } from "@/app/app/swell/[eventKey]/page";
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

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const ENCODED_KEY = encodeURIComponent(SWELL_EVENT_KEY);

function requestAs(userAgent: string): void {
  mockHeadersGet.mockImplementation((key: string) => (key === "user-agent" ? userAgent : null));
}

function props(eventKey = ENCODED_KEY, query: Record<string, string> = { k: "arrived", t: ARRIVED_ENTRY.id }) {
  return {
    params: Promise.resolve({ eventKey }),
    searchParams: Promise.resolve(query),
  };
}

async function renderPage(...args: Parameters<typeof props>): Promise<void> {
  render(await SwellSharePage(props(...args)));
}

const originalFetch = global.fetch;

describe("/app/swell/[eventKey]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-10-04T18:00:00.000Z"));
    mockDb = { snapshots: [swellSnapshot()] };
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    jest.spyOn(console, "error").mockImplementation(() => {});
    requestAs(IPHONE_UA);
  });
  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("is noindex and points link previews at the og image", async () => {
    const metadata = await generateMetadata(props());
    const images = metadata.openGraph?.images as Array<{ url: string; width: number; height: number }>;

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.title).toBe(ARRIVED_HEADLINE);
    expect(images[0]).toMatchObject({ width: 1200, height: 630 });
    expect(images[0].url).toContain(`/api/og/swell?event_key=${ENCODED_KEY}&k=arrived&t=${ARRIVED_ENTRY.id}&format=og`);
    expect((metadata.twitter as { card?: string; images?: string[] }).card).toBe("summary_large_image");
    expect((metadata.twitter as { images?: string[] }).images?.[0]).toBe(images[0].url);
  });

  it("does not let a joke title id headline a serious swell", async () => {
    mockDb = { snapshots: [swellSnapshot({ peak_face_height_ft: 10 })] };
    await renderPage();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).not.toHaveTextContent(ARRIVED_HEADLINE);
    expect(heading.textContent).not.toMatch(/[{}]/);
    const metadata = await generateMetadata(props());
    expect(metadata.title).toBe(heading.textContent);
  });

  it("keeps URL text out of metadata", async () => {
    const metadata = await generateMetadata(props(ENCODED_KEY, { k: "free money", t: "Visit evil.example" }));
    expect(JSON.stringify(metadata)).not.toMatch(/free money|evil/i);
  });

  it("shows the card, the history line and a teaser, not the full forecast", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(ARRIVED_HEADLINE);
    expect(screen.getByText("Trinidad State Beach")).toBeInTheDocument();
    expect(screen.getByText("New on the forecast as of Saturday. No revisions yet.")).toBeInTheDocument();
    expect(screen.getByText(/hour-by-hour for Trinidad State Beach.*is in the app/)).toBeInTheDocument();
  });

  it.each([
    ["ios", IPHONE_UA, "No app yet? Get Quiver on the App Store"],
    ["android", ANDROID_UA, "No app yet? Get Quiver for Android"],
  ])("on %s opens the app by custom scheme with a store fallback", async (platform, userAgent, storeLabel) => {
    requestAs(userAgent);
    await renderPage();

    const open = screen.getByRole("link", { name: "Open in Quiver" });
    expect(open).toHaveAttribute("href", `quiver://swell/${ENCODED_KEY}?k=arrived&t=${ARRIVED_ENTRY.id}`);
    const store = screen.getByRole("link", { name: storeLabel });
    expect(store.getAttribute("href")).toMatch(
      /^https:\/\/go\.quiversurf\.app\/app\/handoff\?source=swell_share&surface=swell_share&placement=store_fallback&utm_source=share&utm_medium=link&utm_campaign=share/,
    );

    expect(mockTrack).toHaveBeenCalledWith(
      "share_link_opened",
      expect.objectContaining({ surface: "swell_share", kind: "arrived", event_key: SWELL_EVENT_KEY, platform }),
      { includeAttribution: false },
    );

    open.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(open);
    expect(mockTrack).toHaveBeenCalledWith(
      "cta_click",
      expect.objectContaining({
        surface: "swell_share",
        kind: "arrived",
        event_key: SWELL_EVENT_KEY,
        placement: "open_in_quiver",
      }),
    );
    const posted = (global.fetch as jest.Mock).mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(posted.map((body) => body.eventType)).toEqual(["share_link_opened", "cta_click"]);
    expect(posted[1].metadata).toMatchObject({ surface: "swell_share", kind: "arrived", event_key: SWELL_EVENT_KEY });
  });

  it("on desktop shows a QR code and both store links", async () => {
    requestAs(DESKTOP_UA);
    await renderPage();

    expect(screen.queryByRole("link", { name: "Open in Quiver" })).not.toBeInTheDocument();
    expect(screen.getByTitle("Scan to open this swell on your phone")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get Quiver for iPhone" }).getAttribute("href")).toMatch(
      /^https:\/\/apps\.apple\.com\/.*ct=share/,
    );
    expect(screen.getByRole("link", { name: "Get Quiver for Android" })).toHaveAttribute("href", "/android-beta");
  });

  it.each([
    ["a malformed key", "not-a-key", {}],
    ["an unknown event", ENCODED_KEY, { snapshots: [] }],
    ["a failed read", ENCODED_KEY, { snapshotError: "boom" }],
  ])("shows the generic card and an install CTA for %s", async (_name, eventKey, db) => {
    mockDb = db;
    await renderPage(eventKey);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("There's swell on the way somewhere.");
    expect(screen.queryByRole("link", { name: "Open in Quiver" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get Quiver on the App Store" }).getAttribute("href")).toMatch(
      /^https:\/\/go\.quiversurf\.app\/app\/handoff\?/,
    );

    const metadata = await generateMetadata(props(eventKey));
    expect(metadata.robots).toMatchObject({ index: false });
    expect(JSON.stringify(metadata.openGraph?.images)).toContain("/api/og/swell?k=arrived&format=og");
  });

  it("keeps a passed event on the page with the funnel", async () => {
    jest.setSystemTime(new Date("2026-10-12T00:00:00.000Z"));
    mockDb = { snapshots: [swellSnapshot({ run_date: "2026-10-07", detected_at: "2026-10-07T14:30:00.000Z" })] };
    await renderPage();

    expect(screen.getByText(/come and gone/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Get Quiver on the App Store/ })).toBeInTheDocument();
  });
});
