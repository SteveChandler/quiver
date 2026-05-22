import type { ImgHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";

import { SpotGeneratedIcon } from "@/components/spots/spot-generated-icon";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    fill: _fill,
    unoptimized: _unoptimized,
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    unoptimized?: boolean;
    priority?: boolean;
  }) => <img alt={alt} {...props} />,
}));

describe("SpotGeneratedIcon", () => {
  it("maps icon names to the generated spot asset set", () => {
    render(<SpotGeneratedIcon name="wind-read" alt="Wind icon" size={32} />);

    expect(screen.getByAltText("Wind icon")).toHaveAttribute(
      "src",
      "/images/spot-icons/wind-read.png"
    );
    expect(screen.getByAltText("Wind icon")).toHaveAttribute("width", "32");
    expect(screen.getByAltText("Wind icon")).toHaveAttribute("height", "32");
  });
});
