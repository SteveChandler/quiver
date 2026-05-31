import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import PbscPage, { metadata } from "@/app/pbsc/page";

const mockHeadersGet = jest.fn();

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => ({
    get: mockHeadersGet,
  })),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    ...props
  }: Record<string, unknown>) => <img alt={String(alt)} {...props} />,
}));

jest.mock("@/components/app-store/ios-app-store-cta", () => ({
  IosAppStoreCta: ({
    children,
    source,
    surface,
    placement,
  }: {
    children: ReactNode;
    source: string;
    surface: string;
    placement: string;
  }) => (
    <a
      href="https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320"
      data-testid="ios-app-store-cta"
      data-source={source}
      data-surface={surface}
      data-placement={placement}
    >
      {children}
    </a>
  ),
}));

jest.mock("@/components/pricing/android-waitlist-cta", () => ({
  AndroidWaitlistCta: ({
    children,
    source,
    surface,
    placement,
    successLabel,
  }: {
    children: ReactNode;
    source: string;
    surface: string;
    placement: string;
    successLabel: string;
  }) => (
    <button
      type="button"
      data-testid="android-waitlist-cta"
      data-source={source}
      data-surface={surface}
      data-placement={placement}
      data-success-label={successLabel}
    >
      {children}
    </button>
  ),
}));

async function renderPbscPage(userAgent: string): Promise<void> {
  mockHeadersGet.mockReturnValue(userAgent);
  render(await PbscPage());
}

describe("PbscPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exports PBSC event metadata", () => {
    expect(metadata.title).toBe("Quiver at PBSC Summer Longboard Classic");
    expect(metadata.description).toBe(
      "Quiver turns every session into local knowledge, so the next call is always a little sharper.",
    );
  });

  it("renders site-first PBSC copy without stale scan-table handoff language", async () => {
    await renderPbscPage(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    expect(
      screen.getByText(
        /Quiver turns every session into local knowledge, so the next call is always a little sharper\./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Download Quiver, check the local call/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Scan at the sponsor table/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Event live link/i)).not.toBeInTheDocument();
  });

  it("renders tracked App Store CTAs for iOS visitors", async () => {
    await renderPbscPage(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    );

    const appStoreCtas = screen.getAllByTestId("ios-app-store-cta");
    expect(appStoreCtas).toHaveLength(2);
    expect(appStoreCtas[0]).toHaveAttribute(
      "data-source",
      "pbsc-event-app-store",
    );
    expect(appStoreCtas[0]).toHaveAttribute("data-surface", "pbsc-page");
    expect(appStoreCtas[0]).toHaveAttribute("data-placement", "hero_primary");
    expect(appStoreCtas[0]).toHaveTextContent(/open quiver on iphone/i);
    expect(screen.queryByTestId("android-waitlist-cta")).not.toBeInTheDocument();
    expect(screen.queryByText(/use quiver on web/i)).not.toBeInTheDocument();
  });

  it("renders tracked Android waitlist CTAs for non-iOS visitors", async () => {
    await renderPbscPage(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    );

    const waitlistCtas = screen.getAllByTestId("android-waitlist-cta");
    expect(waitlistCtas).toHaveLength(2);
    expect(waitlistCtas[0]).toHaveAttribute(
      "data-source",
      "pbsc-event-android-waitlist",
    );
    expect(waitlistCtas[0]).toHaveAttribute("data-surface", "pbsc-page");
    expect(waitlistCtas[0]).toHaveAttribute("data-placement", "hero_primary");
    expect(waitlistCtas[0]).toHaveAttribute(
      "data-success-label",
      "Android updates are set",
    );
    expect(waitlistCtas[0]).toHaveTextContent(/join android waitlist/i);
    expect(screen.queryByTestId("ios-app-store-cta")).not.toBeInTheDocument();
    expect(screen.queryByText(/use quiver on web/i)).not.toBeInTheDocument();
  });
});
