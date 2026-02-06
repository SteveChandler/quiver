import { getBeachLocation } from "@/lib/utils/beach-card-utils";
import type { Beach } from "@/types/database";

describe("getBeachLocation", () => {
  it("should return city and state when both are provided", () => {
    const beach = {
      id: "test-id",
      name: "Test Beach",
      city: "Huntington Beach",
      state: "CA",
      region: null,
    } as Beach;

    expect(getBeachLocation(beach)).toBe("Huntington Beach, CA");
  });

  it("should return city and state even when region is provided", () => {
    const beach = {
      id: "test-id",
      name: "Test Beach",
      city: "San Diego",
      state: "CA",
      region: "Southern California",
    } as Beach;

    expect(getBeachLocation(beach)).toBe("San Diego, CA");
  });

  it("should return only city when state is missing", () => {
    const beach = {
      id: "test-id",
      name: "Test Beach",
      city: "Waikiki",
      state: null,
      region: null,
    } as Beach;

    expect(getBeachLocation(beach)).toBe("Waikiki");
  });

  it("should return only state when city is missing", () => {
    const beach = {
      id: "test-id",
      name: "Test Beach",
      city: null,
      state: "CA",
      region: null,
    } as Beach;

    expect(getBeachLocation(beach)).toBe("CA");
  });

  it("should return region when city and state are missing", () => {
    const beach = {
      id: "test-id",
      name: "Test Beach",
      city: null,
      state: null,
      region: "Northern California",
    } as Beach;

    expect(getBeachLocation(beach)).toBe("Northern California");
  });

  it("should return 'California' as fallback when all location fields are missing", () => {
    const beach = {
      id: "test-id",
      name: "Test Beach",
      city: null,
      state: null,
      region: null,
    } as Beach;

    expect(getBeachLocation(beach)).toBe("California");
  });

  it("should work with Baja California state", () => {
    const beach = {
      id: "test-id",
      name: "Test Beach",
      city: "Rosarito",
      state: "Baja California",
      region: null,
    } as Beach;

    expect(getBeachLocation(beach)).toBe("Rosarito, Baja California");
  });
});
