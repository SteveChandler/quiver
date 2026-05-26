import React from "react";
import { render, screen } from "@testing-library/react";
import { HalftonePhoto } from "@/components/beach-detail/zine/atoms";

describe("HalftonePhoto", () => {
  it("proxies live.staticflickr.com photos before rendering crawler-visible images", () => {
    render(
      <HalftonePhoto
        src="https://live.staticflickr.com/65535/example.jpg"
        alt="Santa Cruz surf photo"
      />,
    );

    const image = screen.getByAltText("Santa Cruz surf photo");
    expect(image).toHaveAttribute(
      "src",
      "/api/image-proxy?url=https%3A%2F%2Flive.staticflickr.com%2F65535%2Fexample.jpg",
    );
  });
});
