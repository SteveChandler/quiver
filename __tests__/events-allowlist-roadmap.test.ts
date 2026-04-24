import { VALID_EVENTS, ANONYMOUS_ALLOWED_EVENTS, PRE_AUTH_ONLY_EVENTS } from '@/app/api/events/route';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROADMAP_EVENTS = [
  'roadmap_vote_cast',
  'roadmap_item_submitted',
  'roadmap_item_status_changed',
];

describe('roadmap-feature event allowlist', () => {
  it.each(ROADMAP_EVENTS)('%s is in VALID_EVENTS', (name) => {
    expect(VALID_EVENTS).toContain(name);
  });

  it('none are in ANONYMOUS_ALLOWED_EVENTS (authenticated only)', () => {
    for (const ev of ROADMAP_EVENTS) {
      expect(ANONYMOUS_ALLOWED_EVENTS).not.toContain(ev);
    }
  });

  it('none are in PRE_AUTH_ONLY_EVENTS (authenticated only)', () => {
    for (const ev of ROADMAP_EVENTS) {
      expect(PRE_AUTH_ONLY_EVENTS).not.toContain(ev);
    }
  });

  describe('CHECK migration sync', () => {
    const migrationPath = join(__dirname, '../supabase/migrations/20260425000400_add_roadmap_user_events.sql');
    let migrationSQL: string;

    beforeAll(() => {
      migrationSQL = readFileSync(migrationPath, 'utf-8');
    });

    it.each(ROADMAP_EVENTS)('%s is in the CHECK constraint ARRAY', (name) => {
      expect(migrationSQL).toContain(`'${name}'::text`);
    });

    it('drops and recreates user_events_event_type_check', () => {
      expect(migrationSQL).toMatch(/DROP CONSTRAINT user_events_event_type_check/);
      expect(migrationSQL).toMatch(/ADD CONSTRAINT user_events_event_type_check/);
    });

    it('is wrapped in BEGIN/COMMIT', () => {
      expect(migrationSQL).toMatch(/^BEGIN;/m);
      expect(migrationSQL).toMatch(/^COMMIT;/m);
    });

    it('preserves existing events (regression check)', () => {
      // Spot-check a handful of load-bearing existing events — if any of
      // these are missing, the copy-paste step dropped rows.
      expect(migrationSQL).toContain("'login_form_submitted'::text");
      expect(migrationSQL).toContain("'match_card_rendered'::text");
      expect(migrationSQL).toContain("'signup_form_submitted'::text");
      expect(migrationSQL).toContain("'home_surf_call_tap'::text");
    });
  });
});
