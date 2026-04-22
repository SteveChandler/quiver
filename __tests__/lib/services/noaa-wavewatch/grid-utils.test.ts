import { getOceanGridPoint } from '@/lib/services/noaa-wavewatch/grid-utils';

describe('getOceanGridPoint', () => {
  describe('Pacific coast', () => {
    it('shifts Oceanside (SGX region) west by 0.05°', () => {
      const result = getOceanGridPoint(33.1959, -117.3795);
      expect(result.lat).toBe(33.1959);
      expect(result.lon).toBeCloseTo(-117.3795 - 0.05, 10);
    });

    it('shifts Ocean Beach SF west', () => {
      const result = getOceanGridPoint(37.7594, -122.5107);
      expect(result.lat).toBe(37.7594);
      expect(result.lon).toBeCloseTo(-122.5607, 10);
    });

    it('shifts a Baja coordinate west (lat >= 22)', () => {
      const result = getOceanGridPoint(22.5, -109.7);
      expect(result.lat).toBe(22.5);
      expect(result.lon).toBeCloseTo(-109.75, 10);
    });

    it('shifts an Alaska / PNW coordinate west (lat <= 60)', () => {
      const result = getOceanGridPoint(57.8, -135.4);
      expect(result.lat).toBe(57.8);
      expect(result.lon).toBeCloseTo(-135.45, 10);
    });
  });

  describe('Atlantic coast', () => {
    it('shifts Outer Banks (NC) east by 0.05°', () => {
      const result = getOceanGridPoint(35.2505, -75.5288);
      expect(result.lat).toBe(35.2505);
      expect(result.lon).toBeCloseTo(-75.4788, 10);
    });

    it('shifts Montauk (NY) east', () => {
      const result = getOceanGridPoint(41.0362, -71.9535);
      expect(result.lat).toBe(41.0362);
      expect(result.lon).toBeCloseTo(-71.9035, 10);
    });

    it('shifts Cocoa Beach (FL east coast) east', () => {
      const result = getOceanGridPoint(28.3200, -80.6076);
      expect(result.lat).toBe(28.3200);
      expect(result.lon).toBeCloseTo(-80.5576, 10);
    });
  });

  describe('Gulf coast', () => {
    it('shifts Galveston (TX) south by 0.05°', () => {
      const result = getOceanGridPoint(29.2639, -94.8266);
      expect(result.lat).toBeCloseTo(29.2139, 10);
      expect(result.lon).toBe(-94.8266);
    });

    it('shifts Pensacola (FL panhandle) south', () => {
      const result = getOceanGridPoint(30.4084, -87.2119);
      expect(result.lat).toBeCloseTo(30.3584, 10);
      expect(result.lon).toBe(-87.2119);
    });
  });

  describe('Hawaii', () => {
    it('shifts Oahu (Waikiki) west by 0.05°', () => {
      const result = getOceanGridPoint(21.2793, -157.8294);
      expect(result.lat).toBe(21.2793);
      expect(result.lon).toBeCloseTo(-157.8794, 10);
    });

    it('shifts Maui west', () => {
      const result = getOceanGridPoint(20.7984, -156.3319);
      expect(result.lat).toBe(20.7984);
      expect(result.lon).toBeCloseTo(-156.3819, 10);
    });
  });

  describe('Default / passthrough (outside every region box)', () => {
    it('returns mid-Pacific (lat 10 south of our range) unchanged', () => {
      const result = getOceanGridPoint(10, -140);
      expect(result.lat).toBe(10);
      expect(result.lon).toBe(-140);
    });

    it('returns European coordinates unchanged', () => {
      const result = getOceanGridPoint(43.4832, -1.5586); // Biarritz
      expect(result.lat).toBe(43.4832);
      expect(result.lon).toBe(-1.5586);
    });

    it('returns Sydney AU (southern hemisphere) unchanged', () => {
      const result = getOceanGridPoint(-33.8688, 151.2093);
      expect(result.lat).toBe(-33.8688);
      expect(result.lon).toBe(151.2093);
    });

    it('returns an Atlantic longitude below the range (-60) unchanged', () => {
      // lon -60 is east of the Atlantic coast box (-82 to -65), so no shift.
      const result = getOceanGridPoint(35, -60);
      expect(result.lat).toBe(35);
      expect(result.lon).toBe(-60);
    });
  });
});
