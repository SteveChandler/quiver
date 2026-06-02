import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AlertCaptureCta } from "@/components/seo/alert-capture-cta";

const mockTrack = jest.fn();
const mockSetPendingAction = jest.fn();
const mockTrackSignupCtaClick = jest.fn();
const mockTrackSignupCtaView = jest.fn();

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

jest.mock("@/hooks/use-pending-action", () => ({
  usePendingAction: () => ({ setPendingAction: mockSetPendingAction }),
}));

jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="auth-modal" /> : null,
}));

jest.mock("@/lib/analytics/signup-conversion-tracking", () => ({
  trackSignupCtaClick: (...args: unknown[]) => mockTrackSignupCtaClick(...args),
  trackSignupCtaView: (...args: unknown[]) => mockTrackSignupCtaView(...args),
}));

describe("AlertCaptureCta", () => {
  beforeEach(() => {
    mockTrack.mockClear();
    mockSetPendingAction.mockClear();
    mockTrackSignupCtaClick.mockClear();
    mockTrackSignupCtaView.mockClear();
  });

  it("tracks save-alert clicks with beach and preset context", async () => {
    const user = userEvent.setup();

    render(
      <AlertCaptureCta
        pageContext="dawn-patrol"
        beachId="beach-1"
        beachName="Ocean Beach"
        source="dawn-patrol-page"
      />
    );

    await user.click(
      screen.getByRole("button", { name: /set up dawn patrol alerts/i })
    );

    expect(mockTrack).toHaveBeenCalledWith("save_alert_clicked", {
      beachId: "beach-1",
      metadata: expect.objectContaining({
        surface: "seo_alert_capture_cta",
        page_context: "dawn-patrol",
        beach_id: "beach-1",
        beach_name: "Ocean Beach",
        source: "dawn-patrol-page",
        preset_types: ["dawn_patrol"],
      }),
      debounceMs: 0,
    });
    expect(mockSetPendingAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "alert",
        beachId: "beach-1",
        beachName: "Ocean Beach",
      })
    );
  });
});
