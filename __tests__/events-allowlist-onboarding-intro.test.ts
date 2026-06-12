import {
  ANONYMOUS_ALLOWED_EVENTS,
  PRE_AUTH_ONLY_EVENTS,
  VALID_EVENTS,
} from '@/app/api/events/route';

const ONBOARDING_INTRO_EVENT = 'onboarding_intro_get_started';

describe('onboarding intro event allowlist', () => {
  it('accepts the get-started tap event', () => {
    expect(VALID_EVENTS).toContain(ONBOARDING_INTRO_EVENT);
  });

  it('allows the get-started tap before auth', () => {
    expect(ANONYMOUS_ALLOWED_EVENTS).toContain(ONBOARDING_INTRO_EVENT);
  });

  it('drops ghost signed-in fires for the pre-auth get-started tap', () => {
    expect(PRE_AUTH_ONLY_EVENTS).toContain(ONBOARDING_INTRO_EVENT);
  });
});
