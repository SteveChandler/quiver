import { generateBeachFAQ } from '@/lib/utils/beach-faq-utils';
import type { Beach } from '@/types/database';

const beach = (overrides: Partial<Beach> = {}): Beach =>
  ({ id: 'b1', name: 'Test Beach', ...overrides }) as Beach;

const windFaq = (b: Beach) =>
  generateBeachFAQ(b).find((item) => item.question.includes('best wind direction'));

describe('generateBeachFAQ wind direction entry', () => {
  it('keeps the existing wording when a stored offshore bearing and tolerance exist', () => {
    const faq = windFaq(beach({ wind_offshore_deg: 90, wind_offshore_tol_deg: 30 }));
    expect(faq?.answer).toBe(
      'Offshore winds at Test Beach blow from the E (90° ±30°). These clean up the wave face and create the best conditions.',
    );
  });

  it('keeps the simple wording when only a stored bearing exists', () => {
    const faq = windFaq(beach({ wind_offshore_deg: 90, wind_offshore_tol_deg: null }));
    expect(faq?.answer).toBe('The best wind at Test Beach is offshore from the E (90°).');
  });

  it('answers for an east-facing aspect-only beach with the default 30° tolerance', () => {
    // aspect 90 faces east, so offshore blows from the west (270)
    const faq = windFaq(beach({ aspect_deg: 90, wind_offshore_deg: null }));
    expect(faq?.answer).toContain('blow from the W');
    expect(faq?.answer).toContain('270°');
    expect(faq?.answer).toContain('±30°');
    expect(faq?.answer).not.toContain('E (');
  });

  it('omits the wind entry when the beach has no orientation at all', () => {
    const items = generateBeachFAQ(beach({ aspect_deg: null, wind_offshore_deg: null }));
    expect(items.find((item) => /wind/i.test(item.question))).toBeUndefined();
    expect(items.map((item) => item.answer).join(' ')).not.toMatch(/offshore winds/i);
    expect(items).toHaveLength(6);
  });

  it('does not invent a generic offshore answer for an unoriented beach', () => {
    const items = generateBeachFAQ(beach());
    expect(items.some((item) => item.answer.includes('cleanest conditions'))).toBe(false);
  });
});

describe('generateBeachFAQ swell entry offshore sentence', () => {
  const window = { swell_window_min_deg: 200, swell_window_max_deg: 260 };
  const swellAnswer = (b: Beach) =>
    generateBeachFAQ(b).find((item) => item.question.includes('swell direction'))?.answer ?? '';

  it('states the stored offshore bearing as before', () => {
    expect(swellAnswer(beach({ ...window, wind_offshore_deg: 90 }))).toContain('Offshore winds blow from E (90°).');
  });

  it('states the aspect-derived bearing for an aspect-only beach', () => {
    expect(swellAnswer(beach({ ...window, aspect_deg: 90, wind_offshore_deg: null }))).toContain(
      'Offshore winds blow from W (270°).',
    );
  });

  it('says nothing about offshore winds when the orientation is unknown', () => {
    expect(swellAnswer(beach({ ...window }))).not.toMatch(/offshore/i);
  });
});
