/** @jest-environment node */

import obFixture from "@/__tests__/fixtures/session-tracks/ob-2026-10-17.json";
import watchFixture from "@/__tests__/fixtures/session-tracks/watch-ob-2026-10-17.json";
import { parseQuiverWatch } from "@/lib/sessions/tracks/parse-quiver-watch";
import { readTrackFile } from "@/lib/sessions/tracks/read-track-file";
import type { NormalizedTrack } from "@/lib/sessions/tracks/types";
import { encodeWatchTrack } from "./watch-encode";

const original = obFixture.track as unknown as NormalizedTrack;
const watchFile = encodeWatchTrack(original);

describe("quiver_watch track format", () => {
  it("keeps the committed watch fixture generated from the offset JSON track", () => {
    expect(watchFixture).toEqual(watchFile);
    expect(parseQuiverWatch(watchFixture).samples).toHaveLength(original.samples.length);
  });

  it("round trips every offset OB sample within watch precision", () => {
    const track = parseQuiverWatch(watchFile);
    expect(track.samples).toHaveLength(original.samples.length);
    expect(track.meta).toEqual({
      format: "quiver_watch",
      sport: "surfing",
      subSport: null,
      recordedBy: "Quiver for Garmin · Forerunner 165",
      startedAt: original.meta.startedAt,
      endedAt: original.meta.endedAt,
    });
    expect(track.extras).toEqual({ rating: 4, deviceName: "Forerunner 165" });
    for (let index = 0; index < original.samples.length; index += 1) {
      const expected = original.samples[index];
      const actual = track.samples[index];
      expect(actual.t).toBe(expected.t);
      expect(actual.lat === null).toBe(expected.lat === null);
      expect(actual.lat === null ? 0 : Math.abs(actual.lat - expected.lat!)).toBeLessThanOrEqual(1e-7);
      expect(actual.lon === null).toBe(expected.lon === null);
      expect(actual.lon === null ? 0 : Math.abs(actual.lon - expected.lon!)).toBeLessThanOrEqual(1e-7);
      expect(actual.speedMps === null).toBe(expected.speedMps === null);
      expect(actual.speedMps === null ? 0 : Math.abs(actual.speedMps - expected.speedMps!))
        .toBeLessThanOrEqual(0.01);
      expect(actual.hr).toBe(expected.hr);
      expect(actual.tempC).toBe(expected.tempC);
      expect(actual.cadence).toBeNull();
    }
  });

  it("keeps null-fix rows without replacing them with the previous fix", () => {
    const track = parseQuiverWatch(watchFile);
    const gap = original.samples.findIndex((sample, index) => index > 0
      && sample.lat === null && original.samples[index - 1].lat !== null);
    expect(gap).toBeGreaterThan(0);
    expect(track.samples[gap]).toEqual(expect.objectContaining({ lat: null, lon: null }));
  });

  it("resumes deltas from the last fix after a gap", () => {
    const track = parseQuiverWatch(watchFile);
    const gap = original.samples.findIndex((sample, index) => index > 0
      && sample.lat === null && original.samples[index - 1].lat !== null);
    const resumed = original.samples.findIndex((sample, index) => index > gap
      && sample.lat !== null && original.samples[index - 1].lat === null);
    expect(resumed).toBeGreaterThan(gap);
    const chunkStart = Math.floor(resumed / 300) * 300;
    const previousFix = original.samples.findLastIndex((sample, index) => index >= chunkStart
      && index < resumed && sample.lat !== null && sample.lon !== null);
    expect(previousFix).toBeGreaterThanOrEqual(chunkStart);
    const row = watchFile.chunks[Math.floor(resumed / 300)].rows[resumed % 300];
    expect(row[1]).toBe(Math.round(original.samples[resumed].lat! * 1e7)
      - Math.round(original.samples[previousFix].lat! * 1e7));
    expect(row[2]).toBe(Math.round(original.samples[resumed].lon! * 1e7)
      - Math.round(original.samples[previousFix].lon! * 1e7));
    expect(track.samples[resumed].lat).toBeCloseTo(original.samples[resumed].lat!, 7);
    expect(track.samples[resumed].lon).toBeCloseTo(original.samples[resumed].lon!, 7);
  });

  it("dispatches JSON watch files through readTrackFile", () => {
    const bytes = new TextEncoder().encode(`  ${JSON.stringify(watchFile)}`);
    const track = readTrackFile(bytes, "garmin.json", new Date("2026-10-18T00:00:00Z"));
    expect(track.meta.format).toBe("quiver_watch");
    expect(track.samples).toHaveLength(original.samples.length);
  });

  it("rejects a missing chunks array as corrupt", () => {
    expect(() => parseQuiverWatch({ quiverWatch: 1, header: watchFile.header }))
      .toThrow(expect.objectContaining({ code: "corrupt" }));
  });

  it("rejects a malformed row and mismatched chunk count as corrupt", () => {
    const smallFile = encodeWatchTrack({ ...original, samples: original.samples.slice(0, 160) });
    const malformed = { ...smallFile, chunks: [{ ...smallFile.chunks[0], rows: [[0, 0, 0]] }] };
    expect(() => parseQuiverWatch(malformed)).toThrow(expect.objectContaining({ code: "corrupt" }));
    expect(() => parseQuiverWatch({ ...smallFile, header: { ...smallFile.header, chunkCount: 2 } }))
      .toThrow(expect.objectContaining({ code: "corrupt" }));
  });

  it("reports malformed watch JSON as corrupt", () => {
    expect(() => readTrackFile(new TextEncoder().encode('{"quiverWatch":1,'), "garmin.json"))
      .toThrow(expect.objectContaining({ code: "corrupt" }));
  });

  it("rejects a track with only null positions as no_gps", () => {
    const file = encodeWatchTrack({ ...original, samples: original.samples.slice(0, 2) });
    expect(file.chunks[0].lat0).toBeNull();
    expect(() => parseQuiverWatch(file)).toThrow(expect.objectContaining({ code: "no_gps" }));
  });
});
