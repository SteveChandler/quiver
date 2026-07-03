import { buildSurfDropMarkerElement } from "@/components/map/surf-drop-marker";

const BASE_DROP = {
  id: "drop-1",
  share_slug: "abc123",
  lat: 32.77,
  lon: -117.25,
  spot_name: "Sunset Cliffs",
  general_area: "OB",
  starts_at: "2026-07-01T15:00:00Z",
  ends_at: "2026-07-01T16:00:00Z",
  creator: {
    id: "u-1",
    display_name: "Steve",
    avatar_url: null,
  },
};

describe("buildSurfDropMarkerElement", () => {
  it("renders the initial when no avatar_url is present", () => {
    const el = buildSurfDropMarkerElement(BASE_DROP);
    const avatar = el.querySelector<HTMLDivElement>('[data-testid="surf-drop-avatar"]');
    expect(avatar).not.toBeNull();
    expect(avatar?.textContent).toBe("S");
  });

  it("renders an <img> when avatar_url is provided", () => {
    const el = buildSurfDropMarkerElement({
      ...BASE_DROP,
      creator: { ...BASE_DROP.creator, avatar_url: "https://example.com/a.png" },
    });
    const img = el.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/a.png");
  });

  it("renders two sonar rings by default and one when reduced-motion is on", () => {
    const el = buildSurfDropMarkerElement(BASE_DROP);
    expect(
      el.querySelectorAll('[data-testid="surf-drop-sonar-ring"]').length,
    ).toBe(2);
    const reduced = buildSurfDropMarkerElement(BASE_DROP, { reducedMotion: true });
    expect(
      reduced.querySelectorAll('[data-testid="surf-drop-sonar-ring"]').length,
    ).toBe(1);
  });

  it("fires the onClick handler with the drop payload", () => {
    const handler = jest.fn();
    const el = buildSurfDropMarkerElement(BASE_DROP, { onClick: handler });
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].share_slug).toBe("abc123");
  });

  it("carries the drop id and share slug on the wrapper as data-attrs", () => {
    const el = buildSurfDropMarkerElement(BASE_DROP);
    expect(el.getAttribute("data-drop-id")).toBe("drop-1");
    expect(el.getAttribute("data-share-slug")).toBe("abc123");
  });
});
