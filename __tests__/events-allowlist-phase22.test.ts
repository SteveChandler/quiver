import { VALID_EVENTS, ANONYMOUS_ALLOWED_EVENTS, PRE_AUTH_ONLY_EVENTS } from '@/app/api/events/route';

const PHASE22_EVENTS = [
  'custom_spot_save_confirmation_viewed',
  'custom_spot_forecast_source_viewed',
  'forecast_visual_layer_selected',
  'synced_forecast_time_selected',
] as const;

describe('Phase 22 native forecast-visual and custom-spot event allowlist', () => {
  it.each(PHASE22_EVENTS)('%s is in VALID_EVENTS', (name) => {
    expect(VALID_EVENTS).toContain(name);
  });

  it('none are in ANONYMOUS_ALLOWED_EVENTS (authenticated only)', () => {
    for (const ev of PHASE22_EVENTS) {
      expect(ANONYMOUS_ALLOWED_EVENTS).not.toContain(ev);
    }
  });

  it('none are in PRE_AUTH_ONLY_EVENTS (authenticated only)', () => {
    for (const ev of PHASE22_EVENTS) {
      expect(PRE_AUTH_ONLY_EVENTS).not.toContain(ev);
    }
  });
});
