import { isWithinNwsCoverage } from "@/lib/utils/nws-coverage";

describe("isWithinNwsCoverage", () => {
  it.each([
    ["San Diego", 32.7, -117.25],
    ["Huntington Beach", 33.65, -118.0],
    ["Outer Banks", 35.9, -75.6],
    ["Brownsville", 25.95, -97.15],
    ["Key West", 24.55, -81.8],
    ["Oahu", 21.6, -158.1],
    ["Anchorage", 61.2, -149.9],
    ["San Juan", 18.46, -66.1],
  ])("covers %s", (_name, lat, lon) => {
    expect(isWithinNwsCoverage(lat, lon)).toBe(true);
  });

  it.each([
    ["Cabo (Baja)", 23.174, -109.476],
    ["Tijuana coast south", 32.3, -117.1],
    ["Ensenada", 31.85, -116.7],
    ["Mazatlan", 23.2, -106.4],
    ["Tampico", 22.2, -97.8],
    ["Matamoros", 25.8, -97.5],
    ["Tofino", 49.15, -125.9],
    ["Costa Rica", 9.9, -85.8],
    ["NaN", Number.NaN, -100],
  ])("skips %s", (_name, lat, lon) => {
    expect(isWithinNwsCoverage(lat, lon)).toBe(false);
  });
});
