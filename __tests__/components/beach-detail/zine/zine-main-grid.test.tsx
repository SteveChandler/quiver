import { render, screen } from "@testing-library/react";
import { ZineMainGrid } from "@/components/beach-detail/zine/zine-main-grid";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";

describe("ZineMainGrid About this spot", () => {
  it("captions a beach photo with no made-up reef or tide label", () => {
    render(
      <ZineMainGrid
        beach={createMockBeach({ name: "Swamis", break_type: "point" })}
        beachPhoto={{ image_url: "https://example.com/swamis.jpg" } as never}
      />,
    );

    expect(screen.queryByText(/REEF · LOW TIDE/)).toBeNull();
    expect(screen.queryByAltText("Swamis reef")).toBeNull();
  });

  it("leaves out the tide clause when the tide direction is unknown, not \"select\"", () => {
    const { container } = render(
      <ZineMainGrid
        beach={createMockBeach({
          name: "Swamis",
          best_conditions_prose: null,
          break_type: "point",
          preferred_tide_direction: null,
          preferred_tide_ft_min: 1,
          preferred_tide_ft_max: 3,
        })}
      />,
    );

    expect(container).not.toHaveTextContent(/select tide/);
    expect(container).toHaveTextContent("Swamis is a point.");
  });

  it("keeps the tide clause when the direction is known", () => {
    const { container } = render(
      <ZineMainGrid
        beach={createMockBeach({
          name: "Swamis",
          best_conditions_prose: null,
          break_type: "point",
          preferred_tide_direction: "rising",
          preferred_tide_ft_min: 1,
          preferred_tide_ft_max: 3,
        })}
      />,
    );

    expect(container).toHaveTextContent("works best on rising tide at 1–3 ft");
  });
});
