/** @jest-environment node */
import { NOTIFICATION_REGISTRY } from '@/lib/notifications/registry';
import { buildFirstSightingPayload } from '@/lib/alerts/swell-outlook/first-sighting';
import { outlookSwell } from '@/__tests__/helpers/outlook-swell';

it('preserves additive window metadata through validation, native push, and in-app delivery', () => {
  const surfWindow = { state: 'recommended' as const,
    window: { start: '2026-10-08T17:00:00.000Z', end: '2026-10-08T19:00:00.000Z', localDate: '2026-10-08',
      timezone: 'America/Los_Angeles', faceHeightFt: { min: 3, max: 4 } }, reasons: ['better_tide_after_peak'] };
  const payload = buildFirstSightingPayload({ swell: outlookSwell(), timezone: 'America/Los_Angeles', surfWindow });
  const def = NOTIFICATION_REGISTRY.swell_watch;
  const validated = def.validatePayload!(payload);
  expect(validated.surf_window).toMatchObject({ state: 'recommended', local_date: '2026-10-08' });
  expect(validated.surf_window).toEqual(payload.surf_window);
  expect(JSON.parse(def.buildPushPayload!(validated).data!.surf_window as string)).toEqual(payload.surf_window);
  expect(def.buildInAppPayload!(validated).data.surf_window).toEqual(payload.surf_window);
});
