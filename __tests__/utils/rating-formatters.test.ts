import { formatDiscoveryScore } from '@/lib/utils/rating-formatters';

describe('formatDiscoveryScore', () => {
  it('caps score at 9.9 for perfect 100', () => {
    expect(formatDiscoveryScore(100)).toBe('9.9');
  });

  it('caps score at 9.9 for scores above 99', () => {
    expect(formatDiscoveryScore(105)).toBe('9.9');
  });

  it('formats whole numbers without decimal', () => {
    expect(formatDiscoveryScore(80)).toBe('8');
    expect(formatDiscoveryScore(70)).toBe('7');
    expect(formatDiscoveryScore(90)).toBe('9');
  });

  it('formats non-whole numbers with one decimal', () => {
    expect(formatDiscoveryScore(85)).toBe('8.5');
    expect(formatDiscoveryScore(73)).toBe('7.3');
    expect(formatDiscoveryScore(99)).toBe('9.9');
  });

  it('handles zero', () => {
    expect(formatDiscoveryScore(0)).toBe('0');
  });

  it('handles low scores', () => {
    expect(formatDiscoveryScore(15)).toBe('1.5');
    expect(formatDiscoveryScore(10)).toBe('1');
  });
});
