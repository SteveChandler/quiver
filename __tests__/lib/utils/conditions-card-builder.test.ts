import { buildConditionsCards } from "@/lib/utils/conditions-card-builder";
import type { ConditionsData } from "@/types/conditions";

describe("buildConditionsCards", () => {
  const fullData: ConditionsData = {
    waveHeight: "3-5ft",
    wavePeriod: "12s",
    waveDirection: "SW",
    windSpeed: "8mph",
    windDirection: "NW",
    waterTemp: "62°F",
    tideStatus: "Rising",
    tideHeight: "3.2ft",
  };

  it("returns 5 cards with correct ids, labels, values, and iconTypes when all data present", () => {
    const cards = buildConditionsCards(fullData);
    expect(cards).toHaveLength(5);

    expect(cards[0]).toEqual({
      id: "waves",
      label: "Waves",
      value: "3-5ft",
      iconType: "waves",
    });
    expect(cards[1]).toEqual({
      id: "swell",
      label: "Swell",
      value: "12s SW",
      iconType: "swell",
    });
    expect(cards[2]).toEqual({
      id: "wind",
      label: "Wind",
      value: "8mph NW",
      iconType: "wind",
    });
    expect(cards[3]).toEqual({
      id: "water",
      label: "Water",
      value: "62°F",
      iconType: "water",
    });
    expect(cards[4]).toEqual({
      id: "tide",
      label: "Tide",
      value: "Rising 3.2ft",
      iconType: "tide",
      tideRising: true,
    });
  });

  it("returns 1 card when only waveHeight is present", () => {
    const cards = buildConditionsCards({ waveHeight: "2-3ft" });
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe("waves");
    expect(cards[0].value).toBe("2-3ft");
  });

  it("returns 0 cards when all fields are null or undefined", () => {
    const cards = buildConditionsCards({});
    expect(cards).toHaveLength(0);
  });

  it("returns 0 cards when all fields are empty strings", () => {
    const cards = buildConditionsCards({
      waveHeight: "",
      wavePeriod: "",
      windSpeed: "",
      waterTemp: "",
      tideStatus: "",
    });
    expect(cards).toHaveLength(0);
  });

  it("combines wavePeriod and waveDirection into swell value", () => {
    const cards = buildConditionsCards({
      wavePeriod: "14s",
      waveDirection: "NW",
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].value).toBe("14s NW");
  });

  it("uses just wavePeriod when waveDirection is absent", () => {
    const cards = buildConditionsCards({ wavePeriod: "10s" });
    expect(cards).toHaveLength(1);
    expect(cards[0].value).toBe("10s");
  });

  it("combines windSpeed and windDirection into wind value", () => {
    const cards = buildConditionsCards({
      windSpeed: "15mph",
      windDirection: "S",
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].value).toBe("15mph S");
  });

  it("uses just windSpeed when windDirection is absent", () => {
    const cards = buildConditionsCards({ windSpeed: "5mph" });
    expect(cards).toHaveLength(1);
    expect(cards[0].value).toBe("5mph");
  });

  it("combines tideStatus and tideHeight into tide value", () => {
    const cards = buildConditionsCards({
      tideStatus: "Falling",
      tideHeight: "1.5ft",
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].value).toBe("Falling 1.5ft");
  });

  it("uses just tideStatus when tideHeight is absent", () => {
    const cards = buildConditionsCards({ tideStatus: "Low" });
    expect(cards).toHaveLength(1);
    expect(cards[0].value).toBe("Low");
  });

  describe("tide rising detection", () => {
    it("detects 'Rising' as tideRising=true", () => {
      const cards = buildConditionsCards({ tideStatus: "Rising" });
      expect(cards[0].tideRising).toBe(true);
    });

    it("detects 'Incoming' as tideRising=true", () => {
      const cards = buildConditionsCards({ tideStatus: "Incoming" });
      expect(cards[0].tideRising).toBe(true);
    });

    it("detects 'Flood' as tideRising=true", () => {
      const cards = buildConditionsCards({ tideStatus: "Flood" });
      expect(cards[0].tideRising).toBe(true);
    });

    it("detects 'Falling' as tideRising=false", () => {
      const cards = buildConditionsCards({ tideStatus: "Falling" });
      expect(cards[0].tideRising).toBe(false);
    });

    it("detects 'Low' as tideRising=false", () => {
      const cards = buildConditionsCards({ tideStatus: "Low" });
      expect(cards[0].tideRising).toBe(false);
    });

    it("is case-insensitive for rising detection", () => {
      const cards = buildConditionsCards({ tideStatus: "RISING" });
      expect(cards[0].tideRising).toBe(true);
    });
  });

  it("does not skip value '0'", () => {
    const cards = buildConditionsCards({
      waveHeight: "0",
      windSpeed: "0",
      waterTemp: "0",
    });
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.value)).toEqual(["0", "0", "0"]);
  });

  it("skips null values but keeps other fields", () => {
    const cards = buildConditionsCards({
      waveHeight: null,
      wavePeriod: "12s",
      windSpeed: null,
      waterTemp: "60°F",
    });
    expect(cards).toHaveLength(2);
    expect(cards[0].id).toBe("swell");
    expect(cards[1].id).toBe("water");
  });
});
