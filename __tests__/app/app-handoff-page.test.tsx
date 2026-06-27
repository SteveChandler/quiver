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

jest.mock("@/lib/analytics/app-handoff-tracking", () => ({
  trackAppHandoffView: jest.fn(),
  trackAppHandoffQrRendered: jest.fn(),
  trackAppHandoffEmailSubmit: jest.fn(),
  trackAppHandoffEmailSent: jest.fn(),
  trackAppHandoffEmailFailed: jest.fn(),
}));

import AppHandoffPage, { metadata } from "@/app/app/page";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

describe("/app handoff page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is noindex", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("logs and redirects iPhone visitors to the campaign-tagged App Store URL", async () => {
    mockHeadersGet.mockReturnValue(IPHONE_UA);

    await expect(
      AppHandoffPage({
        searchParams: Promise.resolve({
          source: "map_literacy_panel",
          surface: "map",
          placement: "field_guide_qr",
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
        metadata: expect.objectContaining({
          source: "map_literacy_panel",
          surface: "map",
          placement: "field_guide_qr",
          qr_id: "map_literacy_field_guide",
          target: "download",
          utm_source: "qr",
          utm_medium: "map_field_guide",
          platform: "ios",
          destination_type: "app_store",
          handoff_channel: "qr",
        }),
      }),
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("ct=app_first_v1"),
    );
  });

  it("logs and redirects Android visitors to the configured Android access destination", async () => {
    mockHeadersGet.mockReturnValue(ANDROID_UA);

    await expect(
      AppHandoffPage({
        searchParams: Promise.resolve({
          source: "android_beta_page",
          surface: "android_beta",
          placement: "instructions_qr",
          qr_id: "android_beta_instructions",
          target: "android_beta",
          utm_source: "qr",
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockLogOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "android_beta_page",
          surface: "android_beta",
          placement: "instructions_qr",
          qr_id: "android_beta_instructions",
          target: "android_beta",
          platform: "android",
          destination_type: "play_store",
          destination_url: expect.stringContaining(
            "https://play.google.com/apps/testing/app.quiversurf.surf",
          ),
          handoff_channel: "qr",
        }),
      }),
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("https://play.google.com/apps/testing/app.quiversurf.surf"),
    );
  });

  it("renders the desktop handoff module for desktop visitors", async () => {
    mockHeadersGet.mockReturnValue(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    );

    render(
      await AppHandoffPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getByRole("heading", { name: /get quiver on your phone/i }),
    ).toBeInTheDocument();
  });
});
