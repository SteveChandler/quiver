import { readFileSync } from "node:fs";
import { join } from "node:path";

import { metadata } from "@/app/vs/surfline/free/page";

describe("/vs/surfline/free metadata", () => {
  it("targets the free-surfline-alternative query", () => {
    expect(metadata.title).toEqual({ absolute: "Free Surfline Alternative: Quiver" });
    expect(String(metadata.description)).toMatch(/free/i);
    expect(String(metadata.description)).toMatch(/no subscription/i);
  });

  it("canonicalizes to /vs/surfline/free (not /vs/surfline)", () => {
    const canonical = String(metadata.alternates?.canonical ?? "");
    expect(canonical).toMatch(/\/vs\/surfline\/free$/);
  });

  it("includes free-intent keywords", () => {
    expect(metadata.keywords).toEqual(
      expect.arrayContaining(["free surfline alternative"]),
    );
  });

  it("positions Quiver as a free alternative in the short answer", () => {
    const source = readFileSync(
      join(process.cwd(), "app/vs/surfline/free/page-content.tsx"),
      "utf8",
    );

    expect(source).toContain("Yes — Quiver is a free Surfline alternative");
    expect(source).not.toMatch(/free[- ]to[- ]browse/i);
  });
});
