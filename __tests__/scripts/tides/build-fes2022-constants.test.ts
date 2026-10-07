import { buildCatalog, type RawExtraction } from "../../../scripts/tides/build-fes2022-constants";
import fixture from "../../fixtures/tides/noaa-9410170-harcon.json";

describe("buildCatalog", () => {
  it("writes only beaches with stable order, precision, and an MLLW datum", () => {
    const constituents = fixture.HarmonicConstituents.map(({ name, amplitude, phase_GMT }) => ({
      name,
      amplitudeM: amplitude,
      phaseDeg: phase_GMT,
    }));
    const raw: RawExtraction = {
      model: "FES2022",
      points: {
        beach: { kind: "beach", constituents: [{ ...constituents[0], amplitudeM: 0.542123456, phaseDeg: 143.300009 }, ...constituents.slice(1)] },
        reference: { kind: "reference", constituents },
      },
      unresolved: [],
    };
    const catalog = buildCatalog(raw);
    expect(Object.keys(catalog)).toEqual(["model", "citation", "beaches"]);
    expect(catalog.model).toBe("FES2022");
    expect(catalog.citation).toMatch(/FES2022/);
    expect(Object.keys(catalog.beaches)).toEqual(["beach"]);
    expect(catalog.beaches.beach.constituents.map(({ name }) => name)).toEqual(constituents.map(({ name }) => name));
    expect(catalog.beaches.beach.constituents[0]).toEqual({ name: "M2", amplitudeM: 0.54212, phaseDeg: 143.30001 });
    expect(catalog.beaches.beach.mllwOffsetM).toBeCloseTo(0.897, 1);
    expect(Math.abs(catalog.beaches.beach.mllwOffsetM - 0.897)).toBeLessThan(0.03);
    expect(buildCatalog(raw)).toEqual(catalog);
  });
});
