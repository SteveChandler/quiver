import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MapPageClient } from "@/app/map/map-page-client";
import type { CreateDropSheetSuccess } from "@/components/surf-drops/create-drop-sheet";
import type { SurfDropInView } from "@/hooks/use-surf-drops-in-view";

let mockAuthUser: { id: string } | null = { id: "user-1" };

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    const DynamicMock = ({
      onPlacementPinChange,
      placementActive,
      placementPin,
      placementPinDraggable,
      showSurfSpots,
      showSwellField,
      toolbarLayerControls,
    }: {
      onPlacementPinChange?: (pin: { lat: number; lon: number }) => void;
      placementActive?: boolean;
      placementPin?: { lat: number; lon: number } | null;
      placementPinDraggable?: boolean;
      showSurfSpots?: boolean;
      showSwellField?: boolean;
      toolbarLayerControls?: React.ReactNode;
    }) => (
      <div
        data-testid="mock-map-view"
        data-placement-active={String(placementActive)}
        data-placement-draggable={String(placementPinDraggable)}
        data-placement-pin={placementPin ? `${placementPin.lat},${placementPin.lon}` : ""}
        data-show-surf-spots={String(showSurfSpots)}
        data-show-swell-field={String(showSwellField)}
      >
        {toolbarLayerControls}
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
  useOptionalAuth: () => ({ user: mockAuthUser }),
}));

jest.mock("@/components/map/surf-drops-layer", () => ({
  SurfDropsLayer: ({
    optimisticDrop,
  }: {
    optimisticDrop?: SurfDropInView | null;
  }) => (
    <div
      data-testid="mock-surf-drops-layer"
      data-optimistic-drop-id={optimisticDrop?.id ?? ""}
      data-optimistic-drop-coords={
        optimisticDrop
          ? `${optimisticDrop.lat},${optimisticDrop.lon}`
          : ""
      }
    />
  ),
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
    onCreated: (result: CreateDropSheetSuccess) => void;
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
          location_type: "custom_pin",
          beach_id: null,
          lat: customPin?.lat ?? null,
          lon: customPin?.lon ?? null,
          spot_name: null,
          general_area: "Custom beach pin",
          exact_label: customPin?.label ?? null,
          starts_at: "2099-07-02T14:00:00.000Z",
          ends_at: "2099-07-02T15:00:00.000Z",
          audience: "mutuals",
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
    mockAuthUser = { id: "user-1" };
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
    const placementPanel = screen.getByTestId("drop-placement-panel");
    expect(placementPanel).toBeInTheDocument();
    expect(placementPanel).toHaveStyle({
      background: "#F4EBD8",
      borderColor: "#11100D",
      color: "#11100D",
    });
    expect(screen.queryByTestId("mock-create-drop-success")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-place-drop-pin"));
    expect(screen.getByTestId("mock-map-view")).toHaveAttribute(
      "data-placement-active",
      "true",
    );
    expect(screen.getByTestId("mock-map-view")).toHaveAttribute(
      "data-placement-draggable",
      "true",
    );
    expect(screen.getByTestId("mock-map-view")).toHaveAttribute(
      "data-placement-pin",
      "32.7489,-117.2532",
    );
    const placementConfirm = screen.getByTestId("drop-placement-confirm");
    expect(placementConfirm).not.toHaveClass("bg-primary");
    expect(placementConfirm).toHaveStyle({
      background: "#F78E42",
      color: "#11100D",
    });
    fireEvent.click(placementConfirm);

    expect(screen.getByTestId("mock-map-view")).toHaveAttribute(
      "data-placement-active",
      "true",
    );
    expect(screen.getByTestId("mock-map-view")).toHaveAttribute(
      "data-placement-draggable",
      "false",
    );
    expect(screen.getByTestId("mock-map-view")).toHaveAttribute(
      "data-placement-pin",
      "32.7489,-117.2532",
    );
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
    const toast = screen.getByTestId("drop-created-toast");
    expect(toast).toHaveClass("zine-tab");
    expect(toast).toHaveClass("bg-[#F4EBD8]");
    expect(toastLink).toHaveAttribute(
      "href",
      "/drops/11111111-2222-3333-4444-555555555555",
    );
    expect(toastLink).not.toHaveAttribute("href", "/drops/A2K7N9PQRS");

    await waitFor(() => {
      expect(screen.getByTestId("mock-surf-drops-layer")).toHaveAttribute(
        "data-optimistic-drop-id",
        "11111111-2222-3333-4444-555555555555",
      );
      expect(screen.getByTestId("mock-surf-drops-layer")).toHaveAttribute(
        "data-optimistic-drop-coords",
        "32.7489,-117.2532",
      );
    });
  });

  it("passes one toolbar layer menu into the map shell", () => {
    const { container } = render(<MapPageClient />);

    expect(container.firstElementChild).toHaveClass("min-h-0", "overflow-hidden");
    expect(screen.getAllByTestId("layer-legend")).toHaveLength(1);
    expect(screen.getByTestId("mock-map-view")).toContainElement(
      screen.getByTestId("layer-legend"),
    );
  });

  it("wires Swell and Surf Spots layer toggles to map state", () => {
    render(<MapPageClient />);

    const mapView = screen.getByTestId("mock-map-view");

    expect(mapView).toHaveAttribute("data-show-swell-field", "true");
    expect(mapView).toHaveAttribute("data-show-surf-spots", "true");

    fireEvent.click(screen.getByTestId("layer-legend-toggle-swell"));
    fireEvent.click(screen.getByTestId("layer-legend-toggle-spots"));

    expect(mapView).toHaveAttribute("data-show-swell-field", "false");
    expect(mapView).toHaveAttribute("data-show-surf-spots", "false");
  });

  it("hides Surf Drops controls and layer for logged-out users", () => {
    mockAuthUser = null;
    render(<MapPageClient />);

    expect(screen.queryByTestId("layer-legend-row-drops")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-surf-drops-layer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("drop-a-spot-fab")).not.toBeInTheDocument();
  });
});
