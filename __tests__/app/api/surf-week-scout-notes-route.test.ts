/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('next/server', () => require('@/__tests__/setup/mock-next-server'));
jest.mock('@/lib/middleware/api-wrappers', () => ({
  ...jest.requireActual('@/lib/middleware/api-wrappers'),
  withAuth: (handler: unknown) => handler,
  withRateLimit: (handler: unknown) => handler,
}));

// The route runs the real Week Scout service and the real gate rules; only I/O is replaced.
let mockDependencies: WeekScoutServiceDependencies;
jest.mock('@/lib/services/discovery/week-scout', () => {
  const actual = jest.requireActual('@/lib/services/discovery/week-scout');
  return {
    ...actual,
    generateWeekScoutForecast: (userId: string, input: WeekScoutRequest) =>
      actual.generateWeekScoutForecast(userId, input, mockDependencies),
  };
});
const mockLoadNotesEdition = jest.fn();
jest.mock('@/lib/services/discovery/week-scout-notes-serve', () => ({
  ...jest.requireActual('@/lib/services/discovery/week-scout-notes-serve'),
  loadWeekScoutNotesEdition: (...args: unknown[]) => mockLoadNotesEdition(...args),
}));
const mockEvaluateMajorEventHoldCandidates = jest.fn();
jest.mock('@/lib/recommendations/major-event-hold/service', () => ({
  evaluateMajorEventHoldCandidates: (...args: unknown[]) => mockEvaluateMajorEventHoldCandidates(...args),
}));
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(async () => ({ data: [], error: null })),
      })),
    })),
  })),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/surf/week-scout/route';
import type { WeekScoutRequest, WeekScoutServiceDependencies } from '@/lib/services/discovery/week-scout';
import type { WeekScoutNotesBriefing } from '@/lib/services/discovery/swell-briefing-types';
import { TIMEZONE, localDate } from '@/__tests__/helpers/swell-events';
import { BLACKS, SCRIPPS, weekScoutSwellDependencies } from '@/__tests__/helpers/week-scout-swells';

const PILOT = '23a9c100-dbee-4d1b-9178-3456a45935ad';

async function callRoute(userId = PILOT): Promise<{ status: number; data: Record<string, unknown> }> {
  const supabase = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ maybeSingle: jest.fn(async () => ({ data: null, error: null })) })),
      })),
    })),
  };
  const response = await POST(new NextRequest('http://localhost/api/surf/week-scout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      candidateBeachIds: [BLACKS, SCRIPPS], localTimezone: TIMEZONE, startLocalDate: localDate(0), dayCount: 7,
    }),
  }), { user: { id: userId }, supabase, params: {} } as never);
  return { status: response.status, data: (await response.json()).data };
}

type LiveDay = { localDate: string; bestDayWindow: { beachId: string; verdict: string; bucket: string } | null };
type LiveSwell = { eventKey: string; confidence: string };

/** An edition written against the response the route actually gives, so its gates hold. */
async function editionMatchingLive(): Promise<WeekScoutNotesBriefing> {
  mockLoadNotesEdition.mockResolvedValue(null);
  const { data } = await callRoute();
  const day = (data.days as LiveDay[]).find((candidate) => candidate.bestDayWindow !== null)!;
  const swell = (data.swells as LiveSwell[])[0];
  const dayGate = {
    localDate: day.localDate,
    beachId: day.bestDayWindow!.beachId,
    verdict: day.bestDayWindow!.verdict,
    bucket: day.bestDayWindow!.bucket,
  };
  const swellGate = { eventKey: swell.eventKey, confidence: swell.confidence };
  return {
    schemaVersion: 2,
    kind: 'week_scout_notes',
    editionDate: localDate(0),
    generatedAt: '2026-10-27T12:45:00Z',
    notes: [
      { slot: 'headline', text: 'Worth a look.', gate: { days: [dayGate], swells: [] } },
      { slot: `day:${day.localDate}`, text: 'Worth it in the morning.', gate: { days: [dayGate], swells: [] } },
      { slot: `swell:${swell.eventKey}`, text: 'Likely, and still firming up.', gate: { days: [], swells: [swellGate] } },
    ],
  } as WeekScoutNotesBriefing;
}

