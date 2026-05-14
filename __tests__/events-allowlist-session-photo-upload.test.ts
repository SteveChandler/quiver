import { VALID_EVENTS, ANONYMOUS_ALLOWED_EVENTS, PRE_AUTH_ONLY_EVENTS } from '@/app/api/events/route';

const SESSION_PHOTO_UPLOAD_EVENTS = [
  'session_photo_upload_started',
  'session_photo_upload_succeeded',
  'session_photo_upload_failed',
];

describe('session photo upload event allowlist', () => {
  it.each(SESSION_PHOTO_UPLOAD_EVENTS)('%s is in VALID_EVENTS', (name) => {
    expect(VALID_EVENTS).toContain(name);
  });

  it('none are in ANONYMOUS_ALLOWED_EVENTS (authenticated only)', () => {
    for (const ev of SESSION_PHOTO_UPLOAD_EVENTS) {
      expect(ANONYMOUS_ALLOWED_EVENTS).not.toContain(ev);
    }
  });

  it('none are in PRE_AUTH_ONLY_EVENTS (authenticated only)', () => {
    for (const ev of SESSION_PHOTO_UPLOAD_EVENTS) {
      expect(PRE_AUTH_ONLY_EVENTS).not.toContain(ev);
    }
  });
});
