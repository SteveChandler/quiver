import React, { StrictMode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BeachReviewForm } from "@/components/beach/beach-review-form";

const mockTrack = jest.fn();
jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "test-user-id" } }),
}));
jest.mock("@/actions/beach-review-actions", () => ({
  createBeachReview: jest.fn(),
  updateBeachReview: jest.fn(),
}));

describe("BeachReviewForm abandon single-fire guard", () => {
  beforeEach(() => {
    mockTrack.mockClear();
  });

  it("fires exactly one review_form_abandon under StrictMode + cancel", () => {
    const onCancel = jest.fn();
    render(
      <StrictMode>
        <BeachReviewForm beachId="beach-1" beachName="Test Beach" onCancel={onCancel} />
      </StrictMode>
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    const abandonCalls = mockTrack.mock.calls.filter(
      ([eventType]) => eventType === "review_form_abandon"
    );
    expect(abandonCalls).toHaveLength(1);
    expect(abandonCalls[0][1].metadata.abandon_via).toBe("cancel_button");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("fires exactly one review_form_abandon under StrictMode + unmount", () => {
    const { unmount } = render(
      <StrictMode>
        <BeachReviewForm beachId="beach-1" beachName="Test Beach" />
      </StrictMode>
    );
    unmount();

    const abandonCalls = mockTrack.mock.calls.filter(
      ([eventType]) => eventType === "review_form_abandon"
    );
    expect(abandonCalls).toHaveLength(1);
    expect(abandonCalls[0][1].metadata.abandon_via).toBe("unmount");
  });
});
