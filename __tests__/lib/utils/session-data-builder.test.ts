import {
  buildSessionPayload,
  parseDurationToMinutes,
  combineDateAndTime,
  type SessionPayloadInput,
} from "@/lib/utils/session-data-builder";

describe("session-data-builder", () => {
  const userId = "user-123";

  const fullInput: SessionPayloadInput = {
    selectedBeach: "Blacks Beach",
    selectedBeachId: "beach-456",
    selectedDate: "2026-02-12",
    selectedTime: "08:30",
    boardId: "board-789",
    notes: "Great session",
    duration: "2h30m",
    waveQuality: "4",
    waterTemp: "62",
    crowdLevel: "2",
    parkingEase: "3",
    overallRating: "5",
    // 6 condition fields
    waveHeight: 4.5,
    windSpeed: 8,
    windDirection: "NW",
    tideHeight: 3.2,
    tideStatus: "rising",
    forecastAccuracy: "accurate",
    sessionDecomposition: {
      version: 1,
      waves: true,
      vibe: true,
      skill_fit: "dialed",
      board_fit: "right",
    },
  };

  describe("buildSessionPayload - logged session", () => {
    it("includes all 6 condition fields when set", () => {
      const payload = buildSessionPayload(fullInput, userId);

      expect(payload.status).toBe("completed");

      // Verify ALL 6 condition fields are present
      expect(payload.wave_height_ft).toBe(4.5);
      expect(payload.wind_speed_mph).toBe(8);
      expect(payload.wind_direction).toBe("NW");
      expect(payload.tide_height_ft).toBe(3.2);
      expect(payload.tide_status).toBe("rising");
      expect(payload.forecast_accuracy).toBe("accurate");
    });

    it("includes the structured session fit signal when the picker is used", () => {
      const payload = buildSessionPayload(fullInput, userId);

      expect(payload.session_decomposition).toEqual({
        version: 1,
        waves: true,
        vibe: true,
        skill_fit: "dialed",
        board_fit: "right",
      });
    });

    it("writes null for session_decomposition when the picker is skipped", () => {
      const payload = buildSessionPayload(
        { selectedBeach: "Pacific Beach", sessionDecomposition: null },
        userId
      );

      expect(payload.session_decomposition).toBeNull();
    });

    it("normalizes the session fit signal before persistence", () => {
      const payload = buildSessionPayload(
        {
          selectedBeach: "Pacific Beach",
          sessionDecomposition: {
            version: 1,
            waves: true,
            crew: false,
            skill_fit: "dialed",
            board_fit: undefined,
          } as unknown as SessionPayloadInput["sessionDecomposition"],
        },
        userId
      );

      expect(payload.session_decomposition).toEqual({
        version: 1,
        waves: true,
        skill_fit: "dialed",
      });
    });

    it("includes rating and quality fields", () => {
      const payload = buildSessionPayload(fullInput, userId);

      expect(payload.duration_minutes).toBe(150);
      expect(payload.wave_quality).toBe(4);
      expect(payload.water_temp).toBe(62);
      expect(payload.crowd_level).toBe(2);
      expect(payload.parking_ease).toBe(3);
      expect(payload.rating).toBe(5);
    });

    it("omits condition fields when not provided", () => {
      const minimalInput: SessionPayloadInput = {
        selectedBeach: "Pacific Beach",
        selectedDate: "2026-02-12",
      };

      const payload = buildSessionPayload(minimalInput, userId);

      expect(payload.wave_height_ft).toBeUndefined();
      expect(payload.wind_speed_mph).toBeUndefined();
      expect(payload.wind_direction).toBeUndefined();
      expect(payload.tide_height_ft).toBeUndefined();
      expect(payload.tide_status).toBeUndefined();
      expect(payload.forecast_accuracy).toBeUndefined();
    });

    it("handles zero values for numeric condition fields", () => {
      const zeroInput: SessionPayloadInput = {
        selectedBeach: "Trestles",
        waveHeight: 0,
        windSpeed: 0,
        tideHeight: 0,
      };

      const payload = buildSessionPayload(zeroInput, userId);

      // Zero is a valid value and should be included
      expect(payload.wave_height_ft).toBe(0);
      expect(payload.wind_speed_mph).toBe(0);
      expect(payload.tide_height_ft).toBe(0);
    });

    it("handles water temp edge cases", () => {
      // Non-numeric water temp
      const badTemp: SessionPayloadInput = {
        selectedBeach: "Windansea",
        waterTemp: "warm",
      };
      const payload1 = buildSessionPayload(badTemp, userId);
      expect(payload1.water_temp).toBeUndefined();

      // Empty string water temp
      const emptyTemp: SessionPayloadInput = {
        selectedBeach: "Windansea",
        waterTemp: "",
      };
      const payload2 = buildSessionPayload(emptyTemp, userId);
      expect(payload2.water_temp).toBeUndefined();

      // Valid water temp
      const goodTemp: SessionPayloadInput = {
        selectedBeach: "Windansea",
        waterTemp: "58.5",
      };
      const payload3 = buildSessionPayload(goodTemp, userId);
      expect(payload3.water_temp).toBe(58.5);
    });

    it("uses arrivalTimeOverride when provided", () => {
      const overrideTime = "2026-02-12 14:00:00+00";
      const payload = buildSessionPayload(fullInput, userId, overrideTime);

      expect(payload.arrival_time).toBe(overrideTime);
    });
  });

  describe("parseDurationToMinutes", () => {
    it("parses hours and minutes", () => {
      expect(parseDurationToMinutes("2h30m")).toBe(150);
    });

    it("parses minutes only", () => {
      expect(parseDurationToMinutes("60m")).toBe(60);
    });

    it("parses hours only", () => {
      expect(parseDurationToMinutes("1h")).toBe(60);
    });

    it("returns undefined for empty string", () => {
      expect(parseDurationToMinutes("")).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(parseDurationToMinutes(undefined)).toBeUndefined();
    });
  });

  describe("buildSessionPayload - goals and skill ratings", () => {
    it("maps selectedGoals to goals column as string array", () => {
      const input: SessionPayloadInput = {
        selectedBeach: "Blacks Beach",
        selectedGoals: ["Pop-ups", "Cutbacks"],
      };
      const payload = buildSessionPayload(input, userId);
      expect(payload.goals).toEqual(["Pop-ups", "Cutbacks"]);
    });

    it("maps skillRatings to skill_ratings column as object", () => {
      const input: SessionPayloadInput = {
        selectedBeach: "Blacks Beach",
        skillRatings: { "Pop-ups": 4, Cutbacks: 3 },
      };
      const payload = buildSessionPayload(input, userId);
      expect(payload.skill_ratings).toEqual({ "Pop-ups": 4, Cutbacks: 3 });
    });

    it("omits goals when selectedGoals is empty array", () => {
      const input: SessionPayloadInput = {
        selectedBeach: "Blacks Beach",
        selectedGoals: [],
      };
      const payload = buildSessionPayload(input, userId);
      expect(payload.goals).toBeUndefined();
    });

    it("omits skill_ratings when skillRatings is empty object", () => {
      const input: SessionPayloadInput = {
        selectedBeach: "Blacks Beach",
        skillRatings: {},
      };
      const payload = buildSessionPayload(input, userId);
      expect(payload.skill_ratings).toBeUndefined();
    });

    it("preserves all existing fields unchanged when new fields added", () => {
      const input: SessionPayloadInput = {
        selectedBeach: "Blacks Beach",
        selectedBeachId: "beach-456",
        overallRating: "5",
        waveHeight: 4.5,
        selectedGoals: ["Pop-ups"],
        skillRatings: { "Pop-ups": 4 },
      };
      const payload = buildSessionPayload(input, userId);
      expect(payload.beach_name).toBe("Blacks Beach");
      expect(payload.beach_id).toBe("beach-456");
      expect(payload.rating).toBe(5);
      expect(payload.wave_height_ft).toBe(4.5);
      expect(payload.goals).toEqual(["Pop-ups"]);
      expect(payload.skill_ratings).toEqual({ "Pop-ups": 4 });
    });

    it("handles selectedGoals with skills but no ratings", () => {
      const input: SessionPayloadInput = {
        selectedBeach: "Blacks Beach",
        selectedGoals: ["Duck Dives"],
        skillRatings: {},
      };
      const payload = buildSessionPayload(input, userId);
      expect(payload.goals).toEqual(["Duck Dives"]);
      expect(payload.skill_ratings).toBeUndefined();
    });

  });

  describe("combineDateAndTime", () => {
    it("combines date and time into PostgreSQL format", () => {
      const result = combineDateAndTime("2026-02-12", "08:30");
      expect(result).toMatch(/2026-02-12 \d{2}:30:00\+00/);
    });

    it("uses start of day when time is missing", () => {
      const result = combineDateAndTime("2026-02-12");
      expect(result).toMatch(/2026-02-12 \d{2}:00:00\+00/);
    });

    it("returns undefined when date is missing", () => {
      expect(combineDateAndTime(undefined, "08:30")).toBeUndefined();
    });
  });
});
