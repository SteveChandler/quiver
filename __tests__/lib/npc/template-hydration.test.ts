import { hydrateTemplate, type TemplateVariables } from '@/lib/npc/template-hydration';

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
