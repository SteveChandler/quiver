import { render, screen } from "@testing-library/react";

import AndroidBetaPage, { metadata } from "@/app/android-beta/page";
import {
  ANDROID_BETA_CONTACT_EMAIL,
  ANDROID_BETA_CONTACT_MAILTO,
  ANDROID_BETA_GROUP_URL,
} from "@/lib/constants/app-store";

jest.mock("qrcode.react", () => ({
  QRCodeSVG: ({
    value,
    "data-testid": dataTestId,
  }: {
    value: string;
    "data-testid"?: string;
  }) => (
    <svg data-testid={dataTestId} data-value={value} height="248" width="248" />
  ),
}));

describe("AndroidBetaPage", () => {
  it("exports Android beta metadata", () => {
    expect(metadata.title).toBe("Quiver Android Beta");
    expect(metadata.description).toMatch(/closed beta/i);
    expect(metadata.alternates?.canonical).toBe("/android-beta");
  });

  it("renders the closed-beta instructions and QR destination", () => {
    render(<AndroidBetaPage />);

    expect(
      screen.getByRole("heading", { name: /join the quiver android beta/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/the closed-test install link is not public on this page yet/i),
    ).toBeInTheDocument();

    const groupLink = screen.getByRole("link", {
      name: /join the tester group/i,
    });
    expect(groupLink).toHaveAttribute("href", ANDROID_BETA_GROUP_URL);

    const emailLink = screen.getByRole("link", {
      name: new RegExp(`email ${ANDROID_BETA_CONTACT_EMAIL}`, "i"),
    });
    expect(emailLink).toHaveAttribute("href", ANDROID_BETA_CONTACT_MAILTO);

    const qr = screen.getByTestId("android-beta-qr");
    expect(qr).toHaveAttribute("height", "248");
    expect(qr).toHaveAttribute("width", "248");
    const qrValue = qr.getAttribute("data-value") ?? "";
    const parsedQr = new URL(qrValue);
    expect(parsedQr.pathname).toBe("/app");
    expect(parsedQr.searchParams.get("source")).toBe("android_beta_page");
    expect(parsedQr.searchParams.get("surface")).toBe("android_beta");
    expect(parsedQr.searchParams.get("placement")).toBe("instructions_qr");
    expect(parsedQr.searchParams.get("qr_id")).toBe(
      "android_beta_instructions",
    );
    expect(parsedQr.searchParams.get("target")).toBe("android_beta");
    expect(parsedQr.searchParams.get("utm_source")).toBe("qr");

    expect(screen.queryByText(/testflight/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/join the ios beta/i)).not.toBeInTheDocument();
  });
});
