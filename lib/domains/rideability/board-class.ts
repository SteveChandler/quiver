/**
 * Rideability Board Class Domain
 *
 * Canonical board classes and normalization helpers for board-aware surf calls.
 */

export const BOARD_CLASSES = [
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
] as const;

export type BoardClass = (typeof BOARD_CLASSES)[number];

export const DEFAULT_BOARD_CLASS: BoardClass = 'foamie';

export const BOARD_TYPE_TO_BOARD_CLASS: Readonly<Record<string, BoardClass>> = {
  foamie: 'foamie',
  foam: 'foamie',
  foamboard: 'foamie',
  'foam-board': 'foamie',
  soft: 'foamie',
  softboard: 'foamie',
  'soft-board': 'foamie',
  softtop: 'foamie',
  'soft-top': 'foamie',
  softtopboard: 'foamie',
  'soft-top-board': 'foamie',

  longboard: 'longboard',
  'long-board': 'longboard',
  log: 'longboard',
  'longboard-single-fin': 'longboard',
  'longboard-2-plus-1': 'longboard',

  midlength: 'mid-length',
  'mid-length': 'mid-length',
  'mini-mid': 'mid-length',
  egg: 'mid-length',

  funboard: 'funboard',
  'fun-board': 'funboard',
  mini: 'funboard',
  minimal: 'funboard',
  'mini-mal': 'funboard',
  'mini-simmons': 'funboard',

  fish: 'fish',
  twin: 'fish',
  'twin-pin': 'fish',
  groveler: 'fish',

  shortboard: 'shortboard',
  'short-board': 'shortboard',

  'step-up': 'step-up',
  stepup: 'step-up',

  gun: 'gun',

  sup: 'sup',
  standuppaddle: 'sup',
  standuppaddleboard: 'sup',
  'stand-up-paddle': 'sup',
  'stand-up-paddleboard': 'sup',
  paddleboard: 'sup',
  'paddle-board': 'sup',

  foil: 'foil',

  bodyboard: 'bodyboard',
  'body-board': 'bodyboard',
  boogie: 'bodyboard',
  boogieboard: 'bodyboard',
  'boogie-board': 'bodyboard',
} as const;

const BOARD_CLASS_SET: ReadonlySet<string> = new Set(BOARD_CLASSES);

function normalizeBoardClassKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function compactBoardClassKey(value: string): string {
  return value.replace(/-/g, '');
}

export function normalizeBoardClass(
  raw: string | null | undefined
): BoardClass | null {
  if (!raw) return null;

  const key = normalizeBoardClassKey(raw);
  if (!key) return null;

  if (BOARD_CLASS_SET.has(key)) return key as BoardClass;

  const compactKey = compactBoardClassKey(key);

  if (key.startsWith('longboard-')) return 'longboard';

  return (
    BOARD_TYPE_TO_BOARD_CLASS[key] ??
    BOARD_TYPE_TO_BOARD_CLASS[compactKey] ??
    null
  );
}

export function parseBoardClass(
  value: string | null | undefined
): BoardClass | null {
  return normalizeBoardClass(value);
}

export function getBoardClassOrDefault(
  boardClass: BoardClass | null | undefined
): BoardClass {
  return boardClass ?? DEFAULT_BOARD_CLASS;
}

export function mapBoardTypeToBoardClass(
  value: string | null | undefined
): BoardClass {
  return getBoardClassOrDefault(normalizeBoardClass(value));
}
