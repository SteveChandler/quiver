/** @jest-environment node */

import { FitBaseType, FitEncoder } from "fit-file-parser";
import { zipSync } from "fflate";
import { readTrackFile } from "@/lib/sessions/tracks/read-track-file";

const START = "2024-06-01T12:00:00.000Z";
const semicircles = (degrees: number): number => Math.round((degrees * 2 ** 31) / 180);

function fitBytes(withPositions = true): Uint8Array {
  const encoder = new FitEncoder();
  encoder.writeMessage(18, [
    { number: 253, size: 4, baseType: FitBaseType.Uint32,
      value: FitEncoder.toFitTimestamp(new Date(Date.parse(START) + 120_000)) },
    { number: 5, size: 1, baseType: FitBaseType.Enum, value: 38 },
    { number: 6, size: 1, baseType: FitBaseType.Enum, value: 0 },
  ]);
  encoder.writeMessage(23, [
    { number: 253, size: 4, baseType: FitBaseType.Uint32,
      value: FitEncoder.toFitTimestamp(new Date(START)) },
    { number: 2, size: 2, baseType: FitBaseType.Uint16, value: 1 },
    { number: 4, size: 2, baseType: FitBaseType.Uint16, value: 4655 },
    { number: 27, size: 9, baseType: FitBaseType.String, value: FitEncoder.string("Edge MTB") },
  ]);
  encoder.writeMessage(207, [{
    number: 1, size: 16, baseType: FitBaseType.Byte,
    value: Uint8Array.from("adb20c3398b5458981649e383a9ac1a1".match(/../g)!.map((byte) => parseInt(byte, 16))),
  }]);
  for (let index = 0; index < 101; index += 1) {
    encoder.writeMessage(20, [
      { number: 253, size: 4, baseType: FitBaseType.Uint32,
        value: FitEncoder.toFitTimestamp(new Date(Date.parse(START) + index * 1000)) },
      ...(withPositions ? [
        { number: 0, size: 4, baseType: FitBaseType.Sint32, value: semicircles(37 + index / 10000) },
        { number: 1, size: 4, baseType: FitBaseType.Sint32, value: semicircles(-122 - index / 10000) },
      ] : []),
      { number: 6, size: 2, baseType: FitBaseType.Uint16, value: 2000 },
      { number: 73, size: 4, baseType: FitBaseType.Uint32, value: 2500 },
      { number: 3, size: 1, baseType: FitBaseType.Uint8, value: 120 },
      { number: 13, size: 1, baseType: FitBaseType.Sint8, value: 18 },
      { number: 4, size: 1, baseType: FitBaseType.Uint8, value: 34 },
    ]);
  }
  return encoder.close();
}

function gpxAt(...times: string[]): Uint8Array {
  const points = times.map((time, index) =>
    `<trkpt lat="${37 + index / 1000}" lon="${-122 - index / 1000}"><time>${time}</time></trkpt>`
  ).join("");
  return new TextEncoder().encode(`<gpx version="1.1"><trk><trkseg>${points}</trkseg></trk></gpx>`);
}

describe("readTrackFile", () => {
  it("reads a FIT export inside a Garmin ZIP", () => {
    const track = readTrackFile(zipSync({ "1_ACTIVITY.fit": fitBytes() }), "1.zip");
    expect(track.meta.format).toBe("fit");
    expect(track.meta.sport).toBe("surfing");
    expect(track.meta.subSport).toBe("generic");
    expect(track.meta.recordedBy).toBe("Garmin Edge MTB / Dawn Patrol");
    expect(track.samples.length).toBeGreaterThan(100);
    expect(track.samples[0]).toEqual(expect.objectContaining({
      t: START,
      lat: expect.closeTo(37, 5),
      lon: expect.closeTo(-122, 5),
      speedMps: 2.5,
      hr: 120,
      tempC: 18,
      cadence: 34,
    }));
  });

  it("reads GPX trkpt time/lat/lon", () => {
    const track = readTrackFile(gpxAt(START, "2024-06-01T12:00:01Z", "2024-06-01T12:00:02Z"), "a.gpx");
    expect(track.meta).toEqual({ format: "gpx", sport: null, subSport: null, recordedBy: null,
      startedAt: START, endedAt: "2024-06-01T12:00:02.000Z" });
    expect(track.samples).toHaveLength(3);
    expect(track.samples[0]).toEqual({ t: START, lat: 37, lon: -122,
      speedMps: null, hr: null, tempC: null, cadence: null });
  });

  it("sniffs a raw FIT file independently of its filename", () => {
    expect(readTrackFile(fitBytes(), "download.bin").meta.format).toBe("fit");
  });

  it("reads GPX inside a ZIP", () => {
    const bytes = zipSync({ "activity.gpx": gpxAt(START) });
    expect(readTrackFile(bytes, "activity.zip").samples).toHaveLength(1);
  });

  it("rejects a file with no GPS", () => {
    expect(() => readTrackFile(fitBytes(false), "a.fit")).toThrow(expect.objectContaining({ code: "no_gps" }));
  });

  it.each(["2031-01-01T00:00:00Z", "2014-12-31T23:59:59Z"])("rejects an implausible first fix: %s", (time) => {
    expect(() => readTrackFile(gpxAt(time), "a.gpx", new Date("2026-10-17T00:00:00Z")))
      .toThrow(expect.objectContaining({ code: "bad_time" }));
  });

  it("rejects a track whose end precedes its start", () => {
    expect(() => readTrackFile(gpxAt("2024-06-01T12:00:01Z", START), "a.gpx"))
      .toThrow(expect.objectContaining({ code: "bad_time" }));
  });

  it("rejects unknown bytes", () => {
    expect(() => readTrackFile(new Uint8Array([1, 2, 3]), "x.bin"))
      .toThrow(expect.objectContaining({ code: "unsupported_format" }));
  });
});
