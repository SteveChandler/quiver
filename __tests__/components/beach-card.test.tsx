import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BeachCard } from "@/components/beach-card";

describe("BeachCard", () => {
  const defaultProps = {
    id: "1",
    name: "Ocean Beach",
    distance: "1 mi",
    rating: 4.5,
    reviewCount: 100,
    imageUrl: "/test.jpg",
  };

  it("toggles aria-expanded when expand button is clicked", async () => {
    const user = userEvent.setup();
    render(<BeachCard {...defaultProps} />);

    const toggle = screen.getByRole("button", { name: /expand details/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Collapse details");
  });
});
