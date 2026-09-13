import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server.node";
import { AutoplayVideo } from "@/components/landing-page/field-guide/autoplay-video";

let mockInView = false;
let mockReducedMotion = false;
jest.mock("framer-motion", () => ({
  useInView: () => mockInView,
  useReducedMotion: () => mockReducedMotion,
}));

describe("AutoplayVideo media loading", () => {
  let play: jest.SpyInstance;
  beforeEach(() => {
    mockInView = false;
    mockReducedMotion = false;
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: false },
    });
    play = jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  });
  afterEach(() => jest.restoreAllMocks());

  it("keeps initial markup stable before motion preferences are known", () => {
    const markup = renderToString(<AutoplayVideo src="/demo.mp4" ariaLabel="Demo" />);
    mockReducedMotion = true;
    expect(renderToString(<AutoplayVideo src="/demo.mp4" ariaLabel="Demo" />)).toBe(markup);
    render(<AutoplayVideo src="/demo.mp4" ariaLabel="Demo" />);
    expect(screen.getByRole("button", { name: "Play video" })).toBeVisible();
  });

  it("waits until visible before attaching media and playing", async () => {
    const { rerender } = render(<AutoplayVideo src="/demo.mp4" ariaLabel="Demo" />);
    expect(screen.getByLabelText("Demo")).not.toHaveAttribute("src");
    expect(play).not.toHaveBeenCalled();
    mockInView = true;
    rerender(<AutoplayVideo src="/demo.mp4" ariaLabel="Demo" />);
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Demo")).toHaveAttribute("src", "/demo.mp4");
  });

  it.each(["motion", "data"])("requires explicit playback for reduced %s", async (preference) => {
    mockInView = true;
    mockReducedMotion = preference === "motion";
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: preference === "data" },
    });
    render(<AutoplayVideo src="/demo.mp4" ariaLabel="Demo" />);
    expect(screen.getByLabelText("Demo")).not.toHaveAttribute("src");
    expect(play).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play video" })));
    expect(screen.getByLabelText("Demo")).toHaveAttribute("src", "/demo.mp4");
    expect(play).toHaveBeenCalledTimes(1);
  });
});
