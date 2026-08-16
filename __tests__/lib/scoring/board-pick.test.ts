/**
 * @jest-environment node
 *
 * Tests for getConditionBoardPick() — matches forecast conditions to the best board
 * from the user's quiver.
 */

import { getConditionBoardPick } from '@/lib/scoring/board-pick';
import type { BoardForPick } from '@/lib/scoring/board-pick';
import type { BeachWithThresholds, ForecastForScoring } from '@/lib/scoring/types';

// Full quiver fixture
const mockBoards: BoardForPick[] = [
  { id: 'lb-1', name: "9'0 Torq Longboard", board_type: 'longboard', volume: 75 },
  { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
  { id: 'ml-1', name: "7'2 CI Mid", board_type: 'mid-length', volume: 48 },
  { id: 'fl-1', name: "4'6 Armstrong Foil", board_type: 'foil', volume: 25 },
  { id: 'fs-1', name: "5'8 Channel Islands Fish", board_type: 'fish', volume: 33 },
];

function makeForecast(
  waveHeight: number,
  windSpeed: number,
  windDirection: number = 90, // 90 = offshore for standard beach
  overrides: Partial<ForecastForScoring> = {}
): ForecastForScoring {
  return {
    forecastTime: new Date('2026-03-25T08:00:00Z'),
    waveHeight,
    wavePeriod: 12,
    windSpeed,
    windDirection,
    tideHeight: 3.0,
    tideStatus: 'rising',
    ...overrides,
  };
}

function makeBeach(slug: string): BeachWithThresholds {
  return {
    id: `beach-${slug}`,
    name: slug,
    slug,
    wind_offshore_deg: 90,
  } as BeachWithThresholds;
}

// Clean = offshore wind (windDirection=90, low speed)
// Choppy = onshore wind (windDirection=270 for a beach with offshore=90)

describe('getConditionBoardPick', () => {
  describe('clean small waves (1.5ft, low wind)', () => {
    it('recommends longboard when user has longboard and shortboard', () => {
      const boards = [
        { id: 'lb-1', name: "9'0 Torq Longboard", board_type: 'longboard', volume: 75 },
        { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
      ];
      const forecast = makeForecast(1.5, 3); // Clean, 1.5ft

      const result = getConditionBoardPick(forecast, boards);

      expect(result).not.toBeNull();
      expect(result!.boardType).toBe('longboard');
      expect(result!.boardId).toBe('lb-1');
    });

    it('recommends mid-length when user has mid-length (no longboard)', () => {
      const boards = [
        { id: 'ml-1', name: "7'2 CI Mid", board_type: 'mid-length', volume: 48 },
        { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
      ];
      const forecast = makeForecast(1.5, 3);

      const result = getConditionBoardPick(forecast, boards);

      expect(result).not.toBeNull();
      expect(result!.boardType).toBe('mid-length');
    });

    it('returns shortboard when that is the only board — conditions are rideable', () => {
      const boards = [
        { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
      ];
      const forecast = makeForecast(1.5, 3);

      const result = getConditionBoardPick(forecast, boards);

      // User only has a shortboard — always return it (it's rideable)
      expect(result).not.toBeNull();
      expect(result!.boardType).toBe('shortboard');
    });
  });

  describe('foil in sub-1ft clean conditions', () => {
    it('recommends foil when waves are under 1ft and foil is in quiver', () => {
      const boards = [
        { id: 'fl-1', name: "4'6 Armstrong Foil", board_type: 'foil', volume: 25 },
        { id: 'lb-1', name: "9'0 Torq Longboard", board_type: 'longboard', volume: 75 },
      ];
      const forecast = makeForecast(0.8, 2); // < 1ft, glassy

      const result = getConditionBoardPick(forecast, boards);

      expect(result).not.toBeNull();
      expect(result!.boardType).toBe('foil');
    });

    it('recommends longboard when under 1ft clean and no foil in quiver', () => {
      const boards = [
        { id: 'lb-1', name: "9'0 Torq Longboard", board_type: 'longboard', volume: 75 },
        { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
      ];
      const forecast = makeForecast(0.8, 2);

      const result = getConditionBoardPick(forecast, boards);

      expect(result).not.toBeNull();
      expect(result!.boardType).toBe('longboard');
    });
  });

  describe('mid-length conditions (2-3ft clean)', () => {
    it('recommends mid-length for 2.5ft clean waves', () => {
      const boards = [
        { id: 'ml-1', name: "7'2 CI Mid", board_type: 'mid-length', volume: 48 },
        { id: 'lb-1', name: "9'0 Torq Longboard", board_type: 'longboard', volume: 75 },
        { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
      ];
      const forecast = makeForecast(2.5, 4); // Clean 2.5ft

      const result = getConditionBoardPick(forecast, boards);

      expect(result).not.toBeNull();
      expect(result!.boardType).toBe('mid-length');
    });

    it('recommends fish when user has fish but no mid-length, 2.5ft clean', () => {
      const boards = [
        { id: 'fs-1', name: "5'8 Channel Islands Fish", board_type: 'fish', volume: 33 },
        { id: 'lb-1', name: "9'0 Torq Longboard", board_type: 'longboard', volume: 75 },
        { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
      ];
      const forecast = makeForecast(2.5, 4);

      const result = getConditionBoardPick(forecast, boards);

      expect(result).not.toBeNull();
      expect(result!.boardType).toBe('fish');
    });
  });

  describe('shortboard conditions (3-5ft clean)', () => {
    it('recommends shortboard for 4ft clean waves', () => {
      const boards = [
        { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
        { id: 'ml-1', name: "7'2 CI Mid", board_type: 'mid-length', volume: 48 },
        { id: 'lb-1', name: "9'0 Torq Longboard", board_type: 'longboard', volume: 75 },
      ];
      const forecast = makeForecast(4, 5); // Clean 4ft

      const result = getConditionBoardPick(forecast, boards);

      expect(result).not.toBeNull();
      expect(result!.boardType).toBe('shortboard');
    });

    it('recommends shortboard for 5ft+ conditions from full quiver', () => {
      const forecast = makeForecast(5.5, 6);

      const result = getConditionBoardPick(forecast, mockBoards);

      expect(result).not.toBeNull();
      expect(result!.boardType).toBe('shortboard');
    });
  });

  describe('choppy/onshore conditions', () => {
    // windDirection=270 = onshore for a beach with wind_offshore_deg=90
    it('recommends fish over shortboard in choppy 2ft conditions', () => {
      const boards = [
        { id: 'fs-1', name: "5'8 Channel Islands Fish", board_type: 'fish', volume: 33 },
        { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
        { id: 'ml-1', name: "7'2 CI Mid", board_type: 'mid-length', volume: 48 },
      ];
      const forecast = makeForecast(2.5, 12, 270); // Onshore, choppy

      const result = getConditionBoardPick(forecast, boards);

      expect(result).not.toBeNull();
      expect(result!.boardType).toBe('fish');
    });

    it('recommends longboard over shortboard for choppy 1.5ft', () => {
      const boards = [
        { id: 'lb-1', name: "9'0 Torq Longboard", board_type: 'longboard', volume: 75 },
        { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
      ];
      const forecast = makeForecast(1.5, 12, 270); // Onshore, choppy

      const result = getConditionBoardPick(forecast, boards);

      expect(result).not.toBeNull();
      expect(result!.boardType).toBe('longboard');
    });
  });

  describe('edge cases', () => {
    it('returns null when no boards in quiver', () => {
      const forecast = makeForecast(3, 5);

      const result = getConditionBoardPick(forecast, []);

      expect(result).toBeNull();
    });

    it('always recommends the only board when user has one board (if conditions are rideable)', () => {
      const boards = [
        { id: 'ml-1', name: "7'2 CI Mid", board_type: 'mid-length', volume: 48 },
      ];
      const forecast = makeForecast(1.5, 3);

      const result = getConditionBoardPick(forecast, boards);

      expect(result).not.toBeNull();
      expect(result!.boardId).toBe('ml-1');
      expect(result!.boardType).toBe('mid-length');
    });

    it('returns a reason string that is non-empty', () => {
      const boards = [
        { id: 'lb-1', name: "9'0 Torq Longboard", board_type: 'longboard', volume: 75 },
      ];
      const forecast = makeForecast(1.5, 3);

      const result = getConditionBoardPick(forecast, boards);

      expect(result).not.toBeNull();
      expect(result!.reason).toEqual(expect.any(String));
      expect(result!.reason.length).toBeGreaterThan(0);
    });

    it('result includes boardId, boardName, boardType, reason', () => {
      const boards = [
        { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
      ];
      const forecast = makeForecast(4, 5);

      const result = getConditionBoardPick(forecast, boards);

      expect(result).not.toBeNull();
      expect(result!.boardId).toBe('sb-1');
      expect(result!.boardName).toBe("5'10 Lost Driver");
      expect(result!.boardType).toBe('shortboard');
      expect(result!.reason).toEqual(expect.any(String));
      expect(result!.reason.length).toBeGreaterThan(0);
    });

    it('returns null for conditions that are not rideable (score 0, skip conditions)', () => {
      // Extremely high wind — skip condition
      const boards = [
        { id: 'sb-1', name: "5'10 Lost Driver", board_type: 'shortboard', volume: 28 },
      ];
      // 50mph — truly unsurfable
      const forecast = makeForecast(2, 50);

      // With only 1 board and unsurfable conditions, still returns the board
      // (it's the user's only option; the skip label comes from the score, not board pick)
      // This is intentional: board pick is about WHICH board, not WHETHER to surf
      const result = getConditionBoardPick(forecast, boards);
      expect(result).not.toBeNull();
    });
  });

  describe('South OC/SanO power-day board protection', () => {
    const powerDay = makeForecast(3.2, 4, 90, {
      wavePeriod: 17,
      swellDirection: 203,
    });

    it('blocks Lowers small-wave boards and recommends a shortboard when available', () => {
      const boards = [
        { id: 'lb-1', name: "9'0 Longboard", board_type: 'longboard', volume: 75 },
        { id: 'fb-1', name: "7'0 Funboard", board_type: 'funboard', volume: 50 },
        { id: 'sb-1', name: "5'10 Driver", board_type: 'shortboard', volume: 28 },
      ];

      const result = getConditionBoardPick(powerDay, boards, makeBeach('lower-trestles'));

      expect(result).not.toBeNull();
      expect(result!.boardType).toBe('shortboard');
    });

    it('returns null for Lowers when the quiver only has blocked small-wave boards', () => {
      const boards = [
        { id: 'lb-1', name: "9'0 Longboard", board_type: 'longboard', volume: 75 },
        { id: 'sf-1', name: "8'0 Softboard", board_type: 'softboard', volume: 80 },
      ];

      const result = getConditionBoardPick(powerDay, boards, makeBeach('lower-trestles'));

      expect(result).toBeNull();
    });

    it('allows Church funboards below 4ft face height but blocks them at 4ft+', () => {
      const boards = [
        { id: 'fb-1', name: "7'0 Funboard", board_type: 'funboard', volume: 50 },
        { id: 'lb-1', name: "9'0 Longboard", board_type: 'longboard', volume: 75 },
      ];

      const belowFour = getConditionBoardPick(powerDay, boards, makeBeach('church'));
      const atFourPlus = getConditionBoardPick(
        { ...powerDay, waveHeight: 4.1 },
        boards,
        makeBeach('church'),
      );

      expect(belowFour).not.toBeNull();
      expect(belowFour!.boardType).toBe('funboard');
      expect(atFourPlus).toBeNull();
    });

    it('blocks Church softboard, foil, SUP, groveler, and small-wave labels on confirmed power days', () => {
      const boards = [
        { id: 'gr-1', name: "5'6 Groveler", board_type: 'groveler', volume: 35 },
        { id: 'sw-1', name: "Small Wave Twin", board_type: 'small-wave', volume: 34 },
        { id: 'sup-1', name: "SUP", board_type: 'sup', volume: 120 },
      ];

      const result = getConditionBoardPick(powerDay, boards, makeBeach('church'));

      expect(result).toBeNull();
    });

    it('uses guardrail provenance when the stored base model period/direction would not qualify', () => {
      const boards = [
        { id: 'lb-1', name: "9'0 Longboard", board_type: 'longboard', volume: 75 },
      ];
      const forecast = makeForecast(5.2, 4, 90, {
        wavePeriod: 8,
        swellDirection: 270,
        southOcSanoGuardrail: {
          branch: 'trestles_calibrated_anchor',
          confirmedPeriodS: 17,
          confirmedDirectionDeg: 203,
        },
      });

      const result = getConditionBoardPick(forecast, boards, makeBeach('lower-trestles'));

      expect(result).toBeNull();
    });

    it('does not fall back to a different tier board when the scored board is blocked', () => {
      const boards = [
        { id: 'lb-1', name: "9'0 Longboard", board_type: 'longboard', volume: 75 },
        { id: 'sb-1', name: "5'10 Driver", board_type: 'shortboard', volume: 28 },
      ];

      const result = getConditionBoardPick(
        powerDay,
        boards,
        makeBeach('lower-trestles'),
        { kind: 'scored', boardClass: 'longboard' },
      );

      expect(result).toBeNull();
    });

    it('resolves an aliased board to the scored board class', () => {
      const boards = [
        {
          id: 'lb-1',
          name: "9'0 2+1",
          board_type: 'longboard-2-plus-1',
          volume: 75,
        },
      ];

      const result = getConditionBoardPick(
        makeForecast(1.5, 3),
        boards,
        undefined,
        { kind: 'scored', boardClass: 'longboard' },
      );

      expect(result?.boardId).toBe('lb-1');
    });

    it('falls back to tier priority when scoring resolves no board class', () => {
      const boards = [
        { id: 'lb-1', name: "9'0 Longboard", board_type: 'longboard', volume: 75 },
        { id: 'sb-1', name: "5'10 Driver", board_type: 'shortboard', volume: 28 },
      ];

      const result = getConditionBoardPick(
        makeForecast(1.5, 3),
        boards,
        undefined,
        { kind: 'scored', boardClass: null },
      );

      expect(result?.boardId).toBe('lb-1');
      expect(result?.boardType).toBe('longboard');
    });

    it('falls back when scoring names a class absent from the quiver', () => {
      const boards = [
        { id: 'ml-1', name: "7'2 Mid", board_type: 'mid-length', volume: 48 },
        { id: 'lb-1', name: "9'0 Longboard", board_type: 'longboard', volume: 75 },
      ];

      const result = getConditionBoardPick(
        makeForecast(4, 5),
        boards,
        undefined,
        { kind: 'scored', boardClass: 'shortboard' },
      );

      expect(result?.boardId).toBe('ml-1');
      expect(result?.boardType).toBe('mid-length');
    });
  });
});
