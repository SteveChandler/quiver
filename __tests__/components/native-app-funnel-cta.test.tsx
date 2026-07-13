import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { NativeAppFunnelCta } from "@/components/app-store/native-app-funnel-cta";

jest.mock("@/components/app-store/ios-app-store-cta", () => ({
  IosAppStoreCta: ({ children }: { children: ReactNode }) => (
    <a data-testid="ios-cta">{children}</a>
  ),
}));
jest.mock("@/components/pricing/android-waitlist-cta", () => ({
  AndroidWaitlistCta: ({ children }: { children: ReactNode }) => (
    <button data-testid="android-cta">{children}</button>
  ),
}));
jest.mock("@/components/app-store/send-to-phone-cta", () => ({
  SendToPhoneCta: () => <div data-testid="send-to-phone" />,
}));

describe("NativeAppFunnelCta", () => {
  const base = {
    source: "landing_hero",
    surface: "landing-page",
    placement: "hero_primary",
  } as const;

  it("renders the App Store CTA on iOS", () => {
    render(<NativeAppFunnelCta platform="ios" {...base} />);
    expect(screen.getByTestId("ios-cta")).toBeInTheDocument();
  });

  it("renders the Android beta CTA on Android", () => {
    render(<NativeAppFunnelCta platform="android" {...base} />);
    expect(screen.getByTestId("android-cta")).toBeInTheDocument();
  });

  it("renders send-to-phone on desktop", () => {
    render(<NativeAppFunnelCta platform="desktop" {...base} />);
    expect(screen.getByTestId("send-to-phone")).toBeInTheDocument();
  });
});
