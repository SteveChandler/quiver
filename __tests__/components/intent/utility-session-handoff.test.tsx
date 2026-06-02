import { render, screen, within } from "@testing-library/react";
import { UtilitySessionHandoff } from "@/components/intent/utility-session-handoff";

const baseProps = {
  cityName: "Santa Cruz",
  citySlug: "santa-cruz",
  stateSlug: "ca",
  bestTimeToSurfUrl: "/best-time-to-surf/santa-cruz",
};

describe("UtilitySessionHandoff", () => {
  it.each([
    {
      intent: "tide" as const,
      heading: /turn the tide chart into a surf call/i,
      copy: /tide/i,
      companionLabel: /check water temperature/i,
      companionHref: "/water-temp/santa-cruz",
      sticker: "/images/quiver-stickers/spot-tide-window.png",
    },
    {
      intent: "water-temp" as const,
      heading: /use water temperature to pick gear/i,
      copy: /wetsuit/i,
      companionLabel: /watch the tide window/i,
      companionHref: "/tide/santa-cruz",
      sticker: "/images/quiver-stickers/spot-water-temp.png",
    },
    {
      intent: "dawn-patrol" as const,
      heading: /pair first light with live conditions/i,
      copy: /dawn/i,
      companionLabel: /watch the tide window/i,
      companionHref: "/tide/santa-cruz",
      sticker: "/images/quiver-stickers/spot-wind-read.png",
    },
    {
      intent: "sunset" as const,
      heading: /pair golden hour with live conditions/i,
      copy: /sunset/i,
      companionLabel: /watch the tide window/i,
      companionHref: "/tide/santa-cruz",
      sticker: "/images/quiver-stickers/orange-right-arrow.png",
    },
  ])(
    "renders crawlable utility handoff links for $intent",
    ({ companionHref, companionLabel, copy, heading, intent, sticker }) => {
      render(<UtilitySessionHandoff {...baseProps} intent={intent} />);

      const region = screen.getByRole("region", { name: heading });
      const links = within(region).getAllByRole("link");

      expect(links.length).toBeGreaterThanOrEqual(3);
      expect(within(region).getAllByText(copy).length).toBeGreaterThan(0);
      expect(
        within(region).getByRole("link", {
          name: /open live santa cruz conditions/i,
        })
      ).toHaveAttribute("href", "/ca/santa-cruz");
      expect(
        within(region).getByRole("link", { name: companionLabel })
      ).toHaveAttribute("href", companionHref);
      expect(
        within(region).getByRole("link", {
          name: /compare seasonal windows/i,
        })
      ).toHaveAttribute("href", "/best-time-to-surf/santa-cruz");
      expect(within(region).getByAltText("")).toHaveAttribute(
        "src",
        expect.stringContaining(sticker)
      );
    }
  );

  it("keeps water-temp heading out of surf-report retargeting", () => {
    render(<UtilitySessionHandoff {...baseProps} intent="water-temp" />);

    const heading = screen.getByRole("heading", {
      name: /use water temperature to pick gear/i,
    });

    expect(heading).toBeVisible();
    expect(heading).not.toHaveTextContent(/surf report/i);
  });
});
