import { render, screen } from "@testing-library/react";
import { ZineAboutSpot } from "@/components/beach-detail/zine/zine-about-spot";
import type { Beach } from "@/types/database";

const BEACH = {
  id: "b1", name: "Tourmaline", skill_level: "beginner", break_type: "point",
  average_rating: 4.2, review_count: 12, best_conditions_prose: "Best on a small SW swell with morning glass.",
} as unknown as Beach;

describe("ZineAboutSpot", () => {
  it("keeps the editorial text and spot facts in the page", () => {
    render(<ZineAboutSpot beach={BEACH} open />);
    expect(screen.getByText("Best on a small SW swell with morning glass.")).toBeInTheDocument();
    expect(screen.getByText("BEGINNER")).toBeInTheDocument();
    expect(screen.getByText("POINT")).toBeInTheDocument();
    expect(screen.getByRole("group")).toHaveAttribute("open");
  });
});
