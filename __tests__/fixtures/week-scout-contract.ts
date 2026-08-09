import type { CanonicalWeekScoutResponse } from '@/lib/services/discovery/week-scout';
import weekScoutContractFixtureJson from './week-scout-contract-v1.json';

export const WEEK_SCOUT_CONTRACT_BEACH_ID = '11111111-1111-4111-8111-111111111111';
export const WEEK_SCOUT_CONTRACT_GENERATED_AT = '2026-07-15T18:00:00.000Z';

export const WEEK_SCOUT_CONTRACT_FIXTURE = (
  weekScoutContractFixtureJson as unknown as CanonicalWeekScoutResponse
);
