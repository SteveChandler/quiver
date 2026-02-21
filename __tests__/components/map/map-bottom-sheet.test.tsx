import { render, screen, act } from "@testing-library/react";
import { MapBottomSheet } from "@/components/map/map-bottom-sheet";

// Capture the setActiveSnapPoint handler passed to Drawer Root
// eslint-disable-next-line react-hooks/globals -- test-scoped variable for mock capture
let capturedSetActiveSnapPoint: ((val: number | string | null) => void) | null =
  null;

// Mock vaul Drawer primitives as passthrough divs
jest.mock("vaul", () => {
  const Root = ({ children, setActiveSnapPoint, activeSnapPoint }: any) => {
    capturedSetActiveSnapPoint = setActiveSnapPoint; // eslint-disable-line react-hooks/globals -- test mock capture
    return (
      <div data-testid="drawer-root" data-snap={String(activeSnapPoint)}>
        {children}
      </div>
    );
  };
  const Portal = ({ children }: any) => <div>{children}</div>;
  const Content = ({ children, ...props }: any) => (
    <div data-testid="drawer-content" {...props}>
      {children}
    </div>
  );
  const Handle = (props: any) => <div data-testid="drawer-handle" {...props} />;
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

  // Bug 1: pointer-events useEffect restores body pointer-events on mount
  it("restores body pointer-events to empty string on mount", () => {
    document.body.style.pointerEvents = "none"; // Simulate Vaul's side effect
    render(
      <MapBottomSheet {...defaultProps} beaches={[makeBeach("b1", "Blacks")]} selectedBeach={null} />
    );
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("body pointer-events stays cleared after rerenders", () => {
    const beaches = [makeBeach("b1", "Blacks")];
    document.body.style.pointerEvents = "none";
    const { rerender } = render(
      <MapBottomSheet {...defaultProps} beaches={beaches} selectedBeach={null} />
    );
    expect(document.body.style.pointerEvents).toBe("");
    // After rerender, should still be cleared
    rerender(
      <MapBottomSheet {...defaultProps} beaches={beaches} selectedBeach={null} />
    );
    expect(document.body.style.pointerEvents).toBe("");
  });

  // Bug 3: content should be scrollable at detail snap (40%), not just full (90%)
  it("scroll container is scrollable at detail snap (40%)", () => {
    const beach = makeBeach("b1", "Blacks");
    render(
      <MapBottomSheet {...defaultProps} beaches={[beach]} selectedBeach={beach} />
    );
    const scrollContainer = screen.getByTestId("drawer-scroll-container");
    expect(scrollContainer).toHaveStyle({ overflowY: "auto" });
  });

  it("scroll container is NOT scrollable at peek snap (10%)", () => {
    render(
      <MapBottomSheet {...defaultProps} beaches={[makeBeach("b1", "Blacks")]} selectedBeach={null} />
    );
    const scrollContainer = screen.getByTestId("drawer-scroll-container");
    expect(scrollContainer).toHaveStyle({ overflowY: "hidden" });
  });

  // Bug 5: drawer handle area should have adequate touch target
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

  // Bug 1: MutationObserver clears pointer-events if re-applied
  it("clears pointer-events when re-applied asynchronously", async () => {
    render(
      <MapBottomSheet {...defaultProps} beaches={[makeBeach("b1", "Blacks")]} selectedBeach={null} />
    );
    // Simulate Vaul/Radix re-applying pointer-events after async operation
    document.body.style.pointerEvents = "none";
    // MutationObserver fires as a microtask in jsdom — flush it
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.body.style.pointerEvents).toBe("");
  });

  // Bug 13 guard: snap point handler should prevent null / below-peek values
  describe("snap point guard", () => {
    const PEEK_SNAP = 0.1;

    it("resets to peek snap when snap point is set to null", () => {
      const beaches = [makeBeach("b1", "Blacks")];
      render(
        <MapBottomSheet
          {...defaultProps}
          beaches={beaches}
          selectedBeach={null}
        />
      );

      expect(capturedSetActiveSnapPoint).toBeDefined();

      // Simulate Vaul setting snap to null (dismissal)
      act(() => {
        capturedSetActiveSnapPoint!(null);
      });

      // The snap point should be guarded back to PEEK_SNAP, not null
      const root = screen.getByTestId("drawer-root");
      expect(root.getAttribute("data-snap")).toBe(String(PEEK_SNAP));
    });

    it("resets to peek snap when snap point goes to 0", () => {
      const beaches = [makeBeach("b1", "Blacks")];
      render(
        <MapBottomSheet
          {...defaultProps}
          beaches={beaches}
          selectedBeach={null}
        />
      );

      act(() => {
        capturedSetActiveSnapPoint!(0);
      });

      // The snap point should be guarded back to PEEK_SNAP, not 0
      const root = screen.getByTestId("drawer-root");
      expect(root.getAttribute("data-snap")).toBe(String(PEEK_SNAP));
    });

    it("calls onDismissAttempt when snap guard catches a dismiss", () => {
      const onDismissAttempt = jest.fn();
      const beaches = [makeBeach("b1", "Blacks")];
      render(
        <MapBottomSheet
          {...defaultProps}
          beaches={beaches}
          selectedBeach={null}
          onDismissAttempt={onDismissAttempt}
        />
      );

      act(() => {
        capturedSetActiveSnapPoint!(null);
      });

      expect(onDismissAttempt).toHaveBeenCalledTimes(1);
    });

    it("does not call onDismissAttempt for valid snap points", () => {
      const onDismissAttempt = jest.fn();
      const beaches = [makeBeach("b1", "Blacks")];
      render(
        <MapBottomSheet
          {...defaultProps}
          beaches={beaches}
          selectedBeach={null}
          onDismissAttempt={onDismissAttempt}
        />
      );

      act(() => {
        capturedSetActiveSnapPoint!(0.4);
      });

      expect(onDismissAttempt).not.toHaveBeenCalled();
    });
  });
});
