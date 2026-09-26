import { getSurfClimatology } from "@/lib/climatology/get-surf-climatology";
import {
  buildDataBackedSeasonView,
  joinNames,
  seasonalDirectionMix,
  threeFootDaysShare,
} from "@/lib/climatology/season-view";
import { makeDataset, station, waveStats } from "./__fixtures__/dataset";

const SCORES: Array<number | null> = [40, 42, 45, 50, 48, 44, 52, 60, 70, 74, 66, 50];

describe("buildDataBackedSeasonView", () => {
  it("marks the peak band from the same scores it prints", () => {
    const view = buildDataBackedSeasonView(makeDataset(SCORES), 9);

    expect(view.hasClearSeason).toBe(true);
    expect(view.peakMonth?.name).toBe("October");
    expect(view.peakBand.map((m) => m.name)).toEqual(["September", "October", "November"]);
    expect(view.months.filter((m) => m.isPeak).map((m) => m.month)).toEqual([9, 10, 11]);
    expect(view.weekAnswer).toBe(
      "September scores 70/100 on the Cape Canaveral Nearshore buoy record. It's in the peak band, within 10 points of October.",
    );
  });

  it("says when the current month is the top month", () => {
    expect(buildDataBackedSeasonView(makeDataset(SCORES), 10).weekAnswer).toBe(
      "October scores 74/100 on the Cape Canaveral Nearshore buoy record. It's the highest-scoring month.",
    );
  });

  it("names the peak band when the current month is outside it", () => {
    expect(buildDataBackedSeasonView(makeDataset(SCORES), 1).weekAnswer).toBe(
      "January scores 40/100 on the Cape Canaveral Nearshore buoy record. The peak band runs September, October and November.",
    );
  });

  it("does not invent a score for a month without enough data", () => {
    const scores = [...SCORES];
    scores[2] = null;
    const view = buildDataBackedSeasonView(makeDataset(scores), 3);

    expect(view.current.score).toBeNull();
    expect(view.weekAnswer).toBe("There isn't enough Cape Canaveral Nearshore buoy data to score March.");
    expect(view.heroDetail).toBe("Not enough buoy data for March. Peak month: October.");
  });

  it("builds the hero detail from buoy readings with the station and distance", () => {
    expect(buildDataBackedSeasonView(makeDataset(SCORES), 9).heroDetail).toBe(
      "Buoy median 2.4 ft, typically 1.8–3.3 ft, at Cape Canaveral Nearshore, 7.7 km from Cocoa Beach Pier. Water 78°F. Peak month: October.",
    );
  });

  it("answers the FAQs from the dataset", () => {
    const view = buildDataBackedSeasonView(makeDataset(SCORES), 9);

    expect(view.bestMonthFaq).toBe(
      "October scores highest for Cocoa Beach on Quiver's buoy score (74/100), based on Cape Canaveral Nearshore readings from 2007 to 2025.",
    );
    expect(view.waterFaq).toBe(
      "At the Cape Canaveral Nearshore buoy, the median water temperature runs from 70°F in January to 81°F in December (2007–2025). Wetsuit: Spring suit (2mm) in January, Boardshorts in December.",
    );
    expect(view.yearRoundFaq).toBe(
      "7 of 12 months score 50 or more on Quiver's buoy score for Cocoa Beach. October scores highest.",
    );
  });

  it("finds the quietest month by small-day share", () => {
    expect(buildDataBackedSeasonView(makeDataset(SCORES), 9).quietMonth?.name).toBe("June");
  });

  it("keeps failed stations out of the comparison and wind slots", () => {
    const dataset = makeDataset(SCORES, {
      stations: [
        station(),
        station({ id: "46224", role: "comparison-waves", gate: "failed" }),
        station({ id: "TRDF1", role: "wind", gate: "passed" }),
      ],
    });
    const view = buildDataBackedSeasonView(dataset, 9);

    expect(view.comparison).toBeNull();
    expect(view.wind?.id).toBe("TRDF1");
    expect(view.failedStations.map((s) => s.id)).toEqual(["46224"]);
  });
});

