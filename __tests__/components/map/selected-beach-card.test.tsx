import { render, screen, fireEvent } from "@testing-library/react";
import { SelectedBeachCard } from "@/components/map/selected-beach-card";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

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

  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders a tappable card that navigates via router.push", () => {
    render(
      <SelectedBeachCard
        selectedBeach={beach}
        getDistanceFromUser={() => "1.2 mi away"}
        userLocation={{ lat: 32.88, lon: -117.24 }}
      />
    );

    const card = screen.getByRole("link", {
      name: /view details for blacks beach/i,
    });
    expect(card).toBeInTheDocument();

    fireEvent.click(card);
    expect(mockPush).toHaveBeenCalledWith("/ca/san-diego/blacks-beach");
  });

  it("navigates on Enter key press", () => {
    render(
      <SelectedBeachCard
        selectedBeach={beach}
        getDistanceFromUser={() => "1.2 mi away"}
        userLocation={{ lat: 32.88, lon: -117.24 }}
      />
    );

    const card = screen.getByRole("link", {
      name: /view details for blacks beach/i,
    });
    fireEvent.keyDown(card, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/ca/san-diego/blacks-beach");
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
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not render a link when no valid beach URL exists", () => {
    render(
      <SelectedBeachCard
        selectedBeach={{ ...beach, slug: null, city: null, state: null }}
        getDistanceFromUser={() => ""}
        userLocation={null}
      />
    );

    expect(
      screen.queryByRole("link", { name: /view details for/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/view details/i)).toBeInTheDocument();
  });
});
