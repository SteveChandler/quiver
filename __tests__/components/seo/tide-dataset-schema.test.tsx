import React from "react";
import { render } from "@testing-library/react";
import { TideDatasetSchema } from "@/components/seo/tide-dataset-schema";
import { FES2022_CITATION, MODEL_TIDE_SOURCE } from "@/lib/services/tides/model-tides";

function getJsonLdScripts(container: HTMLElement) {
  const scripts = container.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  return Array.from(scripts).map((s) => JSON.parse(s.textContent || "{}"));
}

describe("TideDatasetSchema", () => {
  it("credits the FES2022 model and marks its predictions as unsuitable for navigation", () => {
    const { container } = render(
      <TideDatasetSchema
        cityOrBeachName="Cabo Pulmo"
        url="https://www.quiversurf.app/mexico/baja-california-sur/cabo-pulmo/tides"
        source={MODEL_TIDE_SOURCE}
        nextHighTime="2:30 PM"
        nextHighHeight={4.2}
      />
    );

    const schema = getJsonLdScripts(container)[0];
    expect(schema.creditText).toBe(FES2022_CITATION);
    expect(schema.measurementTechnique).toBe(
      "Harmonic tide prediction from the FES2022 global ocean tide model"
    );
    expect(schema.isBasedOn).toEqual({
      "@type": "Dataset",
      name: "FES2022 Tide",
      url: "https://www.aviso.altimetry.fr/en/data/products/auxiliary-products/global-tide-fes.html",
    });
    expect(schema.description).toContain("Modelled from the FES2022 global tide model.");
    expect(schema.description).toContain("Not for navigation.");
  });

  it("preserves the exact existing JSON for NOAA, null, and omitted sources", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    try {
      const props = {
        cityOrBeachName: "Santa Cruz",
        state: "CA",
        url: "https://www.quiversurf.app/tide/santa-cruz",
        latitude: 36.97,
        longitude: -122.03,
        nextHighTime: "2:30 PM",
        nextHighHeight: 4.2,
        nextLowTime: "8:45 AM",
        nextLowHeight: 0.8,
      };
      const { container, rerender } = render(<TideDatasetSchema {...props} />);
      const originalJson = container.querySelector('script[type="application/ld+json"]')?.textContent;

      rerender(<TideDatasetSchema {...props} source={null} />);
      const nullSourceJson = container.querySelector('script[type="application/ld+json"]')?.textContent;
      rerender(<TideDatasetSchema {...props} source="noaa" />);
      const noaaJson = container.querySelector('script[type="application/ld+json"]')?.textContent;

      expect(noaaJson).toBe(originalJson);
      expect(nullSourceJson).toBe(originalJson);
      expect(noaaJson).toMatchSnapshot();
      expect(JSON.parse(noaaJson || "{}")).not.toHaveProperty("creditText");
      expect(JSON.parse(noaaJson || "{}")).not.toHaveProperty("measurementTechnique");
      expect(JSON.parse(noaaJson || "{}")).not.toHaveProperty("isBasedOn");
    } finally {
      jest.useRealTimers();
    }
  });

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
    expect(highEntry).toMatchObject({ name: "High Tide" });
    expect(highEntry.value).toBe("5.1");
    expect(highEntry.unitText).toBe("ft");
    expect(highEntry.description).toContain("3:15 PM");

    const lowEntry = schema.variableMeasured.find(
      (e: { name: string }) => e.name === "Low Tide"
    );
    expect(lowEntry).toMatchObject({ name: "Low Tide" });
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
