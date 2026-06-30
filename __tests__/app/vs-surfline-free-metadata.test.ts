import { metadata } from "@/app/vs/surfline/free/page";
import { metadata as rewriteTargetMetadata } from "@/app/seo-pages/vs-surfline-free/page";

describe("/vs/surfline/free metadata", () => {
  it("targets the free-surfline-alternative query", () => {
    expect(metadata.title).toBe("Free Surfline Alternative: Quiver");
    expect(String(metadata.description)).toMatch(/free/i);
    expect(String(metadata.description)).toMatch(/no subscription/i);
  });

  it("canonicalizes to /vs/surfline/free (not /vs/surfline)", () => {
    const canonical = String(metadata.alternates?.canonical ?? "");
    expect(canonical).toMatch(/\/vs\/surfline\/free$/);
  });

  it("keeps the proxy rewrite target backed by the same canonical metadata", () => {
    const canonical = String(
      rewriteTargetMetadata.alternates?.canonical ?? "",
    );

    expect(canonical).toMatch(/\/vs\/surfline\/free$/);
  });

  it("includes free-intent keywords", () => {
    expect(metadata.keywords).toEqual(
      expect.arrayContaining(["free surfline alternative"]),
    );
  });
});
