import { buildRootStructuredDataGraph } from "@/lib/seo/root-structured-data";

describe("buildRootStructuredDataGraph", () => {
  it("returns an object with @context and @graph (not a top-level array)", () => {
    const jsonLd = buildRootStructuredDataGraph();

    expect(Array.isArray(jsonLd)).toBe(false);
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(Array.isArray(jsonLd["@graph"])).toBe(true);

    const graph = jsonLd["@graph"];
    expect(graph.length).toBeGreaterThanOrEqual(2);

    const graphTypes = graph.map((node) => (node as any)["@type"]);
    expect(graphTypes).toContain("Organization");
    expect(graphTypes).toContain("WebSite");

    // Ensure the root holds the context (cleaner + more compatible).
    expect((graph[0] as any)["@context"]).toBeUndefined();
  });
});

