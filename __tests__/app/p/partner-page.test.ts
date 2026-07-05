/**
 * @jest-environment node
 */

import type { ReactElement } from "react";
import { createMockSupabaseClient } from "@/test-utils/api-test-helpers";

const mockSupabaseClient = createMockSupabaseClient();
const mockRedirect = jest.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
});

jest.mock("next/navigation", () => ({
  redirect: (target: string) => mockRedirect(target),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

import PartnerPage from "@/app/p/[partnerCode]/page";
import { PartnerQrLandingClient } from "@/app/p/[partnerCode]/partner-qr-landing-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SITE_URL = "https://www.quiversurf.app";

function renderPartnerPage(partnerCode: string) {
  return PartnerPage({ params: Promise.resolve({ partnerCode }) });
}

async function expectRedirect(
  promise: Promise<unknown>,
  target: string,
): Promise<void> {
  await expect(promise).rejects.toThrow(`NEXT_REDIRECT:${target}`);
  expect(mockRedirect).toHaveBeenCalledWith(target);
}

function mockPartnerProfile(
  profile: {
    id: string;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null,
) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: profile, error: null }),
  };
  mockSupabaseClient.from.mockReturnValueOnce(chain as any);
  return chain;
}

describe("/p/[partnerCode]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = SITE_URL;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("redirects invalid partner codes to home without querying the DB", async () => {
    await expectRedirect(renderPartnerPage("ab"), "/");

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("redirects codes with wildcard characters to home", async () => {
    await expectRedirect(renderPartnerPage("%_"), "/");

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("renders the landing for a valid code resolving a known partner", async () => {
    const chain = mockPartnerProfile({
      id: "partner-id",
      full_name: "Pacific Surf Company",
      display_name: "Pacific Surf Co",
      avatar_url: "https://example.com/shop.jpg",
    });

    const result = (await renderPartnerPage("surf12")) as ReactElement;

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("referral_code", "SURF12");
    expect(result.type).toBe(PartnerQrLandingClient);
    expect(result.props).toEqual(
      expect.objectContaining({
        partnerCode: "SURF12",
        partnerName: "Pacific Surf Co",
        qrUrl: `${SITE_URL}/p/SURF12?ref=SURF12&utm_source=partner_qr&utm_medium=partner_qr&utm_campaign=partner_access&utm_content=SURF12`,
        appSchemeUrl: "quiver://p/SURF12",
        startPath: "/?ref=SURF12&utm_source=partner_qr&utm_content=SURF12",
      }),
    );
  });

  it("still renders the landing for a valid code with no matching partner (best-effort attribution)", async () => {
    mockPartnerProfile(null);

    const result = (await renderPartnerPage("SURF12")) as ReactElement;

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result.type).toBe(PartnerQrLandingClient);
    expect(result.props).toEqual(
      expect.objectContaining({
        partnerCode: "SURF12",
        partnerName: null,
        qrUrl: `${SITE_URL}/p/SURF12?ref=SURF12&utm_source=partner_qr&utm_medium=partner_qr&utm_campaign=partner_access&utm_content=SURF12`,
        appSchemeUrl: "quiver://p/SURF12",
        startPath: "/?ref=SURF12&utm_source=partner_qr&utm_content=SURF12",
      }),
    );
  });
});
