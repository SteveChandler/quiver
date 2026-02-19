import { render, screen, fireEvent } from "@testing-library/react";
import { SelectedBeachCard } from "@/components/map/selected-beach-card";

jest.mock("@/hooks/use-forecast-preview", () => ({
  useForecastPreview: () => ({
    forecastPreview: null,
    loading: false,
    error: null,
  }),
}));

describe("SelectedBeachCard", () => {
  const beach = {
    id: "beach-1",
    slug: "blacks-beach",
    name: "Blacks Beach",
    city: "San Diego",
    state: "CA",
    lat: 32.89,
    lon: -117.25,
    review_count: 12,
    average_rating: 4.4,
  } as any;

  it("renders a native link that points to the beach detail page", () => {
    render(
      <SelectedBeachCard
        selectedBeach={beach}
        getDistanceFromUser={() => "1.2 mi away"}
        userLocation={{ lat: 32.88, lon: -117.24 }}
      />
    );

    const link = screen.getByRole("link", {
      name: /view details for blacks beach/i,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/ca/san-diego/blacks-beach");
  });

  it("calls onClose and does not navigate when X button is clicked", () => {
    const onClose = jest.fn();
    render(
      <SelectedBeachCard
        selectedBeach={beach}
        getDistanceFromUser={() => "1.2 mi away"}
        userLocation={{ lat: 32.88, lon: -117.24 }}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByLabelText("Deselect beach");
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders a fallback link when slug/city/state are missing", () => {
    render(
      <SelectedBeachCard
        selectedBeach={{ ...beach, slug: null, city: null, state: null }}
        getDistanceFromUser={() => ""}
        userLocation={null}
      />
    );

    const link = screen.getByRole("link", {
      name: /view details for/i,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/beach/beach-1");
  });

  // Bug 4: Close button touch target must be at least 44px (WCAG)
  it("close button has WCAG-compliant 44px minimum touch target", () => {
    const onClose = jest.fn();
    render(
      <SelectedBeachCard
        selectedBeach={beach}
        getDistanceFromUser={() => "1.2 mi away"}
        userLocation={{ lat: 32.88, lon: -117.24 }}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByLabelText("Deselect beach");
    expect(closeButton).toHaveClass("min-w-[44px]");
    expect(closeButton).toHaveClass("min-h-[44px]");
  });

  it("close button has active state for touch feedback", () => {
    const onClose = jest.fn();
    render(
      <SelectedBeachCard
        selectedBeach={beach}
        getDistanceFromUser={() => "1.2 mi away"}
        userLocation={{ lat: 32.88, lon: -117.24 }}
        onClose={onClose}
      />
    );

    const closeButton = screen.getByLabelText("Deselect beach");
    expect(closeButton).toHaveClass("active:bg-muted/80");
  });

  // Bug 10: Icon container should be hidden on mobile
  it("icon container is hidden on mobile and visible on sm+", () => {
    render(
      <SelectedBeachCard
        selectedBeach={beach}
        getDistanceFromUser={() => "1.2 mi away"}
        userLocation={{ lat: 32.88, lon: -117.24 }}
      />
    );

    // The icon container wrapping the large MapPin
    const iconContainer = screen.getByTestId("beach-icon-container");
    expect(iconContainer).toHaveClass("hidden");
    expect(iconContainer).toHaveClass("sm:flex");
  });
});
