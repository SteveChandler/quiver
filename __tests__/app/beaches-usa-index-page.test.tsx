import { render, screen } from "@testing-library/react";

import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import UsaStatesIndexPage from "@/app/beaches/usa/page";

jest.mock("@/actions/beach/beach-location-list-actions", () => ({
  getAllBeachLocations: jest.fn(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ fill: _fill, priority: _priority, sizes: _sizes, ...props }: any) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

const mockGetAllBeachLocations = jest.mocked(getAllBeachLocations);

describe("USA beaches state index", () => {
  beforeEach(() => {
    mockGetAllBeachLocations.mockResolvedValue({
      success: true,
      data: [
        { country: "USA", state: "CA", city: "Los Angeles" },
        { country: "United States", state: "California", city: "San Diego" },
        { country: "US", state: "CA", city: "San Diego" },
        { country: "USA", state: "HI", city: "Honolulu" },
        { country: "USA", state: "OR", city: "Bandon" },
      ],
    } as Awaited<ReturnType<typeof getAllBeachLocations>>);
  });

  it("renders the zine hierarchy, scannable counts, links, and schemas", async () => {
    const { container } = render(await UsaStatesIndexPage());

    expect(screen.getByTestId("usa-beaches-zine-surface")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /breadcrumb/i }),
    ).toHaveTextContent(/Home\s*\/\s*Beaches\s*\/\s*United States/);
    expect(
      screen.getByRole("heading", { level: 1, name: /best surf beaches by state/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 states")).toBeInTheDocument();
    expect(screen.getByText("4+ cities")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /california/i })).toHaveAttribute(
      "href",
      "/beaches/usa/ca",
    );
    expect(screen.getByRole("link", { name: /hawaii/i })).toHaveAttribute(
      "href",
      "/beaches/usa/hi",
    );
    expect(screen.getByRole("link", { name: /oregon/i })).toHaveAttribute(
      "href",
      "/beaches/usa/or",
    );

    const schemas = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]'),
    )
      .map((script) => script.textContent ?? "")
      .join("\n");
    expect(schemas).toContain('"@type":"BreadcrumbList"');
    expect(schemas).toContain('"@type":"WebPage"');
    expect(schemas).toContain('"@type":"ItemList"');
    expect(schemas).toContain("/beaches/usa/ca");
  });

  it("uses regional photography where available and a state-stamp fallback otherwise", async () => {
    render(await UsaStatesIndexPage());

    expect(
      screen.getByRole("img", { name: /venice beach and the southern california coastline/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /hawaii state stamp/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("HI")).toBeInTheDocument();
  });
});
