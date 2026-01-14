import { hydrateTemplate, type TemplateVariables } from '@/lib/npc/template-hydration';

describe('hydrateTemplate', () => {
  it('replaces single variable', () => {
    const template = 'Checked {{beach_name}} this morning.';
    const variables: TemplateVariables = { beach_name: 'Ocean Beach' };
    expect(hydrateTemplate(template, variables)).toBe('Checked Ocean Beach this morning.');
  });

  it('replaces multiple variables', () => {
    const template = '{{time_of_day}} session at {{beach_name}} was solid.';
    const variables: TemplateVariables = { time_of_day: 'Dawn patrol', beach_name: 'Scripps' };
    expect(hydrateTemplate(template, variables)).toBe('Dawn patrol session at Scripps was solid.');
  });

  it('handles missing variables gracefully', () => {
    const template = '{{beach_name}} looking {{condition}} today.';
    const variables: TemplateVariables = { beach_name: 'Pacifica' };
    expect(hydrateTemplate(template, variables)).toBe('Pacifica looking  today.');
  });
});
