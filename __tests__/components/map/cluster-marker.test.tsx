import { createClusterMarkerElement } from "@/components/map/cluster-marker";

describe("createClusterMarkerElement", () => {
  it("should create element with count text", () => {
    const { element } = createClusterMarkerElement({
      waveHeights: [1.5, 2.5, 3.2],
      pointCount: 5,
      hasFavorite: false,
      onHover: jest.fn(),
      onLeave: jest.fn(),
    });

    expect(element.textContent).toBe("5");
  });

  it("should show count text when no wave data", () => {
    const { element } = createClusterMarkerElement({
      waveHeights: [],
      pointCount: 3,
      hasFavorite: false,
      onHover: jest.fn(),
      onLeave: jest.fn(),
    });

    expect(element.textContent).toBe("3");
  });

  it("should apply blue gradient for favorites", () => {
    const { element } = createClusterMarkerElement({
      waveHeights: [2.0],
      pointCount: 2,
      hasFavorite: true,
      onHover: jest.fn(),
      onLeave: jest.fn(),
    });

    const badge = element.querySelector("[data-cluster-badge]");
    // jsdom doesn't support linear-gradient, so we check the data attribute
    expect(badge?.getAttribute("data-cluster-color")).toContain("#3b82f6");
  });

  it("should call onHover on mouseenter", () => {
    const onHover = jest.fn();
    const { element } = createClusterMarkerElement({
      waveHeights: [2.0],
      pointCount: 3,
      hasFavorite: false,
      onHover,
      onLeave: jest.fn(),
    });

    const event = new MouseEvent("mouseenter", { bubbles: true });
    element.dispatchEvent(event);

    expect(onHover).toHaveBeenCalled();
  });

  it("should have correct test id", () => {
    const { element } = createClusterMarkerElement({
      waveHeights: [2.0],
      pointCount: 3,
      hasFavorite: false,
      onHover: jest.fn(),
      onLeave: jest.fn(),
    });

    expect(element.getAttribute("data-testid")).toBe("cluster-marker");
  });

  it("should remove event listeners when cleanup is called", () => {
    const onHover = jest.fn();
    const onLeave = jest.fn();
    const { element, cleanup } = createClusterMarkerElement({
      waveHeights: [2.0],
      pointCount: 3,
      hasFavorite: false,
      onHover,
      onLeave,
    });

    // Verify events work before cleanup
    element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    expect(onHover).toHaveBeenCalledTimes(1);

    element.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(onLeave).toHaveBeenCalledTimes(1);

    // Call cleanup
    cleanup();

    // Events should no longer trigger handlers
    element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    expect(onHover).toHaveBeenCalledTimes(1); // Still 1, not incremented

    element.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(onLeave).toHaveBeenCalledTimes(1); // Still 1, not incremented
  });
});
