/**
 * @jest-environment node
 */

import { readFileSync } from "fs";
import path from "path";

const llmsTxt = readFileSync(
  path.join(process.cwd(), "public/llms.txt"),
  "utf8",
);

describe("llms.txt crawler index", () => {
  it("labels the Learn section as a curated priority list, not a stale full count", () => {
    expect(llmsTxt).toContain("## Learn: Priority Surf Knowledge Targets");
    expect(llmsTxt).not.toMatch(/Learn: Surf Knowledge Base \(\d+ articles\)/);
  });

  it("includes the priority AEO target URLs", () => {
    expect(llmsTxt).toContain(
      "How to Read a Surf Report: https://www.quiversurf.app/learn/how-to-read-surf-conditions",
    );
    expect(llmsTxt).toContain(
      "How to Read a Surf Forecast: https://www.quiversurf.app/learn/how-to-read-surf-conditions",
    );
    expect(llmsTxt).toContain(
      "Surf Forecast Accuracy: https://www.quiversurf.app/learn/how-accurate-are-surf-forecasts",
    );
    expect(llmsTxt).toContain(
      "ML Surf Forecast: https://www.quiversurf.app/learn/how-quiver-calibrates-your-beach",
    );
    expect(llmsTxt).toContain(
      "Wetsuit Thickness Guide: https://www.quiversurf.app/learn/what-wetsuit-thickness-do-i-need",
    );
  });
});
