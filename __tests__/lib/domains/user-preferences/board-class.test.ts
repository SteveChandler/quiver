/**
 * Tests for Board Class Utilities
 *
 * Tests canonical board classes, profile/onboarding string normalization,
 * aliases, and conservative fallback behavior.
 */

import {
  BOARD_CLASSES,
  DEFAULT_BOARD_CLASS,
  getBoardClassOrDefault,
  mapBoardTypeToBoardClass,
  normalizeBoardClass,
  parseBoardClass,
  type BoardClass,
} from '@/lib/domains/user-preferences/board-class';

describe('Board Class Utilities', () => {
  describe('parseBoardClass', () => {
    it('should parse canonical board classes', () => {
      const expected: BoardClass[] = [
        'foamie',
        'longboard',
        'mid-length',
        'funboard',
        'fish',
        'shortboard',
        'step-up',
        'gun',
        'sup',
        'foil',
        'bodyboard',
      ];

      expected.forEach((boardClass) => {
        expect(parseBoardClass(boardClass)).toBe(boardClass);
      });
    });

    it('should handle case and whitespace normalization', () => {
      expect(parseBoardClass(' Shortboard ')).toBe('shortboard');
      expect(parseBoardClass('\nFISH\t')).toBe('fish');
      expect(parseBoardClass('Fun Board')).toBe('funboard');
      expect(parseBoardClass('LONG BOARD')).toBe('longboard');
      expect(parseBoardClass('MID_LENGTH')).toBe('mid-length');
      expect(parseBoardClass('step up')).toBe('step-up');
      expect(parseBoardClass(' SUP ')).toBe('sup');
    });

    it('should map softboard aliases to foamie', () => {
      expect(parseBoardClass('softboard')).toBe('foamie');
      expect(parseBoardClass('soft board')).toBe('foamie');
      expect(parseBoardClass('soft-board')).toBe('foamie');
      expect(parseBoardClass('soft top')).toBe('foamie');
      expect(parseBoardClass('soft-top board')).toBe('foamie');
      expect(parseBoardClass('foam board')).toBe('foamie');
    });

    it('should map reasonable aliases to canonical board classes', () => {
      expect(parseBoardClass('mid-length')).toBe('mid-length');
      expect(parseBoardClass('mid length')).toBe('mid-length');
      expect(parseBoardClass('mini mal')).toBe('funboard');
      expect(parseBoardClass('log')).toBe('longboard');
      expect(parseBoardClass('thruster')).toBeNull();
      expect(parseBoardClass('twin-pin')).toBe('fish');
      expect(parseBoardClass('boogie board')).toBe('bodyboard');
      expect(parseBoardClass('standuppaddle')).toBe('sup');
      expect(parseBoardClass('standuppaddleboard')).toBe('sup');
      expect(parseBoardClass('stand up paddleboard')).toBe('sup');
      expect(parseBoardClass('stand up paddle board')).toBe('sup');
      expect(parseBoardClass('paddle board')).toBe('sup');
    });

    it('should return null for unsupported board types', () => {
      expect(parseBoardClass('other')).toBeNull();
      expect(parseBoardClass('custom shape')).toBeNull();
    });

    it('should share the canonical rideability normalizer', () => {
      expect(normalizeBoardClass('soft board')).toBe('foamie');
      expect(normalizeBoardClass('thruster')).toBeNull();
      expect(normalizeBoardClass('twin-pin')).toBe('fish');
      expect(normalizeBoardClass('unknown')).toBeNull();
    });

    it('should return null for empty, null, and undefined values', () => {
      expect(parseBoardClass('')).toBeNull();
      expect(parseBoardClass('   ')).toBeNull();
      expect(parseBoardClass(null)).toBeNull();
      expect(parseBoardClass(undefined)).toBeNull();
    });
  });

  describe('getBoardClassOrDefault', () => {
    it('should return the board class when provided', () => {
      expect(getBoardClassOrDefault('shortboard')).toBe('shortboard');
      expect(getBoardClassOrDefault('fish')).toBe('fish');
    });

    it('should fall back to foamie for null or undefined', () => {
      expect(getBoardClassOrDefault(null)).toBe('foamie');
      expect(getBoardClassOrDefault(undefined)).toBe('foamie');
      expect(getBoardClassOrDefault(null)).toBe(DEFAULT_BOARD_CLASS);
    });
  });

  describe('mapBoardTypeToBoardClass', () => {
    it('should parse known profile/onboarding board type strings', () => {
      expect(mapBoardTypeToBoardClass('shortboard')).toBe('shortboard');
      expect(mapBoardTypeToBoardClass('longboard')).toBe('longboard');
      expect(mapBoardTypeToBoardClass('mid-length')).toBe('mid-length');
      expect(mapBoardTypeToBoardClass('step-up')).toBe('step-up');
      expect(mapBoardTypeToBoardClass('gun')).toBe('gun');
      expect(mapBoardTypeToBoardClass('foil')).toBe('foil');
      expect(mapBoardTypeToBoardClass('bodyboard')).toBe('bodyboard');
      expect(mapBoardTypeToBoardClass('sup')).toBe('sup');
    });

    it('should apply aliases before fallback', () => {
      expect(mapBoardTypeToBoardClass('softboard')).toBe('foamie');
      expect(mapBoardTypeToBoardClass('mini mal')).toBe('funboard');
      expect(mapBoardTypeToBoardClass('boogie board')).toBe('bodyboard');
      expect(mapBoardTypeToBoardClass('standuppaddle')).toBe('sup');
      expect(mapBoardTypeToBoardClass('stand up paddle board')).toBe('sup');
    });

    it('should conservatively fall back to foamie for unknown values', () => {
      expect(mapBoardTypeToBoardClass('other')).toBe('foamie');
      expect(mapBoardTypeToBoardClass('custom shape')).toBe('foamie');
      expect(mapBoardTypeToBoardClass('')).toBe('foamie');
      expect(mapBoardTypeToBoardClass(null)).toBe('foamie');
      expect(mapBoardTypeToBoardClass(undefined)).toBe('foamie');
    });
  });

  describe('BOARD_CLASSES constant', () => {
    it('should contain all canonical board classes', () => {
      expect(BOARD_CLASSES).toEqual([
        'foamie',
        'longboard',
        'mid-length',
        'funboard',
        'fish',
        'shortboard',
        'step-up',
        'gun',
        'sup',
        'foil',
        'bodyboard',
      ]);
    });

    it('should not contain alias-only board labels', () => {
      expect(BOARD_CLASSES).not.toContain('softboard');
      expect(BOARD_CLASSES).not.toContain('thruster');
      expect(BOARD_CLASSES).not.toContain('twin-pin');
    });
  });

  describe('DEFAULT_BOARD_CLASS constant', () => {
    it('should be foamie for conservative fallback behavior', () => {
      expect(DEFAULT_BOARD_CLASS).toBe('foamie');
    });
  });
});
