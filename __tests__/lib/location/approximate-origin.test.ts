import { resolveApproximateOrigin } from "@/lib/location/approximate-origin";
import { extractIPLocation } from "@/lib/location/ip-location";

const ip = extractIPLocation(new Headers({
  "x-vercel-ip-city": "Cocoa%20Beach",
  "x-vercel-ip-region": "FL",
  "x-vercel-ip-country": "US",
  "x-vercel-ip-latitude": "28.32",
  "x-vercel-ip-longitude": "-80.61",
}));
const now = new Date("2026-09-21T12:00:00Z");

describe("resolveApproximateOrigin", () => {
  it("accepts raw Florida coordinates corroborated by the browser timezone", () => {
    expect(resolveApproximateOrigin({ ip, browserTimeZone: "America/New_York", now })).toEqual({
      lat: 28.32, lon: -80.61, source: "ip", label: "Cocoa Beach, FL",
    });
  });
  it.each(["Europe/London", "invalid", ""])("rejects contradictory or unusable timezone %s", (browserTimeZone) => {
    expect(resolveApproximateOrigin({ ip, browserTimeZone, now })).toBeNull();
  });
  it.each([{ ...ip, synthetic: true }, null, { ...ip, city: null }, { ...ip, city: " " }, { ...ip, latitude: null }, { ...ip, longitude: null }, { ...ip, latitude: NaN }, { ...ip, longitude: 181 }])("returns no invented location for %j", (invalidIp) => {
    expect(resolveApproximateOrigin({ ip: invalidIp, browserTimeZone: "America/New_York", now })).toBeNull();
  });
  it("accepts explicitly non-synthetic IP evidence", () => {
    expect(resolveApproximateOrigin({ ip: { ...ip, synthetic: false }, browserTimeZone: "America/New_York", now })?.source).toBe("ip");
  });
  it("uses the offset at now, including daylight saving time", () => {
    expect(resolveApproximateOrigin({ ip, browserTimeZone: "America/New_York", now: new Date("2026-01-21") })?.lat).toBe(28.32);
  });
});
