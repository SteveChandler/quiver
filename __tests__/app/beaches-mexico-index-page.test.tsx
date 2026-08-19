import { render, screen } from "@testing-library/react";

import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { getBajaFeaturedPhoto } from "@/app/beaches/_lib/get-baja-featured-photo";
import MexicoStatesIndexPage from "@/app/beaches/mexico/page";

jest.mock("@/actions/beach/beach-location-list-actions", () => ({
  getAllBeachLocations: jest.fn(),
}));

jest.mock("@/app/beaches/_lib/get-baja-featured-photo", () => ({
  getBajaFeaturedPhoto: jest.fn(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ fill: _fill, priority: _priority, sizes: _sizes, ...props }: any) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

const mockGetAllBeachLocations = jest.mocked(getAllBeachLocations);
const mockGetBajaFeaturedPhoto = jest.mocked(getBajaFeaturedPhoto);

describe("Mexico beaches state index", () => {
  beforeEach(() => {
    mockGetAllBeachLocations.mockResolvedValue({
      success: true,
      data: [
        { country: "Mexico", state: "Baja California", city: "Ensenada" },
        { country: "MX", state: "Baja California", city: "Rosarito" },
        { country: "MEX", state: "Baja California", city: "Rosarito" },
      ],
    } as Awaited<ReturnType<typeof getAllBeachLocations>>);
    mockGetBajaFeaturedPhoto.mockResolvedValue({
      src: "https://example.com/baja-featured.webp",
      alt: "Surf at San Miguel, Baja California",
      attributionHtml: "Photo by Example Surfer",
    });
  });

  it("renders the zine hierarchy, Baja link, counts, and structured data", async () => {
    const { container } = render(await MexicoStatesIndexPage());

    expect(screen.getByTestId("mexico-beaches-zine-surface")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /breadcrumb/i }),
    ).toHaveTextContent(/Home\s*\/\s*Beaches\s*\/\s*Mexico/);
    expect(
      screen.getByRole("heading", { level: 1, name: /best surf beaches in mexico/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 state")).toBeInTheDocument();
    expect(screen.getAllByText("2 cities")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /baja california/i })).toHaveAttribute(
      "href",
      "/beaches/mexico/baja-california",
    );

    const schemas = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]'),
    )
      .map((script) => script.textContent ?? "")
      .join("\n");
    expect(schemas).toContain('"@type":"BreadcrumbList"');
    expect(schemas).toContain('"@type":"WebPage"');
    expect(schemas).toContain("/beaches/mexico");
  });

  it("renders the approved Baja photo and its attribution", async () => {
    render(await MexicoStatesIndexPage());

    expect(
      screen.getByRole("img", { name: /surf at san miguel/i }),
    ).toHaveAttribute(
      "src",
      "/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fbaja-featured.webp",
    );
    expect(screen.getByText(/photo by example surfer/i)).toBeInTheDocument();
  });

  it("uses the deliberate zine fallback when no approved photo is available", async () => {
    mockGetBajaFeaturedPhoto.mockResolvedValueOnce(null);

    render(await MexicoStatesIndexPage());

    expect(
      screen.getByRole("img", { name: /baja california coast photo coming soon/i }),
    ).toBeInTheDocument();
  });
});
