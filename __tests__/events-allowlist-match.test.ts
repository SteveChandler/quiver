import { VALID_EVENTS, ANONYMOUS_ALLOWED_EVENTS, PRE_AUTH_ONLY_EVENTS } from '@/app/api/events/route';

const MATCH_EVENTS = [
  'match_card_rendered',
  'match_strip_tap',
  'for_you_tap',
  'unlock_toast_shown',
  'session_decomposition_selected',
  'match_alert_toggle',
];

describe('match-feature event allowlist', () => {
  it.each(MATCH_EVENTS)('%s is in VALID_EVENTS', (name) => {
    expect(VALID_EVENTS).toContain(name);
  });

  it('none are in ANONYMOUS_ALLOWED_EVENTS (authenticated only)', () => {
    for (const ev of MATCH_EVENTS) {
      expect(ANONYMOUS_ALLOWED_EVENTS).not.toContain(ev);
    }
  });

  it('none are in PRE_AUTH_ONLY_EVENTS (authenticated only)', () => {
    for (const ev of MATCH_EVENTS) {
      expect(PRE_AUTH_ONLY_EVENTS).not.toContain(ev);
    }
  });
});
