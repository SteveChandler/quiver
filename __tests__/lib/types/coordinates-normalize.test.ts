/**
 * Tests for coordinate normalization utilities
 *
 * @jest-environment node
 */

import { normalizeCoordinates } from "@/lib/types/coordinates";

describe("normalizeCoordinates()", () => {
  it("returns canonical { lat, lon } when provided", () => {
    expect(normalizeCoordinates({ lat: 32.75, lon: -117.25 })).toEqual({
      lat: 32.75,
      lon: -117.25,
    });
  });

  it("coerces numeric strings", () => {
    expect(normalizeCoordinates({ lat: "32.75", lon: "-117.25" })).toEqual({
      lat: 32.75,
      lon: -117.25,
    });
  });

  it("accepts legacy { lat, lng }", () => {
    expect(normalizeCoordinates({ lat: 32.75, lng: -117.25 })).toEqual({
      lat: 32.75,
      lon: -117.25,
    });
  });

  it("accepts verbose { latitude, longitude }", () => {
    expect(normalizeCoordinates({ latitude: 32.75, longitude: -117.25 })).toEqual({
      lat: 32.75,
      lon: -117.25,
    });
  });

  it("accepts DB legacy { center_lat, center_lng }", () => {
    expect(normalizeCoordinates({ center_lat: 32.75, center_lng: -117.25 })).toEqual({
      lat: 32.75,
      lon: -117.25,
    });
  });

  it("returns null when missing required keys", () => {
    expect(normalizeCoordinates({ lat: 32.75 })).toBeNull();
    expect(normalizeCoordinates({ lon: -117.25 })).toBeNull();
    expect(normalizeCoordinates(null)).toBeNull();
    expect(normalizeCoordinates("32.75,-117.25")).toBeNull();
  });

  it("warns in development when legacy keys are used", () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "development";

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const coords = normalizeCoordinates(
        { lat: 32.75, lng: -117.25 },
        { context: "test" }
      );
      expect(coords).toEqual({ lat: 32.75, lon: -117.25 });
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      (process.env as any).NODE_ENV = originalEnv;
    }
  });

  it("does not warn when warnOnLegacyKeys=false (even in development)", () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "development";

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const coords = normalizeCoordinates(
        { lat: 32.75, lng: -117.25 },
        { context: "test", warnOnLegacyKeys: false }
      );
      expect(coords).toEqual({ lat: 32.75, lon: -117.25 });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      (process.env as any).NODE_ENV = originalEnv;
    }
  });
});


