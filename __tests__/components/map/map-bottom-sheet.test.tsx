import { render, screen } from "@testing-library/react";
import { MapBottomSheet } from "@/components/map/map-bottom-sheet";

// Mock vaul Drawer primitives as passthrough divs
jest.mock("vaul", () => {
  const Root = ({ children }: any) => <div data-testid="drawer-root">{children}</div>;
  const Portal = ({ children }: any) => <div>{children}</div>;
  const Content = ({ children, ...props }: any) => <div {...props}>{children}</div>;
  const Handle = (props: any) => <div {...props} />;
  const Title = ({ children, ...props }: any) => <h2 {...props}>{children}</h2>;

  return {
    Drawer: Object.assign(Root, {
      Root,
      Portal,
      Content,
      Handle,
      Title,
    }),
  };
});

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
});
