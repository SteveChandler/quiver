/**
 * Utility class for parsing various coordinate formats from NOAA data
 * Handles HTML entities, decimal formats, and DMS (degrees/minutes/seconds) formats
 */
export class CoordinateParser {
  /**
   * Validate that coordinates are within reasonable US bounds
   * Filters out fake/test stations with coordinates like [0,0] or overseas
   */
  static isValidUSCoordinates(coordinates: [number, number]): boolean {
    const [lat, lng] = coordinates;

    // US latitude range: roughly 24° to 71° N (including Alaska/Hawaii)
    // US longitude range: roughly -180° to -65° W
    return (
      lat >= 15 &&
      lat <= 72 && // Latitude bounds (includes Hawaii to Alaska)
      lng >= -180 &&
      lng <= -60 && // Longitude bounds (Alaska to Maine)
      !(lat === 0 && lng === 0) // Exclude obvious null coordinates
    );
  }

  /**
   * Parse NOAA coordinate format: "34.0 N 120.0 W" → [34.0, -120.0]
   * Handles both simple format and HTML-encoded format with entities
   * Matches Ruby coordinate parsing logic
   */
  static parseNOAAFormat(coordString: string): [number, number] | null {
    try {
      if (!coordString) return null;

      // Decode HTML entities first (&#176; = °, etc.)
      const decoded = this.decodeHTMLEntities(coordString);

      // Try multiple parsing strategies

      // Strategy 1: Simple format "34.0 N 120.0 W"
      const simpleResult = this.parseSimpleFormat(decoded);
      if (simpleResult) return simpleResult;

      // Strategy 2: Complex format with parentheses "(34°16'0" N 120°24'48" W)"
      const complexResult = this.parseComplexFormat(decoded);
      if (complexResult) return complexResult;

      // Strategy 3: Extract decimal numbers with regex
      const regexResult = this.parseWithRegex(decoded);
      if (regexResult) return regexResult;

      console.warn(`Failed to parse coordinates: "${coordString}"`);
      return null;
    } catch (error) {
      console.warn(
        `Coordinate parsing error: ${
          error instanceof Error ? error.message : "Unknown error"
        } for "${coordString}"`
      );
      return null;
    }
  }

  /**
   * Decode HTML entities in coordinate strings
   */
  private static decodeHTMLEntities(coordString: string): string {
    return coordString
      .replace(/&#176;/g, "°")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  /**
   * Parse simple format: "34.0 N 120.0 W"
   */
  private static parseSimpleFormat(decoded: string): [number, number] | null {
    const simpleParts = decoded.trim().split(/\s+/);
    if (simpleParts.length === 4) {
      let lat = parseFloat(simpleParts[0]);
      let lng = parseFloat(simpleParts[2]);

      if (!isNaN(lat) && !isNaN(lng)) {
        // Apply cardinal directions
        if (simpleParts[1].toUpperCase() === "S") lat *= -1;
        if (simpleParts[3].toUpperCase() === "W") lng *= -1;

        return [lat, lng];
      }
    }
    return null;
  }

  /**
   * Parse complex format with parentheses: "(34°16'0" N 120°24'48" W)"
   * Extract the first set of decimal coordinates before any parentheses
   */
  private static parseComplexFormat(decoded: string): [number, number] | null {
    const beforeParens = decoded.split("(")[0].trim();
    const decimalParts = beforeParens.split(/\s+/);

    if (decimalParts.length >= 4) {
      let lat = parseFloat(decimalParts[0]);
      let lng = parseFloat(decimalParts[2]);

      if (!isNaN(lat) && !isNaN(lng)) {
        // Apply cardinal directions
        if (decimalParts[1].toUpperCase() === "S") lat *= -1;
        if (decimalParts[3].toUpperCase() === "W") lng *= -1;

        return [lat, lng];
      }
    }
    return null;
  }

  /**
   * Parse using regex to extract decimal numbers with compass directions
   */
  private static parseWithRegex(decoded: string): [number, number] | null {
    const coordRegex =
      /(\d+\.?\d*)\s*[°]?\s*['\"]?\s*([NS])\s+(\d+\.?\d*)\s*[°]?\s*['\"]?\s*([EW])/i;
    const match = decoded.match(coordRegex);

    if (match) {
      let lat = parseFloat(match[1]);
      let lng = parseFloat(match[3]);

      if (!isNaN(lat) && !isNaN(lng)) {
        // Apply cardinal directions
        if (match[2].toUpperCase() === "S") lat *= -1;
        if (match[4].toUpperCase() === "W") lng *= -1;

        return [lat, lng];
      }
    }
    return null;
  }

  /**
   * Validate parsed coordinates for reasonableness
   */
  static validateCoordinates(lat: number, lng: number): boolean {
    return (
      !isNaN(lat) &&
      !isNaN(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      !(lat === 0 && lng === 0)
    );
  }

  /**
   * Parse coordinates and validate in one step
   */
  static parseAndValidate(coordString: string): [number, number] | null {
    const result = this.parseNOAAFormat(coordString);
    if (!result) return null;

    const [lat, lng] = result;
    if (!this.validateCoordinates(lat, lng)) return null;
    if (!this.isValidUSCoordinates(result)) return null;

    return result;
  }
}
