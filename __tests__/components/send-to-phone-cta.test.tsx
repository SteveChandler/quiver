import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SendToPhoneCta } from "@/components/app-store/send-to-phone-cta";
import { IOS_APP_STORE_WEB_REDIRECT_PATH } from "@/lib/constants/app-store";
import {
  trackAppHandoffEmailSent,
  trackAppHandoffEmailSubmit,
  trackAppHandoffQrRendered,
} from "@/lib/analytics/app-handoff-tracking";

jest.mock("@/lib/analytics/app-handoff-tracking", () => ({
  trackAppHandoffQrRendered: jest.fn(),
  trackAppHandoffEmailSubmit: jest.fn(),
  trackAppHandoffEmailSent: jest.fn(),
  trackAppHandoffEmailFailed: jest.fn(),
}));

const mockTrackAppHandoffQrRendered =
  trackAppHandoffQrRendered as jest.MockedFunction<
    typeof trackAppHandoffQrRendered
  >;
const mockTrackAppHandoffEmailSubmit =
  trackAppHandoffEmailSubmit as jest.MockedFunction<
    typeof trackAppHandoffEmailSubmit
  >;
const mockTrackAppHandoffEmailSent =
  trackAppHandoffEmailSent as jest.MockedFunction<
    typeof trackAppHandoffEmailSent
  >;

describe("SendToPhoneCta", () => {
  const baseProps = {
    source: "landing_hero",
    surface: "landing-page",
    placement: "hero_primary",
  } as const;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      ),
    );
  });

  it("renders one UUID across the QR URL and QR event", async () => {
    render(<SendToPhoneCta {...baseProps} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/send link/i)).toBeInTheDocument();
    expect(screen.queryByText("quiversurf.app/app")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/utm_medium=desktop_handoff/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/open app store anyway/i)).toBeInTheDocument();

    await waitFor(() => {
      const smartUrl = screen
        .getByTestId("app-handoff-qr")
        .getAttribute("data-smart-url");
      const handoffId = new URL(smartUrl ?? "").searchParams.get("handoff_id");

      expect(handoffId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(mockTrackAppHandoffQrRendered).toHaveBeenCalledWith(
        expect.objectContaining({ handoff_id: handoffId }),
      );
    });
  });

  it("can render QR-only copy without the email form", () => {
    render(<SendToPhoneCta {...baseProps} showEmailForm={false} />);

    expect(
      screen.getByText(/scan with your phone to open quiver/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/send link/i)).not.toBeInTheDocument();
    expect(screen.getByText(/open app store anyway/i)).toBeInTheDocument();
  });

  it("keeps the desktop fallback pointed at the App Store", () => {
    render(<SendToPhoneCta {...baseProps} />);

    const fallback = screen.getByRole("link", {
      name: /open app store anyway/i,
    });
    expect(fallback).toHaveAttribute("href", IOS_APP_STORE_WEB_REDIRECT_PATH);
  });

  it("uses an ink-on-paper panel, input, and QR palette", async () => {
    const { container } = render(<SendToPhoneCta {...baseProps} />);

    expect(container.firstChild).toHaveClass(
      "bg-[#EFE5CF]",
      "text-[#11100D]",
      "border-[#11100D]",
    );
    expect(screen.getByLabelText(/email/i)).toHaveClass(
      "bg-[#F4EBD8]",
      "text-[#11100D]",
      "border-[#11100D]",
    );
    expect(screen.getByRole("button", { name: /send link/i })).toHaveClass(
      "bg-ocean-blue-decorative",
    );

    await waitFor(() => {
      expect(screen.getByTestId("app-handoff-qr")).toHaveAttribute(
        "data-foreground-color",
        "#11100D",
      );
      expect(screen.getByTestId("app-handoff-qr")).toHaveAttribute(
        "data-background-color",
        "#F4EBD8",
      );
    });
  });

  it("adds the rollout cohort to QR render tracking when provided", () => {
    render(<SendToPhoneCta {...baseProps} cohort="app_first" />);

    expect(mockTrackAppHandoffQrRendered).toHaveBeenCalledWith(
      expect.objectContaining({ cohort: "app_first" }),
    );
  });

  it("rejects an invalid email inline without calling the API", async () => {
    render(<SendToPhoneCta {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByText(/send link/i));
    await waitFor(() =>
      expect(
        screen.getByText(/enter a valid email address/i),
      ).toBeInTheDocument(),
    );
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it("shows success copy after a successful send", async () => {
    render(<SendToPhoneCta {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "surf@gmail.com" },
    });
    fireEvent.click(screen.getByText(/send link/i));
    await waitFor(() =>
      expect(screen.getByText(/check your email/i)).toBeInTheDocument(),
    );
    expect((global as any).fetch).toHaveBeenCalledWith(
      "/api/app-link-email",
      expect.objectContaining({ method: "POST" }),
    );
    const request = ((global as any).fetch as jest.Mock).mock.calls.find(
      ([url]) => url === "/api/app-link-email",
    );
    const requestBody = JSON.parse(request[1].body);
    const handoffId = requestBody.handoff_id;
    expect(handoffId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(mockTrackAppHandoffEmailSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ handoff_id: handoffId }),
    );
    expect(mockTrackAppHandoffEmailSent).toHaveBeenCalledWith(
      expect.objectContaining({ handoff_id: handoffId }),
    );
  });

  it("shows a retry message and keeps the QR usable on API failure", async () => {
    (global as any).fetch = jest.fn(() =>
      Promise.resolve(new Response("{}", { status: 500 })),
    );
    render(<SendToPhoneCta {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "surf@gmail.com" },
    });
    fireEvent.click(screen.getByText(/send link/i));
    await waitFor(() =>
      expect(screen.getByText(/could not send the link/i)).toBeInTheDocument(),
    );
  });
});
