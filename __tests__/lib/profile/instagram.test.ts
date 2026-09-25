import { instagramProfileUrl, normalizeInstagramHandle } from '@/lib/profile/instagram';

describe('normalizeInstagramHandle', () => {
  it.each([
    ['surfer', 'surfer'],
    ['@surfer', 'surfer'],
    ['  @@surfer  ', 'surfer'],
    ['dawn.patrol_99', 'dawn.patrol_99'],
    ['https://www.instagram.com/surfer/', 'surfer'],
    ['http://instagram.com/surfer?igsh=abc123', 'surfer'],
    ['instagram.com/surfer#top', 'surfer'],
    ['INSTAGRAM.COM/Surfer', 'Surfer'],
    ['surf er!', 'surfer'],
  ])('normalizes %p to %p', (raw, expected) => {
    expect(normalizeInstagramHandle(raw)).toBe(expected);
  });

  it('caps handles at 30 characters', () => {
    expect(normalizeInstagramHandle('a'.repeat(40))).toBe('a'.repeat(30));
  });

  it.each([null, undefined, '', '   ', '@', '!!!', 'https://instagram.com/'])(
    'returns null for %p',
    (raw) => {
      expect(normalizeInstagramHandle(raw)).toBeNull();
    },
  );
});

describe('instagramProfileUrl', () => {
  it('builds the profile URL native also links to', () => {
    expect(instagramProfileUrl('surfer')).toBe('https://instagram.com/surfer');
  });
});
