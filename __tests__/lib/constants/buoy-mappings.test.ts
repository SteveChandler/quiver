import {
  CDIP_NDBC_OVERLAPS,
  isNDBCDuplicateOfCDIP,
  getCDIPStationForNDBC,
  getNDBCStationForCDIP,
} from "@/lib/constants/buoy-mappings";

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

  describe("isNDBCDuplicateOfCDIP", () => {
    test("returns true for known overlapping NDBC stations", () => {
      expect(isNDBCDuplicateOfCDIP("46225")).toBe(true); // Torrey Pines
      expect(isNDBCDuplicateOfCDIP("46242")).toBe(true); // Pt. Fermin
      expect(isNDBCDuplicateOfCDIP("46232")).toBe(true); // Point Loma
      expect(isNDBCDuplicateOfCDIP("46214")).toBe(true); // Point Reyes
      expect(isNDBCDuplicateOfCDIP("46237")).toBe(true); // SF Bar
    });

    test("returns false for NDBC-only stations", () => {
      expect(isNDBCDuplicateOfCDIP("46011")).toBe(false); // Santa Maria
      expect(isNDBCDuplicateOfCDIP("46025")).toBe(false); // Catalina
      expect(isNDBCDuplicateOfCDIP("46028")).toBe(false); // Cape San Martin
      expect(isNDBCDuplicateOfCDIP("46047")).toBe(false); // Tanner Bank
    });

    test("returns false for invalid or empty IDs", () => {
      expect(isNDBCDuplicateOfCDIP("")).toBe(false);
      expect(isNDBCDuplicateOfCDIP("invalid")).toBe(false);
      expect(isNDBCDuplicateOfCDIP("99999")).toBe(false);
    });

    test("handles CDIP IDs (should return false)", () => {
      // CDIP IDs are not NDBC IDs
      expect(isNDBCDuplicateOfCDIP("100")).toBe(false);
      expect(isNDBCDuplicateOfCDIP("045")).toBe(false);
    });
  });

  describe("getCDIPStationForNDBC", () => {
    test("returns CDIP station ID for overlapping NDBC stations", () => {
      expect(getCDIPStationForNDBC("46225")).toBe("100"); // Torrey Pines
      expect(getCDIPStationForNDBC("46242")).toBe("045"); // Pt. Fermin
      expect(getCDIPStationForNDBC("46232")).toBe("157"); // Point Loma
      expect(getCDIPStationForNDBC("46214")).toBe("094"); // Point Reyes
      expect(getCDIPStationForNDBC("46237")).toBe("168"); // SF Bar
    });

    test("returns null for NDBC-only stations", () => {
      expect(getCDIPStationForNDBC("46011")).toBeNull();
      expect(getCDIPStationForNDBC("46025")).toBeNull();
      expect(getCDIPStationForNDBC("46028")).toBeNull();
    });

    test("returns null for invalid inputs", () => {
      expect(getCDIPStationForNDBC("")).toBeNull();
      expect(getCDIPStationForNDBC("invalid")).toBeNull();
      expect(getCDIPStationForNDBC("99999")).toBeNull();
    });
  });

  describe("getNDBCStationForCDIP", () => {
    test("returns NDBC station ID for overlapping CDIP stations", () => {
      expect(getNDBCStationForCDIP("100")).toBe("46225"); // Torrey Pines
      expect(getNDBCStationForCDIP("045")).toBe("46242"); // Pt. Fermin
      expect(getNDBCStationForCDIP("157")).toBe("46232"); // Point Loma
      expect(getNDBCStationForCDIP("094")).toBe("46214"); // Point Reyes
      expect(getNDBCStationForCDIP("168")).toBe("46237"); // SF Bar
    });

    test("returns null for CDIP-only stations", () => {
      expect(getNDBCStationForCDIP("201")).toBeNull(); // CDIP only
      expect(getNDBCStationForCDIP("999")).toBeNull();
    });

    test("returns null for invalid inputs", () => {
      expect(getNDBCStationForCDIP("")).toBeNull();
      expect(getNDBCStationForCDIP("invalid")).toBeNull();
    });
  });

  describe("bidirectional mapping consistency", () => {
    test("all mappings are bidirectionally consistent", () => {
      for (const [cdipId, ndbcId] of Object.entries(CDIP_NDBC_OVERLAPS)) {
        // CDIP -> NDBC -> CDIP should return original
        expect(getNDBCStationForCDIP(cdipId)).toBe(ndbcId);
        expect(getCDIPStationForNDBC(ndbcId)).toBe(cdipId);

        // isNDBCDuplicateOfCDIP should return true for all NDBC IDs
        expect(isNDBCDuplicateOfCDIP(ndbcId)).toBe(true);
      }
    });
  });
});
