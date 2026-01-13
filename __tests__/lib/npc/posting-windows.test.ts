import { isInPostingWindow } from '@/lib/npc/posting-windows';

describe('isInPostingWindow', () => {
  it('returns true when hour is in primary window', () => {
    const date = new Date('2026-01-13T06:30:00-08:00');
    expect(isInPostingWindow('local', date)).toBe(true);
  });

  it('returns false when outside posting windows', () => {
    const date = new Date('2026-01-13T12:00:00-08:00');
    expect(isInPostingWindow('local', date)).toBe(false);
  });
});
