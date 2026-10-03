import { render, screen } from "@testing-library/react";

const mockHeadersGet = jest.fn();
const mockRedirect = jest.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
});
const mockLogOpen = jest.fn<Promise<void>, [unknown]>(() => Promise.resolve());

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => ({
    get: mockHeadersGet,
  })),
}));

jest.mock("next/navigation", () => ({
  redirect: (target: string) => mockRedirect(target),
}));

jest.mock("@/lib/analytics/app-handoff-server", () => ({
  logAppHandoffLinkOpenedServer: (arg: unknown) => mockLogOpen(arg),
}));

let mockClassifyOverride: (() => never) | null = null;
jest.mock("@/lib/analytics/app-handoff-traffic", () => {
  const actual = jest.requireActual("@/lib/analytics/app-handoff-traffic");
  return {
    ...actual,
    classifyHandoffRequest: (arg: unknown) =>
      mockClassifyOverride
        ? mockClassifyOverride()
        : actual.classifyHandoffRequest(arg),
  };
});

jest.mock("@/lib/analytics/app-handoff-tracking", () => ({
  trackAppHandoffView: jest.fn(),
  trackAppHandoffQrRendered: jest.fn(),
  trackAppHandoffEmailSubmit: jest.fn(),
  trackAppHandoffEmailSent: jest.fn(),
  trackAppHandoffEmailFailed: jest.fn(),
}));

import AppHandoffPage, { metadata } from "@/app/app/page";
import DedicatedAppHandoffPage from "@/app/app/handoff/page";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const HANDOFF_ID = "33333333-3333-4333-8333-333333333333";

function setRequestHeaders(headers: Record<string, string>): void {
  const lower: Record<string, string> = {
    "accept-language": "en-US,en;q=0.9",
    ...headers,
  };
  mockHeadersGet.mockImplementation(
    (key: string) => lower[key.toLowerCase()] ?? null,
  );
}

