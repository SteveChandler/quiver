import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { IphoneAppBanner } from "@/components/app-store/iphone-app-banner";
import { track } from "@/lib/analytics";
import { IPHONE_APP_BANNER_DISMISSAL_STORAGE_KEY } from "@/lib/app-store/iphone-app-banner";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_DESTINATION_STATUS,
  IOS_APP_STORE_WEB_REDIRECT_PATH,
} from "@/lib/constants/app-store";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

const IPHONE_CHROME_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1";
const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
}

function setStandalone(value: boolean): void {
  Object.defineProperty(window.navigator, "standalone", {
    value,
    configurable: true,
  });
}

describe("IphoneAppBanner", () => {
  const mockedUsePathname = usePathname as jest.Mock;
  const mockedTrack = track as jest.Mock;

  beforeEach(() => {
    mockedUsePathname.mockReturnValue("/map");
    mockedTrack.mockClear();
    window.localStorage.clear();
    setUserAgent(IPHONE_CHROME_UA);
    setStandalone(false);
  });

  it("renders for eligible iPhone Chrome visitors and tracks eligibility plus view", async () => {
    render(<IphoneAppBanner />);

    expect(await screen.findByTestId("iphone-app-banner")).toBeInTheDocument();
    expect(screen.getByText("Quiver for iPhone")).toBeInTheDocument();
    expect(screen.getByText(IOS_APP_STORE_CTA)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedTrack).toHaveBeenCalledWith(
        "iphone_app_banner_eligible",
        expect.objectContaining({
          source: "iphone-app-banner",
          platform: "ios",
          cta_family: "ios_app",
          cta_text: IOS_APP_STORE_CTA,
          destination_type: "app_store",
          destination_status: IOS_APP_STORE_DESTINATION_STATUS,
          destination_url: IOS_APP_STORE_WEB_REDIRECT_PATH,
          browser: "chrome_ios",
          pathname: "/map",
        }),
      );
      expect(mockedTrack).toHaveBeenCalledWith(
        "iphone_app_banner_view",
        expect.objectContaining({
          browser: "chrome_ios",
          pathname: "/map",
        }),
      );
    });
  });

  it("tracks click and points to the App Store listing", async () => {
    render(<IphoneAppBanner />);

    const cta = await screen.findByRole("link", {
      name: IOS_APP_STORE_CTA,
    });
    expect(cta).toHaveAttribute("href", IOS_APP_STORE_WEB_REDIRECT_PATH);

    fireEvent.click(cta);

    expect(mockedTrack).toHaveBeenCalledWith(
      "iphone_app_banner_click",
      expect.objectContaining({
        browser: "chrome_ios",
        pathname: "/map",
        cta_text: IOS_APP_STORE_CTA,
        destination_status: IOS_APP_STORE_DESTINATION_STATUS,
        destination_url: IOS_APP_STORE_WEB_REDIRECT_PATH,
      }),
    );
  });

  it("dismisses for 14 days and tracks dismissal", async () => {
    render(<IphoneAppBanner />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Dismiss iPhone app banner",
      }),
    );

    expect(screen.queryByTestId("iphone-app-banner")).not.toBeInTheDocument();
    expect(
      window.localStorage.getItem(IPHONE_APP_BANNER_DISMISSAL_STORAGE_KEY),
    ).not.toBeNull();
    expect(mockedTrack).toHaveBeenCalledWith(
      "iphone_app_banner_dismiss",
      expect.objectContaining({
        browser: "chrome_ios",
        pathname: "/map",
      }),
    );
  });

  it("suppresses Safari custom UI and tracks native banner suppression", async () => {
    setUserAgent(IPHONE_SAFARI_UA);

    render(<IphoneAppBanner />);

    await waitFor(() => {
      expect(screen.queryByTestId("iphone-app-banner")).not.toBeInTheDocument();
      expect(mockedTrack).toHaveBeenCalledWith(
        "iphone_app_banner_eligible",
        expect.objectContaining({
          browser: "safari",
          pathname: "/map",
        }),
      );
      expect(mockedTrack).toHaveBeenCalledWith(
        "iphone_app_banner_suppressed",
        expect.objectContaining({
          browser: "safari",
          pathname: "/map",
          suppression_reason: "safari_native_banner",
        }),
      );
    });
  });

  it("does not render on excluded routes", async () => {
    mockedUsePathname.mockReturnValue("/");

    render(<IphoneAppBanner />);

    await waitFor(() => {
      expect(screen.queryByTestId("iphone-app-banner")).not.toBeInTheDocument();
      expect(mockedTrack).toHaveBeenCalledWith(
        "iphone_app_banner_suppressed",
        expect.objectContaining({
          suppression_reason: "excluded_route",
          pathname: "/",
        }),
      );
    });
  });
});