describe('POST /api/surf/week-scout notes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEEK_SCOUT_SWELLS_ENABLED = 'true';
    process.env.SWELL_BRIEFING_ENABLED = 'true';
    process.env.SWELL_BRIEFING_PILOT_USER_ID = PILOT;
    mockDependencies = weekScoutSwellDependencies();
    mockEvaluateMajorEventHoldCandidates.mockImplementation(
      async ({ candidates }: { candidates: Array<{ candidateId: string }> }) => candidates.map(({ candidateId }) => ({
        candidateId,
        evaluation: { outcome: 'allow', holdIds: [], holdEpoch: 'notes-epoch' },
        recommendationAvailability: { state: 'available', holdEpoch: 'notes-epoch' },
      })),
    );
  });

  afterEach(() => {
    delete process.env.WEEK_SCOUT_SWELLS_ENABLED;
    delete process.env.SWELL_BRIEFING_ENABLED;
    delete process.env.SWELL_BRIEFING_PILOT_USER_ID;
  });

  it('attaches the headline and notes whose gates hold, as slot and text only', async () => {
    const edition = await editionMatchingLive();
    mockLoadNotesEdition.mockResolvedValue(edition);

    const { status, data } = await callRoute();
    expect(status).toBe(200);
    expect(data.headline).toBe('Worth a look.');
    expect(data.notes).toEqual([
      { slot: edition.notes[1].slot, text: 'Worth it in the morning.' },
      { slot: edition.notes[2].slot, text: 'Likely, and still firming up.' },
    ]);
    expect(data.swells).toHaveLength(1);
    expect(JSON.stringify(data.notes)).not.toMatch(/gate|generatedAt|freshness|dataAt/);
  });

  it('drops a note, and the headline on it, once the live day pick no longer matches', async () => {
    const edition = await editionMatchingLive();
    // The headline and the day note share one day gate; point it at the other beach.
    const gate = edition.notes[1].gate.days[0];
    gate.beachId = gate.beachId === BLACKS ? SCRIPPS : BLACKS;
    mockLoadNotesEdition.mockResolvedValue(edition);

    const { data } = await callRoute();
    expect(data).not.toHaveProperty('headline');
    expect(data.notes).toEqual([{ slot: edition.notes[2].slot, text: 'Likely, and still firming up.' }]);
  });

  it('drops swell notes when swells are off for the user', async () => {
    const edition = await editionMatchingLive();
    delete process.env.WEEK_SCOUT_SWELLS_ENABLED;
    mockLoadNotesEdition.mockResolvedValue(edition);

    const { data } = await callRoute();
    expect(data).not.toHaveProperty('swells');
    expect(data.notes).toEqual([{ slot: edition.notes[1].slot, text: 'Worth it in the morning.' }]);
  });

  it('leaves both fields absent with no edition, and never loads one for anyone but the pilot', async () => {
    mockLoadNotesEdition.mockResolvedValue(null);
    const pilot = await callRoute();
    expect(pilot.status).toBe(200);
    expect(pilot.data).not.toHaveProperty('notes');
    expect(pilot.data).not.toHaveProperty('headline');

    mockLoadNotesEdition.mockClear();
    const other = await callRoute('someone-else');
    expect(other.data).not.toHaveProperty('notes');
    expect(mockLoadNotesEdition).not.toHaveBeenCalled();
  });

  it('still answers 200 with the full week when the notes read throws', async () => {
    mockLoadNotesEdition.mockRejectedValue(new Error('relation does not exist'));
    const { status, data } = await callRoute();
    expect(status).toBe(200);
    expect(data.days).toHaveLength(7);
    expect(data).not.toHaveProperty('notes');
  });
});
