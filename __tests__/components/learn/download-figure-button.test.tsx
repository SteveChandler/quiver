import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FigureFrame } from "@/components/learn/figures/figure-frame";
import { FigurePoster } from "@/components/learn/figures/figure-poster";

describe("DownloadFigureButton", () => {
  const originalCreateElement = document.createElement.bind(document);
  const createObjectURL = jest.fn(() => "blob:figure");
  const revokeObjectURL = jest.fn();
  const fillText = jest.fn();
  const drawImage = jest.fn();
  const OriginalImage = global.Image;

  beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    global.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    } as unknown as typeof Image;

    jest.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === "canvas") {
        Object.assign(element, {
          width: 0,
          height: 0,
          getContext: jest.fn(() => ({
            fillRect: jest.fn(),
            fillText,
            drawImage,
            measureText: jest.fn((text: string) => ({ width: text.length * 8 })),
            font: "",
            fillStyle: "",
          })),
          toBlob: jest.fn((callback: (blob: Blob) => void) => {
            callback(new Blob(["png"], { type: "image/png" }));
          }),
        });
      }
      if (tagName === "a") {
        Object.assign(element, { click: jest.fn() });
      }
      return element;
    });
  });

  afterEach(() => {
    global.Image = OriginalImage;
    jest.restoreAllMocks();
  });

  it("downloads a branded PNG even when the reduced-motion poster has no canvas", async () => {
    render(
      <FigureFrame
        title="Storm to Shore"
        summary="Static reduced motion figure summary."
        downloadTitle="Storm to Shore"
      >
        <div>Static poster</div>
      </FigureFrame>
    );

    fireEvent.click(screen.getByRole("button", { name: /download png/i }));

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:figure");
    });
    expect(drawImage).not.toHaveBeenCalled();
    expect(fillText).toHaveBeenCalledWith("Static reduced motion figure summary.", 112, 210);
    expect(fillText).toHaveBeenCalledWith("Quiver", 72, 638);
    expect(fillText).toHaveBeenCalledWith("quiversurf.app/learn", 190, 638);
  });

  it("draws the reduced-motion SVG poster into the exported PNG", async () => {
    render(
      <FigureFrame
        title="Storm to Shore"
        summary="Groundswell travels as clean lines."
        downloadTitle="Storm to Shore"
      >
        <FigurePoster kind="origin-fetch" />
      </FigureFrame>
    );

    fireEvent.click(screen.getByRole("button", { name: /download png/i }));

    await waitFor(() => {
      expect(drawImage).toHaveBeenCalledWith(expect.any(Object), 72, 120, 1056, 420);
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:figure");
  });
});
