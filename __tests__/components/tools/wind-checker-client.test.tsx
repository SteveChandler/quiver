import { render, screen } from "@testing-library/react";
import { WindCheckerClient } from "@/components/tools/wind-checker-client";
import type { WindCheckerData } from "@/actions/tools/wind-checker-actions";

jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("@/actions/tools/wind-checker-actions", () => ({ getWindCheckerData: jest.fn() }));
jest.mock("@/components/beach/beach-search-autocomplete", () => ({ BeachSearchAutocomplete: () => null }));
jest.mock("@/components/tools/tool-hero", () => ({ ToolHero: () => null }));
jest.mock("@/components/tools/tool-share-button", () => ({
  ToolShareButton: ({ shareText }: { shareText: string }) => <span data-testid="share">{shareText}</span>,
}));
jest.mock("@/components/tools/wind-forecast-chart", () => ({ WindForecastChart: () => null }));

const orientedBeach = {
  id: "beach-1",
  name: "Test Beach",
  slug: "test-beach",
  lat: 32.7,
  lon: -117.2,
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 30,
  aspect_deg: 270,
};

function data(
  point: { wind_speed_mph: number | null; wind_direction_deg: number | null },
  beach: Partial<WindCheckerData["beach"]> = {},
): WindCheckerData {
  return {
    beach: { ...orientedBeach, ...beach },
    wind: [{ ts: "2026-10-16T15:00:00Z", wind_gust_mph: null, ...point }],
    hasOrientationData: ("wind_offshore_deg" in beach ? beach.wind_offshore_deg : orientedBeach.wind_offshore_deg) != null,
  };
}

describe("WindCheckerClient missing wind", () => {
  it("labels a known wind against the beach", () => {
    render(<WindCheckerClient initialData={data({ wind_speed_mph: 8, wind_direction_deg: 90 })} />);

    expect(screen.getByText(/Wind quality/i)).toBeInTheDocument();
    expect(screen.getByTestId("share")).toHaveTextContent("Wind is offshore at Test Beach");
  });

  it("shows only the speed when the hour has no direction", () => {
    const { container } = render(
      <WindCheckerClient initialData={data({ wind_speed_mph: 12, wind_direction_deg: null })} />,
    );

    expect(screen.queryByText(/Wind quality/i)).not.toBeInTheDocument();
    // The colour legend stays (the beach has an orientation); no verdict for this hour.
    expect(container.textContent).not.toMatch(/blowing from|from the side|slight angle/i);
    expect(container.textContent).not.toMatch(/from the N\b/);
    expect(container.textContent).not.toMatch(/\b0°/);
    expect(screen.getByText(/Wind is 12 mph\./)).toBeInTheDocument();
    expect(screen.getByTestId("share")).toHaveTextContent("Check wind at Test Beach on Quiver");
  });

  it("makes no wind claim when the hour has no speed", () => {
    const { container } = render(
      <WindCheckerClient initialData={data({ wind_speed_mph: null, wind_direction_deg: 90 })} />,
    );

    expect(screen.queryByText(/Wind quality/i)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\b0 mph/);
    expect(screen.getByTestId("share")).toHaveTextContent("Check wind at Test Beach on Quiver");
  });

  it("gives a plain reading without a relation when the beach has no orientation", () => {
    const { container } = render(
      <WindCheckerClient
        initialData={data({ wind_speed_mph: 12, wind_direction_deg: 90 }, { wind_offshore_deg: null, aspect_deg: null })}
      />,
    );

    expect(screen.queryByText(/Wind quality/i)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Offshore — clean/);
    expect(screen.getByText(/Wind is 12 mph from the E\./)).toBeInTheDocument();
  });
});
