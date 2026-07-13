/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
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

jest.mock("qrcode.react", () => ({
  QRCodeSVG: ({
    value,
    "data-testid": dataTestId,
  }: {
    value: string;
    "data-testid"?: string;
  }) => <svg data-testid={dataTestId} data-value={value} />,
}));

import PartnerFlyerPage, { metadata } from "@/app/p/[partnerCode]/flyer/page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SITE_URL = "https://www.quiversurf.app";

function renderPartnerFlyerPage(partnerCode: string) {
  return PartnerFlyerPage({ params: Promise.resolve({ partnerCode }) });
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

describe("/p/[partnerCode]/flyer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = SITE_URL;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("is noindexed for operator print views", () => {
    expect(metadata.robots && typeof metadata.robots === "object").toBe(true);
    expect((metadata.robots as any).index).toBe(false);
    expect((metadata.robots as any).follow).toBe(false);
  });

  it("renders a print flyer with the shop label and canonical partner QR", async () => {
    const chain = mockPartnerProfile({
      id: "partner-id",
      full_name: "Pacific Surf Company",
      display_name: "Pacific Surf Co",
      avatar_url: "https://example.com/shop.jpg",
    });

    render(await renderPartnerFlyerPage("surf12"));

    expect(chain.eq).toHaveBeenCalledWith("referral_code", "SURF12");
    expect(
      screen.getByRole("heading", { name: /scan for the surf call/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Pacific Surf Co/i)).toBeInTheDocument();

    const qr = screen.getByTestId("partner-flyer-qr");
    expect(qr).toHaveAttribute(
      "data-value",
      `${SITE_URL}/p/SURF12?ref=SURF12&utm_source=partner_qr&utm_medium=partner_qr&utm_campaign=partner_access&utm_content=SURF12`,
    );
  });

  it("redirects invalid partner codes without querying the DB", async () => {
    await expectRedirect(renderPartnerFlyerPage("ab"), "/");

    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
