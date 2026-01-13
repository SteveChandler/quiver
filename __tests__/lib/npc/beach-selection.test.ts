import { selectBeachForPost, type NPCBeachConfig } from '@/lib/npc/beach-selection';

describe('selectBeachForPost', () => {
  const mockConfig: NPCBeachConfig = {
    homeBeachIds: ['beach-1', 'beach-2'],
    secondaryBeaches: ['beach-3', 'beach-4', 'beach-5'],
    homeRegion: 'north-san-diego'
  };

  it('returns a beach ID', () => {
    const result = selectBeachForPost(mockConfig);
    expect(typeof result).toBe('string');
  });

  it('returns home beach most often', () => {
    const results = Array.from({ length: 1000 }, () => selectBeachForPost(mockConfig));
    const homeCount = results.filter(id => mockConfig.homeBeachIds.includes(id)).length;
    expect(homeCount).toBeGreaterThan(600);
    expect(homeCount).toBeLessThan(800);
  });
});
