import { render, screen } from "@testing-library/react";
import { MapBottomSheet } from "@/components/map/map-bottom-sheet";

// Mock the custom gesture hook — returns a ref and static state
jest.mock("@/hooks/use-bottom-sheet-gesture", () => ({
  useBottomSheetGesture: () => {
    const sheetRef = { current: null };
    return { sheetRef, isDragging: false };
  },
}));

jest.mock("@/components/map/sidebar-beach-card", () => ({
  SidebarBeachCard: ({ beach }: any) => (
    <div data-testid={`sidebar-card-${beach.id}`}>{beach.name}</div>
  ),
}));

jest.mock("@/components/map/selected-beach-card", () => ({
  SelectedBeachCard: ({ selectedBeach, onClose }: any) => (
    <div data-testid="selected-beach-card">
      <span>{selectedBeach.name}</span>
      {onClose && (
        <button aria-label="Deselect beach" onClick={onClose} />
      )}
    </div>
  ),
}));

jest.mock("@/hooks/use-beach-list-state", () => ({
  useBeachListState: () => ({ setCardRef: jest.fn(), distanceMap: null }),
}));

const makeBeach = (id: string, name: string) =>
  ({ id, slug: id, name, city: "Test City", state: "CA", lat: 33, lon: -117 }) as any;

const defaultProps = {
  waveHeightMap: new Map<string, number | undefined>(),
  userLocation: null,
  onBeachSelect: jest.fn(),
  getDistanceFromUser: jest.fn(() => ""),
  onDeselectBeach: jest.fn(),
};

// Set window.innerHeight for snap math
beforeAll(() => {
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: 800,
  });
});

describe("MapBottomSheet", () => {
  it("renders beach list with correct count", () => {
    const beaches = [makeBeach("b1", "Blacks"), makeBeach("b2", "Scripps")];
    render(
      <MapBottomSheet {...defaultProps} beaches={beaches} selectedBeach={null} />
    );

    expect(screen.getByText("2 spots in view")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-card-b1")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-card-b2")).toBeInTheDocument();
  });

  it("shows SelectedBeachCard when selectedBeach is provided", () => {
    const beach = makeBeach("b1", "Blacks");
    render(
      <MapBottomSheet {...defaultProps} beaches={[beach]} selectedBeach={beach} />
    );

    expect(screen.getByTestId("selected-beach-card")).toBeInTheDocument();
  });

  it("does not show SelectedBeachCard when selectedBeach is null", () => {
    render(
      <MapBottomSheet
        {...defaultProps}
        beaches={[makeBeach("b1", "Blacks")]}
        selectedBeach={null}
      />
    );

    expect(screen.queryByTestId("selected-beach-card")).not.toBeInTheDocument();
  });

  it("header shows beach name when selected, 'Surf Spots' otherwise", () => {
    const beach = makeBeach("b1", "Blacks");

    const { rerender } = render(
      <MapBottomSheet {...defaultProps} beaches={[beach]} selectedBeach={null} />
    );
    expect(screen.getByText("Surf Spots")).toBeInTheDocument();

    rerender(
      <MapBottomSheet {...defaultProps} beaches={[beach]} selectedBeach={beach} />
    );
    expect(screen.getByRole("heading", { name: "Blacks" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Surf Spots" })).not.toBeInTheDocument();
  });

  it("scroll container is scrollable at detail snap (when beach selected)", () => {
    const beach = makeBeach("b1", "Blacks");
    render(
      <MapBottomSheet {...defaultProps} beaches={[beach]} selectedBeach={beach} />
    );
    const scrollContainer = screen.getByTestId("drawer-scroll-container");
    expect(scrollContainer).toHaveStyle({ overflowY: "auto" });
  });

  it("scroll container is NOT scrollable at peek snap (no selection)", () => {
    render(
      <MapBottomSheet {...defaultProps} beaches={[makeBeach("b1", "Blacks")]} selectedBeach={null} />
    );
    const scrollContainer = screen.getByTestId("drawer-scroll-container");
    expect(scrollContainer).toHaveStyle({ overflowY: "hidden" });
  });

  it("renders a padded handle area for easier touch interaction", () => {
    render(
      <MapBottomSheet
        {...defaultProps}
        beaches={[makeBeach("b1", "Blacks")]}
        selectedBeach={null}
      />
    );

    const handleArea = screen.getByTestId("drawer-handle-area");
    expect(handleArea).toBeInTheDocument();
    expect(handleArea.className).toContain("py-4");
  });

  it("handle area has touch-action: none for gesture handling", () => {
    render(
      <MapBottomSheet
        {...defaultProps}
        beaches={[makeBeach("b1", "Blacks")]}
        selectedBeach={null}
      />
    );

    const handleArea = screen.getByTestId("drawer-handle-area");
    expect(handleArea.style.touchAction).toBe("none");
  });

  it("sheet uses vh units instead of dvh for Android compatibility", () => {
    render(
      <MapBottomSheet
        {...defaultProps}
        beaches={[makeBeach("b1", "Blacks")]}
        selectedBeach={null}
      />
    );

    const sheet = screen.getByTestId("bottom-sheet");
    expect(sheet.className).toContain("h-[90vh]");
    expect(sheet.className).not.toContain("dvh");
  });

  it("shows empty state when no beaches", () => {
    render(
      <MapBottomSheet {...defaultProps} beaches={[]} selectedBeach={null} />
    );

    expect(
      screen.getByText("No beaches in this area. Zoom out or pan to find surf spots.")
    ).toBeInTheDocument();
  });

  it("singular 'spot' text for single beach", () => {
    render(
      <MapBottomSheet
        {...defaultProps}
        beaches={[makeBeach("b1", "Blacks")]}
        selectedBeach={null}
      />
    );

    expect(screen.getByText("1 spot in view")).toBeInTheDocument();
  });
});
