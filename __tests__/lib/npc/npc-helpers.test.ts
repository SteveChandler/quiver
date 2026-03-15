import { selectBeachForPost, type NPCBeachConfig } from '@/lib/npc/beach-selection';
import { isInPostingWindow } from "@/lib/npc/posting-windows";
import { hydrateTemplate, type TemplateVariables } from '@/lib/npc/template-hydration';

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

  it('returns home beach most often (50% weight)', () => {
    const results = Array.from({ length: 1000 }, () => selectBeachForPost(mockConfig));
    const homeCount = results.filter(id => mockConfig.homeBeachIds.includes(id)).length;
    // 50% home + 15% adventure (which can also pick home beaches from the merged pool)
    // Lower bound >400 (pure 50% chance), upper bound <700 (adventure adds some home picks)
    expect(homeCount).toBeGreaterThan(400);
    expect(homeCount).toBeLessThan(700);
  });
});

describe("isInPostingWindow", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns true when hour is in primary window", () => {
    // isInPostingWindow uses date.getHours() (machine-local), so use fake timers
    // to make getHours() deterministic. 6:30 AM local is in the local's primary [5,8].
    jest.setSystemTime(new Date(2026, 0, 13, 6, 30, 0));
    const date = new Date();
    expect(isInPostingWindow("local", date)).toBe(true);
  });

  it("returns false when outside posting windows", () => {
    // 12:00 PM local is outside the local's windows [5,8] and [16,19].
    jest.setSystemTime(new Date(2026, 0, 13, 12, 0, 0));
    const date = new Date();
    expect(isInPostingWindow("local", date)).toBe(false);
  });
});

describe('hydrateTemplate', () => {
  it('replaces single variable', () => {
    const template = 'Checked {{beach_name}} this morning.';
    const variables = { beach_name: 'Ocean Beach' } as TemplateVariables;
    expect(hydrateTemplate(template, variables)).toBe('Checked Ocean Beach this morning.');
  });

  it('replaces multiple variables', () => {
    const template = '{{time_of_day}} session at {{beach_name}} was solid.';
    const variables = { time_of_day: 'Dawn patrol', beach_name: 'Scripps' } as TemplateVariables;
    expect(hydrateTemplate(template, variables)).toBe('Dawn patrol session at Scripps was solid.');
  });

  it('handles missing variables gracefully', () => {
    const template = '{{beach_name}} looking {{condition}} today.';
    const variables = { beach_name: 'Pacifica' } as TemplateVariables;
    expect(hydrateTemplate(template, variables)).toBe('Pacifica looking {{condition}} today.');
  });
});
