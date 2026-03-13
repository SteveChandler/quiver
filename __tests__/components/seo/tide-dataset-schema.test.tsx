import React from "react";
import { render } from "@testing-library/react";
import { TideDatasetSchema } from "@/components/seo/tide-dataset-schema";

function getJsonLdScripts(container: HTMLElement) {
  const scripts = container.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  return Array.from(scripts).map((s) => JSON.parse(s.textContent || "{}"));
}

describe("TideDatasetSchema", () => {
  it("renders valid JSON-LD Dataset with complete tide data", () => {
    const { container } = render(
      <TideDatasetSchema
        cityOrBeachName="Santa Cruz"
        state="CA"
        url="https://www.quiversurf.app/tide/santa-cruz"
        latitude={36.97}
        longitude={-122.03}
        nextHighTime="2:30 PM"
        nextHighHeight={4.2}
        nextLowTime="8:45 AM"
        nextLowHeight={0.8}
      />
    );

    const schemas = getJsonLdScripts(container);
    expect(schemas).toHaveLength(1);

    const schema = schemas[0];
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("Dataset");
    expect(schema.name).toMatch(/Santa Cruz Tide Chart/);
    expect(schema.url).toBe("https://www.quiversurf.app/tide/santa-cruz");
    expect(schema.temporalCoverage).toMatch(/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/);
    expect(schema.spatialCoverage.name).toBe("Santa Cruz, CA");
    expect(schema.spatialCoverage.geo.latitude).toBe(36.97);
    expect(schema.spatialCoverage.geo.longitude).toBe(-122.03);
    expect(schema.provider.name).toBe("Quiver");
    expect(schema.license).toBe("https://creativecommons.org/licenses/by/4.0/");
  });

  it("includes variableMeasured entries for both high and low tide", () => {
    const { container } = render(
      <TideDatasetSchema
        cityOrBeachName="Malibu"
        state="CA"
        url="https://www.quiversurf.app/tide/malibu"
        nextHighTime="3:15 PM"
        nextHighHeight={5.1}
        nextLowTime="9:00 AM"
        nextLowHeight={1.2}
      />
    );

    const schemas = getJsonLdScripts(container);
    const schema = schemas[0];
    expect(schema.variableMeasured).toHaveLength(2);

    const highEntry = schema.variableMeasured.find(
      (e: { name: string }) => e.name === "High Tide"
    );
    expect(highEntry).toBeDefined();
    expect(highEntry.value).toBe("5.1");
    expect(highEntry.unitText).toBe("ft");
    expect(highEntry.description).toContain("3:15 PM");

    const lowEntry = schema.variableMeasured.find(
      (e: { name: string }) => e.name === "Low Tide"
    );
    expect(lowEntry).toBeDefined();
    expect(lowEntry.value).toBe("1.2");
    expect(lowEntry.unitText).toBe("ft");
    expect(lowEntry.description).toContain("9:00 AM");
  });

  it("renders minimal Dataset without variableMeasured when tide data is null", () => {
    const { container } = render(
      <TideDatasetSchema
        cityOrBeachName="Pipeline"
        state="HI"
        url="https://www.quiversurf.app/tide/pipeline"
        nextHighTime={null}
        nextHighHeight={null}
        nextLowTime={null}
        nextLowHeight={null}
      />
    );

    const schemas = getJsonLdScripts(container);
    const schema = schemas[0];
    expect(schema["@type"]).toBe("Dataset");
    expect(schema.variableMeasured).toBeUndefined();
  });

  it("returns null when cityOrBeachName is empty", () => {
    const { container } = render(
      <TideDatasetSchema
        cityOrBeachName=""
        url="https://www.quiversurf.app/tide/unknown"
      />
    );

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(0);
  });

  it("returns null when url is empty", () => {
    const { container } = render(
      <TideDatasetSchema
        cityOrBeachName="Santa Monica"
        url=""
      />
    );

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(0);
  });

  it("omits variableMeasured entry for a null high tide but keeps low tide", () => {
    const { container } = render(
      <TideDatasetSchema
        cityOrBeachName="Trestles"
        state="CA"
        url="https://www.quiversurf.app/tide/trestles"
        nextHighTime={null}
        nextHighHeight={null}
        nextLowTime="7:30 AM"
        nextLowHeight={0.5}
      />
    );

    const schemas = getJsonLdScripts(container);
    const schema = schemas[0];
    expect(schema.variableMeasured).toHaveLength(1);
    expect(schema.variableMeasured[0].name).toBe("Low Tide");
  });

  it("omits geo from spatialCoverage when coordinates are not provided", () => {
    const { container } = render(
      <TideDatasetSchema
        cityOrBeachName="Generic Beach"
        url="https://www.quiversurf.app/tide/generic-beach"
      />
    );

    const schemas = getJsonLdScripts(container);
    const schema = schemas[0];
    expect(schema.spatialCoverage.geo).toBeUndefined();
  });

  it("uses cityOrBeachName alone in spatialCoverage.name when state is not provided", () => {
    const { container } = render(
      <TideDatasetSchema
        cityOrBeachName="Rincon"
        url="https://www.quiversurf.app/tide/rincon"
      />
    );

    const schemas = getJsonLdScripts(container);
    const schema = schemas[0];
    expect(schema.spatialCoverage.name).toBe("Rincon");
  });
});