describe("/app handoff page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClassifyOverride = null;
  });

  it("is noindex", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("serves the same handoff behavior on the dedicated universal-link path", () => {
    expect(DedicatedAppHandoffPage).toBe(AppHandoffPage);
  });

  it("logs and redirects iPhone visitors to the campaign-tagged App Store URL", async () => {
    setRequestHeaders({
      host: "go.quiversurf.app",
      "user-agent": IPHONE_UA,
      "sec-fetch-mode": "navigate",
    });

    await expect(
      AppHandoffPage({
        searchParams: Promise.resolve({
          source: "map_literacy_panel",
          surface: "map",
          placement: "field_guide_qr",
          handoff_id: HANDOFF_ID,
          qr_id: "map_literacy_field_guide",
          target: "download",
          utm_source: "qr",
          utm_medium: "map_field_guide",
          utm_campaign: "app_first_v1",
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockLogOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: HANDOFF_ID,
        metadata: expect.objectContaining({
          handoff_id: HANDOFF_ID,
          source: "map_literacy_panel",
          surface: "map",
          placement: "field_guide_qr",
          qr_id: "map_literacy_field_guide",
          target: "download",
          utm_source: "qr",
          utm_medium: "map_field_guide",
          platform: "ios",
          host: "go.quiversurf.app",
          ua_family: "Safari",
          destination_type: "app_store",
          handoff_channel: "qr",
          hit_kind: "route_hit",
          traffic_class: "human_candidate",
          handoff_id_source: "url",
        }),
        botFlagged: false,
      }),
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("ct=web"),
    );
  });

  it.each([
    ["email", { utm_source: "email", utm_medium: "app_link" }, "ct=email"],
    [
      "partner QR",
      { surface: "partner_landing", utm_campaign: "partner_SURF12" },
      "ct=partner_qr",
    ],
    [
      "share landing",
      {
        source: "share_landing",
        utm_source: "share",
        utm_medium: "link",
        utm_campaign: "share",
        utm_content: "7c1d7f4e-2b6a-4a57-9a5e-3d8f0b2f6a11",
      },
      "ct=share",
    ],
  ])(
    "normalizes %s App Store attribution",
    async (_label, params, expected) => {
      setRequestHeaders({ "user-agent": IPHONE_UA });

      await expect(
        AppHandoffPage({
          searchParams: Promise.resolve({
            handoff_id: HANDOFF_ID,
            ...params,
          }),
        }),
      ).rejects.toThrow("NEXT_REDIRECT");

      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining(expected),
      );
    },
  );

  it("logs and redirects Android visitors to the guided Android beta page", async () => {
    setRequestHeaders({ "user-agent": ANDROID_UA });

    await expect(
      AppHandoffPage({
        searchParams: Promise.resolve({
          source: "android_beta_page",
          surface: "android_beta",
          placement: "instructions_qr",
          handoff_id: HANDOFF_ID,
          qr_id: "android_beta_instructions",
          target: "android_beta",
          utm_source: "qr",
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockLogOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: HANDOFF_ID,
        metadata: expect.objectContaining({
          handoff_id: HANDOFF_ID,
          source: "android_beta_page",
          surface: "android_beta",
          placement: "instructions_qr",
          qr_id: "android_beta_instructions",
          target: "android_beta",
          platform: "android",
          destination_type: "android_beta",
          destination_url:
            "/android-beta?source=android_beta_page&surface=android_beta&placement=instructions_qr&campaign=app_first_v1",
          handoff_channel: "qr",
        }),
      }),
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      "/android-beta?source=android_beta_page&surface=android_beta&placement=instructions_qr&campaign=app_first_v1",
    );
  });

  it("replaces an invalid handoff ID at the server boundary", async () => {
    setRequestHeaders({ "user-agent": IPHONE_UA });

    await expect(
      AppHandoffPage({
        searchParams: Promise.resolve({
          handoff_id: "shared-campaign-name",
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockLogOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
        metadata: expect.not.objectContaining({
          handoff_id: "shared-campaign-name",
        }),
      }),
    );
  });

  it("renders the desktop handoff module for desktop visitors", async () => {
    setRequestHeaders({ "user-agent": DESKTOP_UA });

    render(
      await AppHandoffPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getByRole("heading", { name: /get quiver on your phone/i }),
    ).toBeInTheDocument();
  });

  it("still redirects a link-preview bot to the same App Store URL, flagged as non-human", async () => {
    setRequestHeaders({
      "user-agent": `facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php) ${IPHONE_UA}`,
    });

    await expect(
      AppHandoffPage({
        searchParams: Promise.resolve({ handoff_id: HANDOFF_ID }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("apps.apple.com"),
    );
    expect(mockLogOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        botFlagged: true,
        metadata: expect.objectContaining({
          traffic_class: "preview_fetcher",
          destination_type: "app_store",
        }),
      }),
    );
  });

  it("records handoff_id_source minted when the URL carries no valid id", async () => {
    setRequestHeaders({ "user-agent": IPHONE_UA });

    await expect(
      AppHandoffPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockLogOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ handoff_id_source: "minted" }),
      }),
    );
  });

  it("logs the row unflagged and signal-free when classification fails, and still redirects", async () => {
    setRequestHeaders({ "user-agent": IPHONE_UA });
    mockClassifyOverride = () => {
      throw new Error("boom");
    };

    await expect(
      AppHandoffPage({
        searchParams: Promise.resolve({ handoff_id: HANDOFF_ID }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("apps.apple.com"),
    );
    expect(mockLogOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        botFlagged: undefined,
        metadata: expect.not.objectContaining({ traffic_class: expect.anything() }),
      }),
    );
  });

  it("flags a desktop scraper but still renders the desktop page", async () => {
    setRequestHeaders({ "user-agent": "python-requests/2.31.0" });

    render(
      await AppHandoffPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(mockLogOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        botFlagged: true,
        metadata: expect.objectContaining({
          platform: "desktop",
          destination_type: "desktop_handoff",
        }),
      }),
    );
    expect(
      screen.getByRole("heading", { name: /get quiver on your phone/i }),
    ).toBeInTheDocument();
  });
});
