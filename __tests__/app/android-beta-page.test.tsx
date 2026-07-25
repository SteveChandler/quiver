import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AndroidBetaPage, { metadata } from "@/app/android-beta/page";
import {
  ANDROID_BETA_CONTACT_EMAIL,
  ANDROID_BETA_CONTACT_MAILTO,
  ANDROID_BETA_GROUP_URL,
  ANDROID_BETA_PLAY_URL,
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

jest.mock("@/lib/utils/visitor-id", () => ({
  getVisitorId: jest.fn(() => "00000000-0000-4000-8000-000000000001"),
}));

describe("AndroidBetaPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      ),
    );
  });

  it("exports Android beta metadata", () => {
    expect(metadata.title).toBe("Quiver Android Beta");
    expect(metadata.description).toMatch(/closed beta/i);
    expect(metadata.alternates?.canonical).toBe("/android-beta");
  });

  it("leads with current product value without promising a tester incentive", () => {
    const { container } = render(<AndroidBetaPage />);

    expect(
      screen.getByText(/personalized surf decisions/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/279\+ beaches/i)).toBeInTheDocument();
    expect(screen.getByText(/session logging/i)).toBeInTheDocument();
    expect(screen.getByText(/saved spots.*alerts/i)).toBeInTheDocument();
    expect(screen.getByText(/shape android quality/i)).toBeInTheDocument();

    const pageText = container.textContent ?? "";
    expect(pageText).not.toMatch(/free year|year of (?:quiver )?pro/i);
    expect(pageText).not.toMatch(/founding pric|queue priority|waitlist/i);
  });

  it("requires the Google account email before unlocking closed-beta handoff links", async () => {
    const user = userEvent.setup();
    render(<AndroidBetaPage />);

    expect(
      screen.getByRole("heading", { name: /join the quiver android beta/i }),
    ).toBeInTheDocument();
    const initialGroupLink = screen.getByRole("button", {
      name: /join the tester group/i,
    });
    const initialPlayLink = screen.getByRole("button", {
      name: /already joined.*open google play/i,
    });
    expect(
      screen.getByText(/^google account email — required for beta access$/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("android-beta-qr-locked")).toBeInTheDocument();

    await user.click(initialGroupLink);
    expect(global.fetch).not.toHaveBeenCalledWith(
      "/api/events",
      expect.anything(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /google account email.*unlock the beta handoff/i,
    );

    await user.type(
      screen.getByLabelText(/google account email.*required/i),
      "SURFER@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: /save email and unlock beta/i }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/android-beta/leads",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "surfer@example.com",
          sessionId: "00000000-0000-4000-8000-000000000001",
          source: "android_beta_page",
          surface: "android_beta",
          placement: "hero_email_capture",
        }),
      }),
    );

    const groupLink = await screen.findByRole("link", {
      name: /join the tester group/i,
    });
    expect(groupLink).toHaveAttribute("href", ANDROID_BETA_GROUP_URL);
    expect(screen.getByRole("status")).toHaveTextContent(
      /saved surfer@example\.com/i,
    );
    expect(screen.getByTestId("android-beta-qr")).toBeInTheDocument();
    expect(
      screen.queryByTestId("android-beta-qr-locked"),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /use a different email/i }),
    );
    expect(screen.getByTestId("android-beta-qr-locked")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /join the tester group/i }),
    ).toBeInTheDocument();
    const emailInput = screen.getByLabelText(/google account email.*required/i);
    expect(emailInput).toHaveValue("SURFER@example.com");

    jest.clearAllMocks();
    await user.clear(emailInput);
    await user.type(emailInput, "corrected@example.com");
    await user.click(
      screen.getByRole("button", { name: /save email and unlock beta/i }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/android-beta/leads",
      expect.objectContaining({
        body: JSON.stringify({
          email: "corrected@example.com",
          sessionId: "00000000-0000-4000-8000-000000000001",
          source: "android_beta_page",
          surface: "android_beta",
          placement: "hero_email_capture",
        }),
      }),
    );

    jest.clearAllMocks();
    const correctedGroupLink = await screen.findByRole("link", {
      name: /join the tester group/i,
    });
    await user.click(correctedGroupLink);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/events",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "cta_click",
          sessionId: "00000000-0000-4000-8000-000000000001",
          viewportWidth: window.innerWidth,
          metadata: {
            cta_family: "android_waitlist",
            platform: "android",
            source: "android_beta_page",
            surface: "android_beta",
            placement: "google_group",
            destination_type: "google_group",
            destination_status: "outbound",
          },
        }),
        keepalive: true,
      }),
    );

    const playLink = screen.getByRole("link", {
      name: /already joined.*open google play/i,
    });
    expect(playLink).toHaveAttribute("href", ANDROID_BETA_PLAY_URL ?? "");
    jest.clearAllMocks();
    await user.click(playLink);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/events",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "cta_click",
          sessionId: "00000000-0000-4000-8000-000000000001",
          viewportWidth: window.innerWidth,
          metadata: {
            cta_family: "android_waitlist",
            platform: "android",
            source: "android_beta_page",
            surface: "android_beta",
            placement: "google_play",
            destination_type: "google_play",
            destination_status: "outbound",
          },
        }),
        keepalive: true,
      }),
    );

    const emailLink = screen.getByRole("link", {
      name: new RegExp(`email ${ANDROID_BETA_CONTACT_EMAIL}`, "i"),
    });
    expect(emailLink).toHaveAttribute("href", ANDROID_BETA_CONTACT_MAILTO);

    const qr = screen.getByTestId("android-beta-qr");
    expect(qr).toHaveAttribute("height", "248");
    expect(qr).toHaveAttribute("width", "248");
    const qrValue = qr.getAttribute("data-value") ?? "";
    const parsedQr = new URL(qrValue);
    expect(parsedQr.pathname).toBe("/app/handoff");
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
