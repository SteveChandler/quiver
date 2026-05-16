import { buildZineMapScene } from "@/components/beach-detail/zine/map-doodle-scene";
import type { ZineMapSceneInput } from "@/components/beach-detail/zine/map-doodle-scene";

describe("buildZineMapScene", () => {
  const baseInput = {
    beachName: "Ocean Beach Pier",
    locationName: "San Diego, CA",
    lat: 32.7503,
    lon: -117.2534,
    aspectDeg: 270,
    breakType: "Pier",
    features: ["Pier", "Beachbreak"],
  };
  const cueCases: Array<[string, ZineMapSceneInput]> = [
    ["pier", { beachName: "Ocean Beach Pier", breakType: "Beach Break" }],
    ["jetty", { beachName: "Westport Jetty", breakType: "Jetty" }],
    ["reef", { beachName: "Seaside Reef", breakType: "Reef" }],
    ["point", { beachName: "Malibu First Point", breakType: "Point" }],
    ["inlet", { beachName: "Manasquan Inlet", features: ["river mouth"] }],
    ["sandbars", { beachName: "Moonlight Beach", breakType: "Beach Break" }],
  ];

  it("returns the same scene for the same beach input", () => {
    const first = buildZineMapScene(baseInput);
    const second = buildZineMapScene(baseInput);

    expect(second).toEqual(first);
  });

  it("varies coastline geometry by aspect direction", () => {
    const westFacing = buildZineMapScene({ ...baseInput, aspectDeg: 270 });
    const southFacing = buildZineMapScene({ ...baseInput, aspectDeg: 180 });
    const eastFacing = buildZineMapScene({ ...baseInput, aspectDeg: 90 });

    expect(southFacing.coastPath).not.toEqual(westFacing.coastPath);
    expect(eastFacing.oceanSide).toBe("right");
    expect(westFacing.oceanSide).toBe("left");
  });

  it.each(cueCases)(
    "infers the %s cue from beach metadata",
    (expectedCue, override) => {
      const scene = buildZineMapScene({
        ...baseInput,
        beachName: override.beachName,
        breakType: override.breakType ?? null,
        features: override.features ?? null,
      });

      expect(scene.cue).toBe(expectedCue);
    },
  );

  it("uses a safe fallback when aspect or coordinates are missing", () => {
    const scene = buildZineMapScene({
      beachName: "Mystery Beach",
      locationName: "Field",
      lat: null,
      lon: null,
      aspectDeg: null,
      breakType: null,
      features: null,
    });

    expect(scene.oceanSide).toBe("left");
    expect(scene.marker).toEqual({ x: 130, y: 165 });
    expect(scene.coastPath).toContain("M");
    expect(scene.landPath).toContain("400,240");
  });
});
