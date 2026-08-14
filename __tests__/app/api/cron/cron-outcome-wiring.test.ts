import { readFileSync } from "node:fs";

type OutcomeWiringCase = {
  name: string;
  route: string;
  unit: string;
  extra?: string;
};

const CASES: OutcomeWiringCase[] = [
  { name: "CCC import", route: "ccc-sync", unit: "ccc_locations_written" },
  { name: "CCC match", route: "ccc-sync", unit: "beach_matches_written" },
  { name: "county advisories", route: "county-beach-advisories", unit: "advisories_synced" },
  { name: "daily call streak reminder", route: "daily-call-streak-reminder", unit: "reminders_sent" },
  { name: "daily intel", route: "daily-intel", unit: "intel_published" },
  { name: "earned Pro evaluation", route: "earn-pro-evaluate", unit: "rewards_evaluated" },
  { name: "first-session email nudge", route: "first-session-nudge", unit: "nudges_sent" },
  { name: "first-session push nudge", route: "first-session-nudge-push", unit: "nudges_sent" },
  { name: "forecast refresh", route: "forecasts/refresh", unit: "marine_forecasts_written" },
  { name: "home morning call", route: "home-morning-call", unit: "calls_sent", extra: "outcome:" },
  { name: "IOOS stations", route: "ioos-sync", unit: "stations_synced" },
  { name: "IOOS observations", route: "ioos-sync", unit: "observations_stored" },
  { name: "major-event hold evaluation", route: "major-event-hold-evaluate", unit: "holds_evaluated" },
  { name: "morning forecast bot", route: "morning-forecast-bot", unit: "posts_published" },
  { name: "NDBC stations", route: "ndbc-direct-sync", unit: "stations_synced" },
  { name: "NDBC observations", route: "ndbc-direct-sync", unit: "observations_upserted" },
  { name: "notification delivery", route: "notifications-deliver", unit: "notifications_sent" },
  { name: "NPC activity", route: "npc-activity", unit: "posts_published" },
  { name: "retired re-engagement email", route: "reengagement-email", unit: "emails_sent" },
  { name: "camera thumbnails", route: "resolve-cam-thumbnails", unit: "thumbnails_updated" },
  { name: "YouTube cameras", route: "resolve-youtube-cams", unit: "cams_updated" },
  { name: "session prompt email", route: "session-prompt-email", unit: "emails_sent" },
  { name: "similarity alerts", route: "similarity-alerts", unit: "alerts_queued" },
  { name: "trial-ending push", route: "trial-ending-push-deliver", unit: "notifications_sent" },
  { name: "buoy conditions", route: "update-buoy-conditions", unit: "buoy_conditions_updated" },
  { name: "user preferences", route: "update-user-preferences", unit: "preferences_updated" },
  { name: "water-quality alerts", route: "water-quality-alerts", unit: "notifications_sent" },
  { name: "weekend window", route: "weekend-window", unit: "windows_evaluated", extra: "runWeekendScoutCron(request, undefined" },
  { name: "weekly recap email", route: "weekly-recap-email", unit: "emails_sent" },
  { name: "weekly streak reminder", route: "weekly-streak-reminder", unit: "reminders_sent" },
  { name: "welcome email", route: "welcome-email", unit: "emails_sent" },
  { name: "wind update", route: "wind/update", unit: "wind_rows_updated" },
];

describe("Pass-2 cron outcome wiring", () => {
  it.each(CASES)("asserts the outcome for $name", ({ route, unit, extra }) => {
    const source = readFileSync(`app/api/cron/${route}/route.ts`, "utf8");

    expect(source).toContain(unit);
    expect(source).toContain("expectedMin: 1");
    expect(source).toContain(extra ?? "withCronOutcome(");
  });
});
