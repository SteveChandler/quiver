import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { SiteFooter } from "@/components/shared/site-footer";
import { metadata } from "@/app/roadmap/layout";

describe("Ahrefs crawl surfaces", () => {
  it("exposes the game heading and outgoing links before JavaScript runs", () => {
    const html = readFileSync(join(process.cwd(), "public/surf-game/index.html"), "utf8");
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(document.querySelector("h1")?.textContent).toContain("EL NIÑO SWELL");
    const links = [...document.querySelectorAll("nav a")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://www.quiversurf.app/forecast",
      "https://www.quiversurf.app/guides",
    ]);
    for (const link of links) expect(link.getAttribute("rel") ?? "").not.toContain("nofollow");
  });

  it("links public navigation to the game, guides, and download page", () => {
    render(<SiteFooter />);
    const footer = within(screen.getByRole("contentinfo"));
    for (const [name, href] of [["Surf Game", "/surf-game"], ["Surf Guides", "/guides"], ["Download Quiver", "/download"]]) {
      expect(footer.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("includes a real image in the roadmap's Open Graph override", () => {
    expect(metadata.openGraph?.images).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: "/og-image.png", width: 1200, height: 630 }),
    ]));
    expect(readFileSync(join(process.cwd(), "public/og-image.png")).length).toBeGreaterThan(0);
  });
});
