import {
  formatSessionDate,
  formatSessionDescription,
  transformSessionFormStateToDbSchema,
} from "@/lib/utils/session-utils";
import type { SessionWithDetails } from "@/types/database";

function makeSession(
  overrides: Partial<SessionWithDetails> = {}
): SessionWithDetails {
  return {
    id: "s1",
    user_id: "u1",
    status: "completed",
    arrival_time: new Date("2025-01-15T06:30:00Z").toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    beach: {
      id: "b1",
      name: "Test Beach",
      lat: 0,
      lon: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    board: null,
    user: {
      id: "u1",
      full_name: null,
      email: null,
      phone_number: null,
      avatar_url: null,
      bio: null,
      location: null,
      experience_level: null,
      instagram: null,
      home_beach_id: null,
      notification_session_reminders: false,
      notification_community_replies: false,
      followers_count: 0,
      following_count: 0,
      is_mock: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    ...overrides,
  } as SessionWithDetails;
}

describe("session-utils", () => {
  test("formatSessionDate returns formatted date string", () => {
    const session = makeSession();
    const result = formatSessionDate(session);
    // Avoid timezone assumptions; check month/year and time presence
    expect(result).toMatch(/Jan\s\d{1,2},\s2025/);
    expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
  });

  test("formatSessionDate returns fallback when no date", () => {
    const session = makeSession({
      arrival_time: undefined as unknown as string,
    });
    const result = formatSessionDate(session);
    expect(result).toBe("No date set");
  });

  test("formatSessionDescription composes details", () => {
    const session = makeSession({
      notes: "Fun waves",
      wave_height_ft: 4,
      wind_speed_mph: 10,
      wind_direction: "offshore",
      water_temp: 65,
      wave_quality: 4,
      crowd_level: 2,
      goals: ["Practice turns", "Work on paddling"],
      duration_minutes: 95,
    });
    const result = formatSessionDescription(session);
    expect(result).toContain("Fun waves");
    expect(result).toContain("Conditions:");
    expect(result).toContain("Goals:");
    expect(result).toContain("Duration: 1h 35m");
  });

  test("formatSessionDescription returns fallback when empty", () => {
    const session = makeSession({});
    const result = formatSessionDescription(session);
    expect(result).toBe("No description provided.");
  });

  test("transformSessionFormStateToDbSchema maps wave chips to wave_characteristics, not goals", () => {
    const result = transformSessionFormStateToDbSchema({
      selectedBeach: "Test Beach",
      selectedBeachId: "beach-1",
      selectedDate: "2026-06-10",
      selectedTime: "07:00",
      selectedBoard: "",
      duration: "60m",
      waveQuality: "4",
      waterTemp: "",
      crowdLevel: "3",
      parkingEase: "",
      overallRating: "5",
      notes: "",
      photos: [],
      waveCharacteristics: ["fat", "closeouts"],
      waveTypes: ["fat", "closeouts"],
      waveHeight: undefined,
      windSpeed: undefined,
      windDirection: undefined,
      forecastAccuracy: undefined,
      tideHeight: undefined,
      tideStatus: undefined,
      ripCurrentObserved: "light",
      isPublic: true,
      isMuted: false,
      selectedGoals: [],
      skillRatings: {},
      sessionDecomposition: null,
    } as any);

    expect((result as any).wave_characteristics).toEqual(["fat", "closeouts"]);
    expect((result as any).rip_current_observed).toBe("light");
    expect(result.goals).toBeUndefined();
  });

  test("transformSessionFormStateToDbSchema omits tide height for recommendation logs", () => {
    const result = transformSessionFormStateToDbSchema({
      selectedBeach: "HB Cliffs",
      selectedBeachId: "beach-1",
      selectedDate: "2026-07-09",
      selectedTime: "07:00",
      selectedBoard: "",
      duration: "60m",
      waveQuality: "",
      waterTemp: "",
      crowdLevel: "",
      parkingEase: "",
      overallRating: "",
      notes: "",
      photos: [],
      waveCharacteristics: [],
      waveTypes: [],
      waveHeight: 4,
      windSpeed: undefined,
      windDirection: undefined,
      forecastAccuracy: undefined,
      recommendationId: "beach:beach-1:2026-07-09T14:00:00.000Z",
      forecastWaveHeightFt: 4,
      forecastTideStatus: "rising",
      waveHeightEdited: false,
      tideStatusEdited: false,
      tideHeight: 2.4,
      tideStatus: "rising",
      ripCurrentObserved: undefined,
      isPublic: true,
      isMuted: false,
      selectedGoals: [],
      skillRatings: {},
      sessionDecomposition: null,
    } as any);

    expect((result as any).tide_height_ft).toBeUndefined();
    expect((result as any).tide_status).toBe("rising");
    expect((result as any).wave_height_correct).toBe(true);
    expect((result as any).tide_status_correct).toBe(true);
  });
});
