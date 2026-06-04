import { VALID_EVENTS, ANONYMOUS_ALLOWED_EVENTS, PRE_AUTH_ONLY_EVENTS } from '@/app/api/events/route';

const PHASE21_BOARD_EVENTS = [
  'board_form_saved',
  'session_board_fit_feedback_selected',
];

describe('Phase 21 native board event allowlist', () => {
  it.each(PHASE21_BOARD_EVENTS)('%s is in VALID_EVENTS', (name) => {
    expect(VALID_EVENTS).toContain(name);
  });

  it('none are in ANONYMOUS_ALLOWED_EVENTS (authenticated only)', () => {
    for (const ev of PHASE21_BOARD_EVENTS) {
      expect(ANONYMOUS_ALLOWED_EVENTS).not.toContain(ev);
    }
  });

  it('none are in PRE_AUTH_ONLY_EVENTS (authenticated only)', () => {
    for (const ev of PHASE21_BOARD_EVENTS) {
      expect(PRE_AUTH_ONLY_EVENTS).not.toContain(ev);
    }
  });
});
