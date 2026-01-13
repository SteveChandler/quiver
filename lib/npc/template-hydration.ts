/**
 * Template Hydration Utility
 */

export interface TemplateVariables {
  beach_name?: string;
  wave_range?: string;
  wave_period?: string;
  wind_description?: string;
  tide_state?: string;
  water_temp?: string;
  time_of_day?: string;
  crowd_sentence?: string;
  [key: string]: string | undefined;
}

export function hydrateTemplate(template: string, variables: TemplateVariables): string {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => variables[varName] ?? '');
}

export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return matches.map(match => match.replace(/[{}]/g, ''));
}
