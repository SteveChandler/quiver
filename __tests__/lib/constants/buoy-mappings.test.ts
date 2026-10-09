import { CDIP_NDBC_OVERLAPS } from "@/lib/constants/buoy-mappings";

describe("buoy-mappings", () => {
  describe("CDIP_NDBC_OVERLAPS constant", () => {
    test("contains expected Southern California stations", () => {
      expect(CDIP_NDBC_OVERLAPS["100"]).toBe("46225"); // Torrey Pines Outer
      expect(CDIP_NDBC_OVERLAPS["045"]).toBe("46242"); // Pt. Fermin Outer
      expect(CDIP_NDBC_OVERLAPS["157"]).toBe("46232"); // Point Loma South
    });

    test("contains expected Central California stations", () => {
      expect(CDIP_NDBC_OVERLAPS["094"]).toBe("46214"); // Point Reyes
      expect(CDIP_NDBC_OVERLAPS["029"]).toBe("46236"); // Harvest Platform
    });

    test("contains expected Northern California stations", () => {
      expect(CDIP_NDBC_OVERLAPS["168"]).toBe("46237"); // San Francisco Bar
      expect(CDIP_NDBC_OVERLAPS["142"]).toBe("46213"); // Cape Mendocino
    });

    test("has correct number of mappings", () => {
      const mappingCount = Object.keys(CDIP_NDBC_OVERLAPS).length;
      expect(mappingCount).toBeGreaterThanOrEqual(10);
    });
  });




});
