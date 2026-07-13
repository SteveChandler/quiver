import { readFileSync } from "node:fs";
import { join } from "node:path";

import { metadata } from "@/app/vs/surfline/page";

describe("Surfline comparison SEO metadata", () => {
  it("targets Surfline alternative intent without free positioning", () => {
    const title =
      typeof metadata.title === "object" && metadata.title !== null
        ? metadata.title
        : {};

    expect(metadata.title).toEqual({
      absolute: "Surfline Alternative: Quiver vs Surfline",
    });
    expect(metadata.description).toBe(
      "Compare Quiver and Surfline on surf forecasts, cams, tide charts, session logs, accuracy transparency, and when each app fits.",
    );
    expect(
      `${"absolute" in title ? title.absolute : ""} ${metadata.description}`,
    ).not.toMatch(/\bfree\b/i);
  });

  it("keeps comparison copy out of free positioning", () => {
    const source = readFileSync(
      join(process.cwd(), "app/vs/surfline/page.tsx"),
      "utf8",
    );

    expect(source).toContain("Forecasts included");
    expect(source).toContain('text: "Included"');
    // The one sanctioned child-link href to the free variant is allowed;
    // the page's own positioning copy must still never say "free".
    expect(source.replaceAll("/vs/surfline/free", "")).not.toMatch(/\bfree\b/i);
  });
});
