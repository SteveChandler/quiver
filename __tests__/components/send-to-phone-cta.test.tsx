import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SendToPhoneCta } from "@/components/app-store/send-to-phone-cta";
import { trackAppHandoffQrRendered } from "@/lib/analytics/app-handoff-tracking";

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

  it("renders a labeled email input and a QR with a /app target", () => {
    render(<SendToPhoneCta {...baseProps} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/send link/i)).toBeInTheDocument();
    expect(screen.getByText(/open app store anyway/i)).toBeInTheDocument();
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
