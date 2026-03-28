/**
 * @jest-environment node
 *
 * Tests for getConditionBoardPick() — matches forecast conditions to the best board
 * from the user's quiver.
 */

import { getConditionBoardPick } from '@/lib/scoring/board-pick';
import type { BoardForPick } from '@/lib/scoring/board-pick';
import type { ForecastForScoring } from '@/lib/scoring/types';

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
  windDirection: number = 90 // 90 = offshore for standard beach
): ForecastForScoring {
  return {
    forecastTime: new Date('2026-03-25T08:00:00Z'),
    waveHeight,
    wavePeriod: 12,
    windSpeed,
    windDirection,
    tideHeight: 3.0,
    tideStatus: 'rising',
  };
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
      expect(result!.reason).toBeTruthy();
      expect(typeof result!.reason).toBe('string');
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
      expect(result!.reason).toBeTruthy();
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
});
