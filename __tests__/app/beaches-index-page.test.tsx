import { render, screen } from "@testing-library/react";

import BeachesIndexPage from "@/app/beaches/page";
import { getBajaFeaturedPhoto } from "@/app/beaches/_lib/get-baja-featured-photo";

jest.mock("@/app/beaches/_lib/get-baja-featured-photo", () => ({
  getBajaFeaturedPhoto: jest.fn(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ fill: _fill, priority: _priority, sizes: _sizes, ...props }: any) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

const mockGetBajaFeaturedPhoto = jest.mocked(getBajaFeaturedPhoto);

function getSchemas(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll('script[type="application/ld+json"]'),
  ).map((script) => script.textContent ?? "");
}

describe("beaches region index", () => {
  beforeEach(() => {
    mockGetBajaFeaturedPhoto.mockResolvedValue({
      src: "https://example.com/baja.webp",
      alt: "Surf at San Miguel, Baja California",
      attributionHtml: "Photo by Example Surfer",
    });
  });

  it("renders the zine hierarchy, region links, counts, and structured data", async () => {
    const { container } = render(await BeachesIndexPage());

    expect(screen.getByTestId("beaches-zine-surface")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /breadcrumb/i }),
    ).toHaveTextContent(/Home\s*\/\s*Beaches/);
    expect(
      screen.getByRole("heading", { level: 1, name: /browse surf beaches by region/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /united states/i })).toHaveAttribute(
      "href",
      "/beaches/usa",
    );
    expect(screen.getByRole("link", { name: /mexico/i })).toHaveAttribute(
      "href",
      "/beaches/mexico",
    );
    expect(screen.getByText(/16 coastal states/i)).toBeInTheDocument();
    expect(screen.getByText(/over 5,000 beaches/i)).toBeInTheDocument();

    const schemas = getSchemas(container).join("\n");
    expect(schemas).toContain('"@type":"BreadcrumbList"');
    expect(schemas).toContain('"@type":"WebPage"');
    expect(schemas).toContain("/beaches");
  });

  it("uses the approved Baja photo when present and a zine fallback when absent", async () => {
    const { rerender } = render(await BeachesIndexPage());

    expect(
      screen.getByRole("img", { name: /surf at san miguel/i }),
    ).toHaveAttribute(
      "src",
      "/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fbaja.webp",
    );

    mockGetBajaFeaturedPhoto.mockResolvedValueOnce(null);
    rerender(await BeachesIndexPage());

    expect(
      screen.getByRole("img", { name: /baja california coast photo coming soon/i }),
    ).toBeInTheDocument();
  });
});
