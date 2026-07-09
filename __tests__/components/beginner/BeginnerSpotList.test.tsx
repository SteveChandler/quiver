import { render, screen } from "@testing-library/react";
import { BeginnerSpotList } from "@/components/beginner/BeginnerSpotList";
import type { BeginnerBeachWithEditorial } from "@/types/beginner";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, ...props }: { alt: string }) => <img alt={alt} {...props} />,
}));

function makeBeach(
  overrides: Partial<BeginnerBeachWithEditorial> = {},
): BeginnerBeachWithEditorial {
  return {
    id: "beach-1",
    name: "Cocoa Beach Pier",
    slug: "cocoa-beach-pier",
    city: "Cape Canaveral",
    state: "FL",
    rating: 4.5,
    reviewCount: 12,
    skillLevel: "beginner",
    breakType: "beach",
    currentWaveHeight: "1-2 ft",
    editorial: null,
    photoUrl: null,
    ...overrides,
  };
}

describe("BeginnerSpotList", () => {
  it("links spots with buildBeachUrl-compatible beach location data", () => {
    render(
      <BeginnerSpotList
        cityName="Cocoa Beach"
        stateSlug="fl"
        citySlug="cocoa-beach"
        beaches={[makeBeach()]}
      />,
    );

    const link = screen.getByRole("link", { name: "Cocoa Beach Pier" });
    expect(link).toHaveAttribute(
      "href",
      "/fl/cape-canaveral/cocoa-beach-pier",
    );
    expect(link).not.toHaveAttribute(
      "href",
      "/fl/cocoa-beach/cocoa-beach-pier",
    );
  });
});
