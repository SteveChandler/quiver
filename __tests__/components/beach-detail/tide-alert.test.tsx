import { render, screen } from "@testing-library/react";
import { TideAlertBadge } from "@/components/beach-detail/tide-alert";

describe("TideAlertBadge", () => {
  it("uses high-contrast styling for waiting alerts", () => {
    render(
      <TideAlertBadge
        alert={{
          status: "waiting",
          message: "Better in 3h (falling tide)",
        }}
      />
    );

    const badge = screen.getByText("Better in 3h (falling tide)").closest("div");

    expect(badge).toHaveClass("bg-amber-100");
    expect(badge).toHaveClass("border-amber-300");
    expect(badge).toHaveClass("text-amber-900");
    expect(badge).toHaveClass("font-bold");
  });
});
