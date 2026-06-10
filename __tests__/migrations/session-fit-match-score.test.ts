import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

type FitValue = "under" | "dialed" | "over_my_head";
type BoardFitValue =
  | "too_small"
  | "right"
  | "too_much_board"
  | "wrong_type"
  | "na";

interface ForecastVector {
  wave: number;
  period: number;
  wind: number;
  windDir: number;
  tide: number;
}

interface FitSample extends ForecastVector {
  skillFit?: FitValue;
  boardFit?: BoardFitValue;
}

function fitValueFor(sample: FitSample): number {
  const skillValue =
    sample.skillFit === "dialed"
      ? 1
      : sample.skillFit === "over_my_head"
        ? -1
        : sample.skillFit === "under"
          ? -0.5
          : 0;
  const boardValue =
    sample.boardFit === "right"
      ? 0.5
      : sample.boardFit === "too_small" ||
          sample.boardFit === "too_much_board" ||
          sample.boardFit === "wrong_type"
        ? -0.5
        : 0;

  return skillValue + boardValue;
}

function proximityFor(sample: FitSample, forecast: ForecastVector): number {
  const windDirDelta = Math.min(
    Math.abs(sample.windDir - forecast.windDir),
    360 - Math.abs(sample.windDir - forecast.windDir),
  );
  const distance = Math.min(
    0.35 * Math.min(Math.abs(sample.wave - forecast.wave) / Math.max(sample.wave, 1), 1) +
      0.25 * Math.min(Math.abs(sample.period - forecast.period) / Math.max(sample.period, 1), 1) +
      0.2 * Math.min(Math.abs(sample.wind - forecast.wind) / Math.max(sample.wind, 5), 1) +
      0.1 * Math.min(Math.abs(sample.tide - forecast.tide) / 3, 1) +
      0.1 * Math.min(windDirDelta / 180, 1),
    1,
  );

  return 1 - distance;
}

function scoreWithFitSignal({
  baseScore,
  aversionPenalty,
  forecast,
  samples,
}: {
  baseScore: number;
  aversionPenalty: number;
  forecast: ForecastVector;
  samples: FitSample[];
}): {
  score: number;
  fitSignalAdjustment: number;
  fitSignalSampleCount: number;
  fitSignalPositiveCount: number;
  fitSignalNegativeCount: number;
} {
  const scored = samples
    .map((sample) => ({
      fitValue: fitValueFor(sample),
      proximity: proximityFor(sample, forecast),
    }))
    .filter((sample) => sample.fitValue !== 0 && sample.proximity > 0.15);

  const proximitySum = scored.reduce((sum, sample) => sum + sample.proximity, 0);
  const fitScore =
    proximitySum === 0
      ? 0
      : scored.reduce(
          (sum, sample) => sum + sample.fitValue * sample.proximity,
          0,
        ) / proximitySum;
  const fitSignalAdjustment =
    scored.length === 0 ? 0 : Math.max(-1, Math.min(1, fitScore));
  const score = Math.max(
    0,
    Math.min(10, baseScore - aversionPenalty + fitSignalAdjustment),
  );

  return {
    score,
    fitSignalAdjustment,
    fitSignalSampleCount: scored.length,
    fitSignalPositiveCount: scored.filter((sample) => sample.fitValue > 0).length,
    fitSignalNegativeCount: scored.filter((sample) => sample.fitValue < 0).length,
  };
}

