import { NOTIFICATION_REGISTRY } from "@/lib/notifications/registry";
import {
  EMPTY_SWELL_ENGAGEMENT,
  applyOpen,
  decideSend,
  recordSend,
  settle,
  type SwellEngagementState,
} from "@/lib/alerts/swell-outlook/engagement";

const T0 = new Date("2026-10-04T16:00:00.000Z");
const hours = (base: Date, h: number): Date => new Date(base.getTime() + h * 3_600_000);

function sentThrice(): SwellEngagementState {
  let state = EMPTY_SWELL_ENGAGEMENT;
  state = recordSend(state, T0, "first_sighting", false);
  state = recordSend(state, hours(T0, 73), "first_sighting", false);
  return recordSend(state, hours(T0, 146), "followup", false);
}

describe("answered", () => {
  it("includes exactly 48 h in the answer window and excludes later opens", () => {
    const sent = recordSend(EMPTY_SWELL_ENGAGEMENT, T0, "first_sighting", false);
    expect(applyOpen(sent, hours(T0, 48)).consecutiveUnanswered).toBe(0);
    expect(applyOpen(sent, new Date(hours(T0, 48).getTime() + 1)).consecutiveUnanswered).toBe(1);
    expect(applyOpen(sent, hours(T0, -1))).toBe(sent);
  });

  it("an open within 48 h of a send resets the counter", () => {
    const sent = recordSend(EMPTY_SWELL_ENGAGEMENT, T0, "first_sighting", false);
    expect(applyOpen(sent, hours(T0, 47))).toMatchObject({ consecutiveUnanswered: 0, lastAnsweredAt: hours(T0, 47).toISOString() });
  });

  it("an open 60 h after a send is late and leaves the counter alone", () => {
    const sent = recordSend(EMPTY_SWELL_ENGAGEMENT, T0, "first_sighting", false);
    expect(applyOpen(sent, hours(T0, 60)).consecutiveUnanswered).toBe(1);
  });

  it("an open with nothing pending changes nothing", () => {
    expect(applyOpen(EMPTY_SWELL_ENGAGEMENT, T0)).toEqual(EMPTY_SWELL_ENGAGEMENT);
  });
});

describe("pause after three unanswered", () => {
  it("holds the next push while the third is still inside its answer window", () => {
    expect(decideSend(sentThrice(), hours(T0, 146 + 10), "followup", false)).toMatchObject({ ok: false, reason: "skipped_unengaged" });
  });

  it("pauses once the third window lapses, and counts first sightings and follow-ups alike", () => {
    const later = hours(T0, 146 + 49);
    expect(settle(sentThrice(), later).pausedSince).toBe(hours(T0, 146 + 48).toISOString());
    expect(decideSend(sentThrice(), later, "first_sighting", false)).toMatchObject({ ok: false, reason: "skipped_unengaged" });
    expect(decideSend(sentThrice(), later, "followup", false)).toMatchObject({ ok: false, reason: "skipped_unengaged" });
  });

  it("two unanswered pushes never pause", () => {
    let state = recordSend(EMPTY_SWELL_ENGAGEMENT, T0, "first_sighting", false);
    state = recordSend(state, hours(T0, 73), "first_sighting", false);
    expect(decideSend(state, hours(T0, 300), "first_sighting", false)).toEqual({ ok: true, exception: false });
  });

  it("an open while paused resumes with the counter reset, even long after", () => {
    const paused = settle(sentThrice(), hours(T0, 400));
    const resumed = applyOpen(paused, hours(T0, 410));
    expect(resumed).toMatchObject({ pausedSince: null, consecutiveUnanswered: 0 });
    expect(resumed.lastAnsweredAt).toBeNull();
    expect(decideSend(resumed, hours(T0, 411), "first_sighting", false)).toEqual({ ok: true, exception: false });
  });

  it("an open after the window lapsed but before the pause was recorded still resumes", () => {
    const resumed = applyOpen(sentThrice(), hours(T0, 146 + 60));
    expect(resumed).toMatchObject({ pausedSince: null, consecutiveUnanswered: 0 });
    expect(resumed.lastAnsweredAt).toBeNull();
  });

  it("keeps the third push pending at exactly 48 h, then pauses", () => {
    const boundary = hours(T0, 146 + 48);
    expect(settle(sentThrice(), boundary).pausedSince).toBeNull();
    expect(applyOpen(sentThrice(), boundary).consecutiveUnanswered).toBe(0);
    expect(settle(sentThrice(), new Date(boundary.getTime() + 1)).pausedSince).toBe(boundary.toISOString());
  });
});

