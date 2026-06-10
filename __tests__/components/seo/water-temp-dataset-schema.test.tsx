import React from "react";
import { render } from "@testing-library/react";
import { WaterTempDatasetSchema } from "@/components/seo/water-temp-dataset-schema";

function getJsonLdScripts(container: HTMLElement) {
  const scripts = container.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  return Array.from(scripts).map((s) => JSON.parse(s.textContent || "{}"));
}

describe("WaterTempDatasetSchema", () => {
  it("renders valid JSON-LD Dataset with complete water temp data", () => {
    const { container } = render(
      <WaterTempDatasetSchema
        cityOrBeachName="San Diego"
        state="CA"
        url="https://www.quiversurf.app/water-temp/san-diego"
        latitude={32.72}
        longitude={-117.15}
        tempF={62}
        wetsuitRec="3/2mm fullsuit"
      />
    );

    const schemas = getJsonLdScripts(container);
    expect(schemas).toHaveLength(1);

    const schema = schemas[0];
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("Dataset");
    expect(schema.name).toMatch(/San Diego Water Temperature/);
    expect(schema.url).toBe("https://www.quiversurf.app/water-temp/san-diego");
    expect(schema.temporalCoverage).toMatch(/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/);
    expect(schema.spatialCoverage.name).toBe("San Diego, CA");
    expect(schema.spatialCoverage.geo.latitude).toBe(32.72);
    expect(schema.spatialCoverage.geo.longitude).toBe(-117.15);
    expect(schema.provider.name).toBe("Quiver");
    expect(schema.license).toBe("https://creativecommons.org/licenses/by/4.0/");
  });

  it("includes variableMeasured entries for both temp and wetsuit", () => {
    const { container } = render(
      <WaterTempDatasetSchema
        cityOrBeachName="Malibu"
        state="CA"
        url="https://www.quiversurf.app/water-temp/malibu"
        tempF={68}
        wetsuitRec="2mm shorty"
      />
    );

    const schemas = getJsonLdScripts(container);
    const schema = schemas[0];
    expect(schema.variableMeasured).toHaveLength(2);

    const tempEntry = schema.variableMeasured.find(
      (e: { name: string }) => e.name === "Water Temperature"
    );
    expect(tempEntry).toMatchObject({
      value: "68",
      unitText: "°F",
    });

    const wetsuitEntry = schema.variableMeasured.find(
      (e: { name: string }) => e.name === "Wetsuit Recommendation"
    );
    expect(wetsuitEntry).toMatchObject({
      value: "2mm shorty",
    });
  });

  it("renders minimal Dataset without variableMeasured when data is null", () => {
    const { container } = render(
      <WaterTempDatasetSchema
        cityOrBeachName="Pipeline"
        state="HI"
        url="https://www.quiversurf.app/water-temp/pipeline"
        tempF={null}
        wetsuitRec={null}
      />
    );

    const schemas = getJsonLdScripts(container);
    const schema = schemas[0];
    expect(schema["@type"]).toBe("Dataset");
    expect(schema.variableMeasured).toBeUndefined();
  });

  it("returns null when cityOrBeachName is empty", () => {
    const { container } = render(
      <WaterTempDatasetSchema
        cityOrBeachName=""
        url="https://www.quiversurf.app/water-temp/unknown"
      />
    );

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(0);
  });

  it("returns null when url is empty", () => {
    const { container } = render(
      <WaterTempDatasetSchema
        cityOrBeachName="Santa Cruz"
        url=""
      />
    );

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(0);
  });

  it("includes only tempF entry when wetsuitRec is null", () => {
    const { container } = render(
      <WaterTempDatasetSchema
        cityOrBeachName="Trestles"
        state="CA"
        url="https://www.quiversurf.app/water-temp/trestles"
        tempF={65}
        wetsuitRec={null}
      />
    );

    const schemas = getJsonLdScripts(container);
    const schema = schemas[0];
    expect(schema.variableMeasured).toHaveLength(1);
    expect(schema.variableMeasured[0].name).toBe("Water Temperature");
  });

  it("rounds decimal water temperatures in Dataset JSON-LD", () => {
    const { container } = render(
      <WaterTempDatasetSchema
        cityOrBeachName="Huntington Beach"
        state="CA"
        url="https://www.quiversurf.app/water-temp/huntington-beach"
        tempF={64.4}
        wetsuitRec="3/2mm fullsuit"
      />
    );

    const schemas = getJsonLdScripts(container);
    const schema = schemas[0];
    const tempEntry = schema.variableMeasured.find(
      (entry: { name: string }) => entry.name === "Water Temperature"
    );

    expect(tempEntry.value).toBe("64");
    expect(schema.description).toContain("64°F");
    expect(schema.description).not.toContain("64.4°F");
  });

  it("omits geo from spatialCoverage when coordinates are not provided", () => {
    const { container } = render(
      <WaterTempDatasetSchema
        cityOrBeachName="Generic Beach"
        url="https://www.quiversurf.app/water-temp/generic-beach"
        tempF={70}
      />
    );

    const schemas = getJsonLdScripts(container);
    const schema = schemas[0];
    expect(schema.spatialCoverage.geo).toBeUndefined();
  });

  it("uses cityOrBeachName alone in spatialCoverage.name when state is not provided", () => {
    const { container } = render(
      <WaterTempDatasetSchema
        cityOrBeachName="Rincon"
        url="https://www.quiversurf.app/water-temp/rincon"
        tempF={74}
      />
    );

    const schemas = getJsonLdScripts(container);
    const schema = schemas[0];
    expect(schema.spatialCoverage.name).toBe("Rincon");
  });
});
