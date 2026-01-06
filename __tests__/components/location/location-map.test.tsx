import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LocationMap } from "@/components/location/location-map";

const pushMock = jest.fn();
let beachToClick: any = null;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Avoid Mapbox + heavy map rendering in unit tests; we only care about the click URL.
jest.mock("@/components/map/interactive-map", () => ({
  InteractiveMap: (props: { onLocationClick: (beach: any) => void }) => {
    return (
      <button
        type="button"
        onClick={() => props.onLocationClick(beachToClick)}
      >
        Click beach marker
      </button>
    );
  },
}));

describe("LocationMap", () => {
  beforeEach(() => {
    pushMock.mockClear();
    beachToClick = null;
  });

  it("routes map clicks to the hierarchical beach URL", async () => {
    const user = userEvent.setup();
    beachToClick = {
      id: "beach-123",
      name: "Blacks",
      slug: "blacks",
      city: "La Jolla",
      state: "CA",
      country: "USA",
    };
    render(
      <LocationMap
        beaches={[{ id: "row-1", lat: 32.8, lon: -117.2 } as any]}
        city="La Jolla"
        state="CA"
      />
    );

    await user.click(screen.getByRole("button", { name: "Click beach marker" }));
    expect(pushMock).toHaveBeenCalledWith("/ca/la-jolla/blacks");
  });

  it("falls back to /beach/{id} when the beach has no slug", async () => {
    const user = userEvent.setup();
    beachToClick = {
      id: "beach-999",
      name: "Unknown",
      slug: null,
      city: null,
      state: null,
      country: null,
    };

    render(
      <LocationMap
        beaches={[{ id: "row-1", lat: 32.8, lon: -117.2 } as any]}
        city="La Jolla"
        state="CA"
      />
    );

    await user.click(screen.getByRole("button", { name: "Click beach marker" }));
    expect(pushMock).toHaveBeenCalledWith("/beach/beach-999");
  });
});