describe("a city without a clear season", () => {
  const FLAT = [84, 81, 81, 84, 86, 88, 91, 88, 87, 88, 84, 83];

  it("shows no Peak badges and says the buoy doesn't pick a season", () => {
    const view = buildDataBackedSeasonView(makeDataset(FLAT), 1);

    expect(view.hasClearSeason).toBe(false);
    expect(view.scoreRange).toEqual({ min: 81, max: 91 });
    expect(view.months.some((m) => m.isPeak)).toBe(false);
    expect(view.peakBand).toEqual([]);
    expect(view.peakMonth?.name).toBe("July");
    expect(view.weekAnswer).toBe(
      "January scores 84/100 on the Cape Canaveral Nearshore buoy record. Every month scores within 10 points of July, the highest, so the buoy doesn't single out a season.",
    );
    expect(view.heroDetail.endsWith("Highest month: July.")).toBe(true);
    expect(view.bestMonthFaq).toBe(
      "July scores highest for Cocoa Beach on Quiver's buoy score (91/100), but every month scores between 81 and 91, so the buoy record doesn't pick a season.",
    );
  });

  it("words the top month itself without a band", () => {
    expect(buildDataBackedSeasonView(makeDataset(FLAT), 7).weekAnswer).toBe(
      "July scores 91/100 on the Cape Canaveral Nearshore buoy record. It's the highest-scoring month, and every month scores within 10 points of it.",
    );
  });
});

describe("seasonalDirectionMix", () => {
  it("weights each month by its valid hours", () => {
    const dataset = makeDataset(SCORES);
    dataset.months[5].waves = waveStats({ validHours: 1000, directionMix: { N: 0, NE: 0, E: 0, SE: 0, S: 1, SW: 0, W: 0, NW: 0 } });
    dataset.months[6].waves = waveStats({ validHours: 3000, directionMix: { N: 0, NE: 0, E: 0, SE: 0, S: 0, SW: 1, W: 0, NW: 0 } });
    dataset.months[7].waves = null;

    expect(seasonalDirectionMix(dataset, "waves", [6, 7, 8])).toEqual({
      N: 0, NE: 0, E: 0, SE: 0, S: 0.25, SW: 0.75, W: 0, NW: 0,
    });
    expect(seasonalDirectionMix(dataset, "comparison-waves", [6, 7, 8])).toBeNull();
  });
});

describe("threeFootDaysShare", () => {
  it("sums the sectors and weights months by observed days", () => {
    const dataset = makeDataset([40, 42, 45, 50, 48, 44, 52, 60, 70, 74, 66, 50]);
    dataset.months[5].waves = waveStats({ observedDays: 100, threeFootDaysBySector: { N: 0, NE: 0, E: 0, SE: 0, S: 0.2, SW: 0.1, W: 0, NW: 0 } });
    dataset.months[6].waves = waveStats({ observedDays: 300, threeFootDaysBySector: { N: 0, NE: 0, E: 0, SE: 0, S: 0.1, SW: 0, W: 0.3, NW: 0 } });
    dataset.months[7].waves = null;

    // (0.3 x 100 + 0.1 x 300) / 400 = 0.15
    expect(threeFootDaysShare(dataset, ["S", "SW"], [6, 7, 8])).toBe(0.15);
    expect(threeFootDaysShare(dataset, ["S"], [8])).toBeNull();
  });
});

describe("joinNames", () => {
  it("joins with commas and a final and", () => {
    expect(joinNames(["May"])).toBe("May");
    expect(joinNames(["May", "June"])).toBe("May and June");
    expect(joinNames(["May", "June", "July"])).toBe("May, June and July");
  });
});

describe("getSurfClimatology", () => {
  it("loads the committed datasets and nothing else", () => {
    for (const slug of ["cocoa-beach", "newport-beach", "honolulu"]) {
      const dataset = getSurfClimatology(slug);
      expect(dataset?.citySlug).toBe(slug);
      expect(dataset?.months).toHaveLength(12);
    }
    expect(getSurfClimatology("san-diego")).toBeNull();
  });

  it("keeps every committed dataset's Peak badges consistent with its scores", () => {
    for (const slug of ["cocoa-beach", "newport-beach", "honolulu"]) {
      const dataset = getSurfClimatology(slug);
      if (!dataset) throw new Error(`missing ${slug}`);
      const view = buildDataBackedSeasonView(dataset, 1);
      const top = Math.max(...view.months.flatMap((m) => (m.score === null ? [] : [m.score])));
      for (const month of view.months) {
        expect(month.isPeak).toBe(view.hasClearSeason && month.score !== null && month.score >= top - 10);
      }
    }
  });
});
