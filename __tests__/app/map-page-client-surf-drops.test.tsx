import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MapPageClient } from "@/app/map/map-page-client";

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    const DynamicMock = ({
      layerControls,
      onPlacementPinChange,
      placementActive,
      placementPin,
    }: {
      layerControls?: React.ReactNode;
      onPlacementPinChange?: (pin: { lat: number; lon: number }) => void;
      placementActive?: boolean;
      placementPin?: { lat: number; lon: number } | null;
    }) => (
      <div
        data-testid="mock-map-view"
        data-placement-active={String(placementActive)}
        data-placement-pin={placementPin ? `${placementPin.lat},${placementPin.lon}` : ""}
      >
        {layerControls}
        <button
          type="button"
          data-testid="mock-place-drop-pin"
          onClick={() => onPlacementPinChange?.({ lat: 32.7489, lon: -117.2532 })}
        >
          place pin
        </button>
      </div>
    );
    DynamicMock.displayName = "DynamicMock";
    return DynamicMock;
  },
}));

jest.mock("@/context/auth-context", () => ({
  useOptionalAuth: () => ({ user: { id: "user-1" } }),
}));

jest.mock("@/components/map/surf-drops-layer", () => ({
  SurfDropsLayer: () => <div data-testid="mock-surf-drops-layer" />,
}));

jest.mock("@/components/map/amenities-layer", () => ({
  AmenitiesLayer: () => <div data-testid="mock-amenities-layer" />,
}));

jest.mock("@/components/surf-drops/create-drop-sheet", () => ({
  CreateDropSheet: ({
    open,
    onCreated,
    customPin,
    defaultMode,
  }: {
    open: boolean;
    onCreated: (result: { id: string; share_slug: string }) => void;
    customPin?: { lat: number; lon: number; label?: string | null } | null;
    defaultMode?: string;
  }) => open ? (
    <button
      type="button"
      data-testid="mock-create-drop-success"
      data-custom-pin={customPin ? `${customPin.lat},${customPin.lon}` : ""}
      data-default-mode={defaultMode ?? ""}
      onClick={() =>
        onCreated({
          id: "11111111-2222-3333-4444-555555555555",
          share_slug: "A2K7N9PQRS",
        })
      }
    >
      create success
    </button>
  ) : null,
}));

describe("MapPageClient Surf Drops integration", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { venues: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("links the created-drop toast to the drop id, not the share slug", async () => {
    render(<MapPageClient />);

    fireEvent.click(screen.getByTestId("drop-a-spot-fab"));
    expect(screen.getByTestId("drop-placement-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-create-drop-success")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-place-drop-pin"));
    fireEvent.click(screen.getByTestId("drop-placement-confirm"));

    expect(screen.getByTestId("mock-create-drop-success")).toHaveAttribute(
      "data-default-mode",
      "custom_pin",
    );
    expect(screen.getByTestId("mock-create-drop-success")).toHaveAttribute(
      "data-custom-pin",
      "32.7489,-117.2532",
    );
    fireEvent.click(screen.getByTestId("mock-create-drop-success"));

    const toastLink = await screen.findByRole("link", { name: "View" });
    expect(toastLink).toHaveAttribute(
      "href",
      "/drops/11111111-2222-3333-4444-555555555555",
    );
    expect(toastLink).not.toHaveAttribute("href", "/drops/A2K7N9PQRS");

    await waitFor(() => {
      expect(screen.getByTestId("mock-surf-drops-layer")).toBeInTheDocument();
    });
  });

  it("renders one embedded layer legend inside the map surface", () => {
    render(<MapPageClient />);

    expect(screen.getAllByTestId("layer-legend")).toHaveLength(1);
    expect(screen.getByTestId("mock-map-view")).toContainElement(
      screen.getByTestId("layer-legend"),
    );
  });
});