describe("the 14-day rarity exception", () => {
  const paused = (): SwellEngagementState => settle(sentThrice(), hours(T0, 400));
  const pausedAt = (): Date => new Date(paused().pausedSince as string);

  it("is not offered before 14 days", () => {
    expect(decideSend(paused(), hours(pausedAt(), 13 * 24), "first_sighting", true)).toEqual({ ok: false, reason: "skipped_unengaged", exceptionEligible: false });
  });

  it("is offered after 14 days, and sends only for a rare swell", () => {
    const day14 = hours(pausedAt(), 14 * 24);
    expect(decideSend(paused(), day14, "first_sighting", false)).toEqual({ ok: false, reason: "skipped_unengaged", exceptionEligible: true });
    expect(decideSend(paused(), day14, "first_sighting", true)).toEqual({ ok: true, exception: true });
  });

  it("is never offered to a follow-up", () => {
    expect(decideSend(paused(), hours(pausedAt(), 20 * 24), "followup", true)).toMatchObject({ ok: false, exceptionEligible: false });
  });

  it("allows one, then waits another 14 days with the pause intact", () => {
    const day14 = hours(pausedAt(), 14 * 24);
    const after = recordSend(paused(), day14, "first_sighting", true);
    expect(after).toMatchObject({ pausedSince: paused().pausedSince, lastExceptionAt: day14.toISOString() });
    expect(decideSend(after, hours(day14, 13 * 24), "first_sighting", true)).toMatchObject({ ok: false, exceptionEligible: false });
    expect(decideSend(after, hours(day14, 14 * 24), "first_sighting", true)).toEqual({ ok: true, exception: true });
  });

  it("settles an unrecorded pause before two unanswered exceptions exactly 14 days apart", () => {
    const state = sentThrice();
    const pauseStart = hours(T0, 146 + 48);
    const firstAt = hours(pauseStart, 14 * 24);
    expect(state.pausedSince).toBeNull();
    const first = recordSend(state, firstAt, "first_sighting", true);
    expect(first.pausedSince).toBe(pauseStart.toISOString());
    const secondAt = hours(firstAt, 14 * 24);
    expect(decideSend(first, new Date(secondAt.getTime() - 1), "first_sighting", true)).toEqual({
      ok: false, reason: "skipped_unengaged", exceptionEligible: false,
    });
    expect(decideSend(first, secondAt, "first_sighting", true)).toEqual({ ok: true, exception: true });
    const second = recordSend(first, secondAt, "first_sighting", true);
    expect(second).toMatchObject({
      pausedSince: pauseStart.toISOString(), consecutiveUnanswered: 5, lastExceptionAt: secondAt.toISOString(),
    });
  });

  it("resumes and answers an exception opened within 48 h", () => {
    const day14 = hours(pausedAt(), 14 * 24);
    const after = recordSend(paused(), day14, "first_sighting", true);
    expect(applyOpen(after, hours(day14, 48))).toMatchObject({
      pausedSince: null, consecutiveUnanswered: 0, lastAnsweredAt: hours(day14, 48).toISOString(),
    });
  });

  it("still enforces first-sighting spacing on a rarity exception", () => {
    const day14 = hours(pausedAt(), 14 * 24);
    const state = { ...paused(), lastFirstSightingAt: new Date(day14.getTime() - 96 * 3_600_000 + 1).toISOString() };
    expect(decideSend(state, day14, "first_sighting", true)).toEqual({
      ok: false, reason: "first_sighting_spacing", exceptionEligible: false,
    });
  });
});

describe("first-sighting spacing", () => {
  it("allows at most one first sighting per 96 h, without limiting follow-ups", () => {
    const state = recordSend(EMPTY_SWELL_ENGAGEMENT, T0, "first_sighting", false);
    const answered = applyOpen(state, hours(T0, 2));
    expect(decideSend(answered, new Date(hours(T0, 96).getTime() - 1), "first_sighting", false)).toMatchObject({ ok: false, reason: "first_sighting_spacing" });
    expect(decideSend(answered, new Date(hours(T0, 96).getTime() - 1), "followup", false)).toEqual({ ok: true, exception: false });
    expect(decideSend(answered, hours(T0, 97), "first_sighting", false)).toEqual({ ok: true, exception: false });
    expect(decideSend(answered, hours(T0, 96), "first_sighting", false)).toEqual({ ok: true, exception: false });
  });
});

it("preserves extended state without mutating inputs", () => {
  const state = Object.freeze({ ...EMPTY_SWELL_ENGAGEMENT, outlookList: { runDate: "2026-10-04", swells: [] } });
  const sent = recordSend(state, T0, "followup", false);
  expect(sent).toMatchObject({ consecutiveUnanswered: 1, lastSentAt: T0.toISOString(), lastFirstSightingAt: null });
  expect(sent.outlookList).toBe(state.outlookList);
  expect(state).toMatchObject({ consecutiveUnanswered: 0, lastSentAt: null });
});

it("matches the worker's shared coming cooldown exactly", () => {
  const cooldown = NOTIFICATION_REGISTRY.swell_watch.cooldownMs;
  expect(cooldown).toBe(96 * 3_600_000);
  const state = recordSend(EMPTY_SWELL_ENGAGEMENT, T0, "first_sighting", false);
  expect(decideSend(state, new Date(T0.getTime() + cooldown - 1), "first_sighting", false))
    .toMatchObject({ ok: false, reason: "first_sighting_spacing" });
  expect(decideSend(state, new Date(T0.getTime() + cooldown), "first_sighting", false))
    .toEqual({ ok: true, exception: false });
});
