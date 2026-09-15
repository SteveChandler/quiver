import { render, screen, cleanup } from '@testing-library/react';
import { CityConditionsHero } from '@/components/city/city-conditions-hero';
import type { CitySurfReportSummary } from '@/actions/city/city-conditions-actions';

jest.mock('@/components/seo/alert-capture-cta', () => ({ AlertCaptureCta: () => null }));
jest.mock('@/components/app-store/content-page-app-handoff-cta', () => ({ ContentPageAppHandoffCta: () => null }));
const report: CitySurfReportSummary = {
  overallVerdict: 'fair', bestBeach: null, updatedAt: '2026-09-15T12:00:00.000Z',
  beaches: [{beachId: 'a', beachName: 'A', beachSlug: 'a', citySlug: 'san-diego', stateSlug: 'ca', waveHeight: '3 ft', windDescription: 'Light', score: 30, whySentence: null}],
};
const view = (data: CitySurfReportSummary) => <CityConditionsHero cityName="San Diego" stateSlug="ca" citySlug="san-diego" report={data} />;
it('renders a stable, explicitly zoned source time across regeneration', () => {
  jest.useFakeTimers();
  try {
    jest.setSystemTime(new Date('2026-09-15T13:00:00Z'));
    const first = render(view(report));
    const html = first.container.innerHTML;
    expect(screen.getByText('Updated Sep 15, 12:00 PM UTC')).toHaveAttribute('dateTime', '2026-09-15T12:00:00.000Z');
    cleanup();
    jest.setSystemTime(new Date('2026-09-15T13:20:00Z'));
    expect(render(view(report)).container.innerHTML).toBe(html);
  } finally { jest.useRealTimers(); }
});
it('does not claim an update time when source freshness is unknown', () => {
  render(view({...report, updatedAt: null}));
  expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
});
