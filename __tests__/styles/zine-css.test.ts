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

  it("draws native's flat paper card, with no torn edge, grain or drop", () => {
    expect(zineCss).toContain("--zine-torn-inset: 20px;");
    expect(zineCss).toContain(":where(.zine-tab) .torn {");
    expect(zineCss).toContain("padding: var(--zine-torn-inset);");
    expect(zineCss).toMatch(
      /\.zine-tab \.torn,\s*\.zine-tab \.notebook \{\s*border: 1px solid var\(--paper-shadow\) !important;\s*border-radius: 14px 22px 14px 14px;\s*box-shadow: none !important;/
    );
    expect(zineCss).toMatch(
      /\.zine-tab \.zine-paper \{[^}]*border: 1px solid var\(--paper-shadow\);[^}]*border-radius: 14px 22px 14px 14px;/
    );
    expect(zineCss).not.toContain("mask-image");
    expect(zineCss).not.toContain(".zine-paper::before");
    expect(zineCss).not.toContain("0 30px 80px");
  });

  it("pins nothing to the page and sets paper square to the screen", () => {
    expect(zineCss).toContain(".zine-tab .tape { display: none; }");
    expect(zineCss).toMatch(
      /\.zine-tab \.rot-1,\s*\.zine-tab \.rot-2,\s*\.zine-tab \.rot-3,\s*\.zine-tab \.rot-4,\s*\.zine-tab \.rot-neg \{ transform: none; \}/
    );
    expect(zineCss).not.toMatch(/rotate\(/);
  });
});
