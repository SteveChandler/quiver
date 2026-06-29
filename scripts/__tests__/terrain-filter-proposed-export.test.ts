import { parseCliArgs } from "../terrain-filter-proposed-export";

describe("terrain-filter-proposed-export", () => {
  it("parses input, output, and selected beach ids", () => {
    expect(
      parseCliArgs([
        "--input-json",
        "/tmp/full.json",
        "--output-json=/tmp/subset.json",
        "--beach-ids",
        "beach-1,beach-2",
      ])
    ).toEqual({
      inputJsonPath: "/tmp/full.json",
      outputJsonPath: "/tmp/subset.json",
      beachIds: ["beach-1", "beach-2"],
    });
  });

  it("requires explicit selected beach ids", () => {
    expect(() =>
      parseCliArgs([
        "--input-json",
        "/tmp/full.json",
        "--output-json",
        "/tmp/subset.json",
      ])
    ).toThrow("Missing --beach-ids");
  });

  it("rejects value flags without values", () => {
    expect(() => parseCliArgs(["--input-json", "--output-json"])).toThrow(
      "--input-json requires a value."
    );
    expect(() => parseCliArgs(["--input-json="])).toThrow(
      "--input-json requires a value."
    );
    expect(() =>
      parseCliArgs(["--input-json", "/tmp/full.json", "--output-json"])
    ).toThrow("--output-json requires a value.");
    expect(() =>
      parseCliArgs([
        "--input-json",
        "/tmp/full.json",
        "--output-json=",
      ])
    ).toThrow("--output-json requires a value.");
    expect(() =>
      parseCliArgs([
        "--input-json",
        "/tmp/full.json",
        "--output-json",
        "/tmp/subset.json",
        "--beach-ids",
      ])
    ).toThrow("--beach-ids requires a value.");
    expect(() =>
      parseCliArgs([
        "--input-json",
        "/tmp/full.json",
        "--output-json",
        "/tmp/subset.json",
        "--beach-id=",
      ])
    ).toThrow("--beach-id requires a value.");
  });

  it("rejects unknown arguments", () => {
    expect(() =>
      parseCliArgs([
        "--input-json",
        "/tmp/full.json",
        "--output-json",
        "/tmp/subset.json",
        "--beach-ids",
        "beach-1",
        "--beachs",
      ])
    ).toThrow("Unknown argument: --beachs.");
    expect(() =>
      parseCliArgs([
        "--input-json",
        "/tmp/full.json",
        "--output-json",
        "/tmp/subset.json",
        "--beach-ids",
        "beach-1",
        "/tmp/extra.json",
      ])
    ).toThrow("Unknown argument: /tmp/extra.json.");
  });

  it("rejects duplicate selected beach ids", () => {
    expect(() =>
      parseCliArgs([
        "--input-json",
        "/tmp/full.json",
        "--output-json=/tmp/subset.json",
        "--beach-ids",
        "beach-1,beach-2,beach-1",
      ])
    ).toThrow("Duplicate selected beach id(s): beach-1.");
  });
});
