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
    expect(zineCss).toContain("color: #0B3A75 !important;");
  });

  it("keeps the forecast window panel readable on cream zine paper", () => {
    expect(zineCss).toContain(
      '.zine-page .zine-tabs-slot [data-tier="hero"].bg-card .rounded-2xl.border-blue-200\\/60'
    );
    expect(zineCss).toContain("background: rgba(11, 58, 117, 0.08) !important;");
    expect(zineCss).toContain("color: #0A2F5E !important;");
  });

  it("keeps the forecast why-sentence panel readable on cream zine paper", () => {
    expect(zineCss).toContain(
      '.zine-page .zine-tabs-slot [data-tier="hero"].bg-card .rounded-xl.border-gray-200\\/40'
    );
    expect(zineCss).toContain("border-color: #0B3A75 !important;");
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
    expect(zineCss).toContain("color: #0B3A75 !important;");
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
      "background-color: rgba(11, 58, 117, 0.08) !important;"
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

  it("removes decorative rotations at compact desktop widths", () => {
    expect(zineCss).toContain("@media (max-width: 900px)");
    expect(zineCss).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?\.zine-tab \.rot-neg\s*\{[\s\S]*?transform: none;/
    );
  });
});
