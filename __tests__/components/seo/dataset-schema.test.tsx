import { render } from "@testing-library/react";

import { DatasetSchema } from "@/components/seo/dataset-schema";
import { makeDataset, station } from "../../lib/climatology/__fixtures__/dataset";

describe("DatasetSchema", () => {
  it("describes the downloadable CSV and only the stations actually used", () => {
    const dataset = makeDataset([40, 42, 45, 50, 48, 44, 52, 60, 70, 74, 66, 50], {
      stations: [station(), station({ id: "TRDF1", role: "wind", gate: "failed", pageUrl: "https://example.test/trdf1" })],
    });
    const { container } = render(<DatasetSchema dataset={dataset} csvPath="/data/surf-climatology/cocoa-beach.csv" />);
    const json = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}");

    expect(json["@type"]).toBe("Dataset");
    expect(json.name).toBe("Cocoa Beach monthly buoy statistics");
    expect(json.isBasedOn).toEqual(["https://www.ndbc.noaa.gov/station_page.php?station=41113"]);
    expect(json.temporalCoverage).toBe("2007-01-01/2025-12-31");
    expect(json.variableMeasured).not.toContain("Wind speed");
    expect(json.distribution).toEqual([
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: expect.stringMatching(/\/data\/surf-climatology\/cocoa-beach\.csv$/),
      },
    ]);
    expect(json.description.length).toBeGreaterThanOrEqual(50);
  });
});
