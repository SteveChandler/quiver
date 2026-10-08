import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("zine stylesheet", () => {
  const zineCss = readFileSync(
    join(process.cwd(), "app/styles/zine.css"),
    "utf8"
  );

  it("keeps shared card text readable on cream zine paper", () => {
    expect(zineCss).toContain(".zine-page .zine-tabs-slot .bg-card");
    expect(zineCss).toContain("color: #11100D !important;");
    expect(zineCss).toContain(
      ".zine-page .zine-tabs-slot .bg-card .text-muted-foreground"
    );
    expect(zineCss).toContain("color: #4B4030 !important;");
  });

  it("keeps the forecast best-time card readable on cream zine paper", () => {
    expect(zineCss).toContain(
      '.zine-page .zine-tabs-slot [data-tier="hero"].bg-card .text-blue-900'
    );
    expect(zineCss).toContain(
      '.zine-page .zine-tabs-slot [data-tier="hero"].bg-card .text-gray-700'
    );
    expect(zineCss).toContain(
      '.zine-page .zine-tabs-slot [data-tier="hero"].bg-card .bg-blue-50\\/50'
    );
    expect(zineCss).toContain("color: #8A5E00 !important;");
  });

  it("keeps the forecast window panel readable on cream zine paper", () => {
    expect(zineCss).toContain(
      '.zine-page .zine-tabs-slot [data-tier="hero"].bg-card .rounded-2xl.border-blue-200\\/60'
    );
    expect(zineCss).toContain("background: #F6E9CE !important;");
    expect(zineCss).toContain("color: #11100D !important;");
  });

  it("keeps the forecast why-sentence panel readable on cream zine paper", () => {
    expect(zineCss).toContain(
      '.zine-page .zine-tabs-slot [data-tier="hero"].bg-card .rounded-xl.border-gray-200\\/40'
    );
    expect(zineCss).toContain("border-color: #11100D !important;");
    expect(zineCss).toContain("opacity: 1;");
  });

  it("keeps the local intel empty state readable on cream zine paper", () => {
    expect(zineCss).toContain(
      ".zine-page .zine-tabs-slot #intel-section .text-gray-900"
    );
    expect(zineCss).toContain(
      ".zine-page .zine-tabs-slot #intel-section .text-gray-600"
    );
    expect(zineCss).toContain(
      ".zine-page .zine-tabs-slot #intel-section .text-blue-700"
    );
    expect(zineCss).toContain("color: #8A5E00 !important;");
  });

  it("keeps recent session cards readable on cream zine paper", () => {
    expect(zineCss).toContain(
      ".zine-page .zine-tabs-slot .session-card-hover"
    );
    expect(zineCss).toContain(
      ".zine-page .zine-tabs-slot .session-card-hover .text-muted-foreground"
    );
    expect(zineCss).toContain(
      ".zine-page .zine-tabs-slot .session-card-hover .bg-muted\\/50"
    );
    expect(zineCss).toContain(
      "background-color: #F6E9CE !important;"
    );
  });

  it("uses fixed-height torn edge bands with a safe content inset", () => {
    expect(zineCss).toContain("--zine-torn-edge-depth: 16px;");
    expect(zineCss).toContain("--zine-torn-inset: 20px;");
    expect(zineCss).toContain(":where(.zine-tab) .torn {");
    expect(zineCss).toContain("padding: var(--zine-torn-inset);");
    expect(zineCss).toContain(
      "-webkit-mask-size: 100% var(--zine-torn-edge-depth), 100% calc(100% - var(--zine-torn-edge-depth) - var(--zine-torn-edge-depth)), 100% var(--zine-torn-edge-depth);"
    );
    expect(zineCss).toContain(
      "mask-size: 100% var(--zine-torn-edge-depth), 100% calc(100% - var(--zine-torn-edge-depth) - var(--zine-torn-edge-depth)), 100% var(--zine-torn-edge-depth);"
    );
    expect(zineCss).not.toContain("mask-size: 100% 100%;");
  });

  it("sets cards square at every width", () => {
    expect(zineCss).toMatch(
      /\.zine-tab \.rot-1,\s*\.zine-tab \.rot-2,\s*\.zine-tab \.rot-3,\s*\.zine-tab \.rot-4,\s*\.zine-tab \.rot-neg \{ transform: none; \}/
    );
    // Only the corner tape keeps an angle.
    const rotations = zineCss.match(/rotate\([^)]*\)/g) ?? [];
    expect(rotations).toHaveLength(4);
    expect(zineCss).not.toContain("rotate(-8deg)");
  });
});