describe("session fit match score migration", () => {
  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const migrationPath = readdirSync(migrationsDir).find((name) =>
    name.endsWith("_session_fit_match_score.sql"),
  );

  function readMigration(): string {
    expect(migrationPath).toEqual(expect.any(String));
    return readFileSync(join(migrationsDir, migrationPath!), "utf8");
  }

  it("promotes v1 session fit values into typed generated columns", () => {
    const sql = readMigration();
    const normalizedSql = sql.replace(/\s+/g, " ").toLowerCase();

    expect(hasTransactionOrBackfilledMetadata(sql)).toBe(true);
    expect(normalizedSql).toContain("add column if not exists session_skill_fit text");
    expect(normalizedSql).toContain("generated always as");
    expect(normalizedSql).toContain("session_decomposition->>'version' = '1'");
    expect(normalizedSql).toContain("session_decomposition->>'skill_fit'");
    expect(normalizedSql).toContain("session_decomposition->>'board_fit'");
    expect(normalizedSql).toContain("('under', 'dialed', 'over_my_head')");
    expect(normalizedSql).toContain(
      "('too_small', 'right', 'too_much_board', 'wrong_type', 'na')",
    );
    expect(normalizedSql).toContain("idx_sessions_session_skill_fit");
    expect(normalizedSql).toContain("idx_sessions_session_board_fit");
  });

  it("feeds categorical fit signals into compute_user_match_score_core", () => {
    const sql = readMigration();
    const normalizedSql = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalizedSql).toContain(
      "create or replace function public.compute_user_match_score_core",
    );
    expect(normalizedSql).toContain("v_session_fit_adjustment");
    expect(normalizedSql).toContain("session_skill_fit = 'dialed'");
    expect(normalizedSql).toContain("session_skill_fit = 'over_my_head'");
    expect(normalizedSql).toContain("session_skill_fit = 'under'");
    expect(normalizedSql).toContain("session_board_fit = 'right'");
    expect(normalizedSql).toContain(
      "session_board_fit in ('too_small', 'too_much_board', 'wrong_type')",
    );
    expect(normalizedSql).toContain("'fit_signal_adjustment'");
    expect(normalizedSql).toContain("'fit_signal_sample_count'");
    expect(normalizedSql).toContain("reason_bullets', v_reason_bullets");
  });

  it("exercises the score adjustment behavior for present and absent fit signals", () => {
    const forecast: ForecastVector = {
      wave: 4,
      period: 12,
      wind: 8,
      windDir: 270,
      tide: 2,
    };

    const withoutSignal = scoreWithFitSignal({
      baseScore: 7,
      aversionPenalty: 0,
      forecast,
      samples: [],
    });
    const nearbyPositiveSignal = scoreWithFitSignal({
      baseScore: 7,
      aversionPenalty: 0,
      forecast,
      samples: [{ ...forecast, skillFit: "dialed", boardFit: "right" }],
    });
    const nearbyMismatchSignal = scoreWithFitSignal({
      baseScore: 7,
      aversionPenalty: 0,
      forecast,
      samples: [{ ...forecast, skillFit: "over_my_head", boardFit: "wrong_type" }],
    });

    expect(withoutSignal).toMatchObject({
      score: 7,
      fitSignalAdjustment: 0,
      fitSignalSampleCount: 0,
    });
    expect(nearbyPositiveSignal).toMatchObject({
      score: 8,
      fitSignalAdjustment: 1,
      fitSignalSampleCount: 1,
      fitSignalPositiveCount: 1,
      fitSignalNegativeCount: 0,
    });
    expect(nearbyMismatchSignal).toMatchObject({
      score: 6,
      fitSignalAdjustment: -1,
      fitSignalSampleCount: 1,
      fitSignalPositiveCount: 0,
      fitSignalNegativeCount: 1,
    });
  });

  it("ignores neutral or far-away fit samples so legacy scoring remains unchanged", () => {
    const forecast: ForecastVector = {
      wave: 4,
      period: 12,
      wind: 8,
      windDir: 270,
      tide: 2,
    };

    const neutralBoardOnly = scoreWithFitSignal({
      baseScore: 6.5,
      aversionPenalty: 1,
      forecast,
      samples: [{ ...forecast, boardFit: "na" }],
    });
    const farAwayPositive = scoreWithFitSignal({
      baseScore: 6.5,
      aversionPenalty: 1,
      forecast,
      samples: [
        {
          wave: 30,
          period: 3,
          wind: 70,
          windDir: 90,
          tide: 12,
          skillFit: "dialed",
          boardFit: "right",
        },
      ],
    });

    expect(neutralBoardOnly).toMatchObject({
      score: 5.5,
      fitSignalAdjustment: 0,
      fitSignalSampleCount: 0,
    });
    expect(farAwayPositive).toMatchObject({
      score: 5.5,
      fitSignalAdjustment: 0,
      fitSignalSampleCount: 0,
    });
  });

  it("keeps sessions without v1 fit signal on the old score path", () => {
    const sql = readMigration();
    const normalizedSql = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalizedSql).toContain(
      "if coalesce(v_fit_signal_sample_count, 0) > 0 then",
    );
    expect(normalizedSql).toContain("else v_session_fit_adjustment := 0");
    expect(normalizedSql).toContain("v_score := greatest(0, least(10, v_base_score - v_aversion_penalty + v_session_fit_adjustment))");
    expect(normalizedSql).not.toMatch(/\bnotes\b/);
    expect(normalizedSql).not.toMatch(/\bdescription\b/);
  });

  it("preserves public/core RPC grants and PostgREST reload", () => {
    const sql = readMigration();
    const normalizedSql = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalizedSql).toContain(
      "revoke all on function public.compute_user_match_score_core",
    );
    expect(normalizedSql).toContain(
      "grant execute on function public.compute_user_match_score_core",
    );
    expect(normalizedSql).toContain(
      "revoke all on function public.compute_user_match_score(uuid, uuid, text, text, text, text, text)",
    );
    expect(normalizedSql).toContain(
      "grant execute on function public.compute_user_match_score(uuid, uuid, text, text, text, text, text) to authenticated",
    );
    expect(normalizedSql).toContain("notify pgrst, 'reload schema'");
  });
});
