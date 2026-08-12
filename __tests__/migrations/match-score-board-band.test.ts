import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";
import { BOARD_TYPE_TO_BOARD_CLASS } from "@/lib/domains/rideability/board-class";

type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";
type BoardClass =
  | "foamie"
  | "longboard"
  | "mid-length"
  | "funboard"
  | "fish"
  | "shortboard"
  | "step-up"
  | "gun"
  | "sup"
  | "foil"
  | "bodyboard";

const SKILL_WAVE_RANGES: Record<
  SkillLevel,
  { ideal: { min: number; max: number }; acceptable: { min: number; max: number } }
> = {
  beginner: { ideal: { min: 1, max: 3 }, acceptable: { min: 0.5, max: 4 } },
  intermediate: { ideal: { min: 2, max: 5 }, acceptable: { min: 1, max: 6 } },
  advanced: { ideal: { min: 3, max: 8 }, acceptable: { min: 2, max: 12 } },
  expert: { ideal: { min: 4, max: 12 }, acceptable: { min: 2, max: 20 } },
};

const BOARD_SHAPE: Record<BoardClass, { lo: number; hi: number }> = {
  foamie: { lo: 0.5, hi: 0.6 },
  longboard: { lo: 0.5, hi: 0.7 },
  "mid-length": { lo: 0.7, hi: 0.85 },
  funboard: { lo: 0.6, hi: 0.8 },
  fish: { lo: 0.85, hi: 0.95 },
  shortboard: { lo: 1.15, hi: 1.05 },
  "step-up": { lo: 1.4, hi: 1.15 },
  gun: { lo: 1.6, hi: 1.2 },
  sup: { lo: 0.4, hi: 0.6 },
  foil: { lo: 0.2, hi: 0.5 },
  bodyboard: { lo: 1, hi: 1 },
};

const PRODUCTION_WRAPPER_MIGRATION =
  "20260609201625_session_fit_match_score.sql";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function boardBandAdjustment({
  skill,
  board,
  waveHeight,
}: {
  skill: SkillLevel;
  board: BoardClass;
  waveHeight: number;
}): number {
  const ranges = SKILL_WAVE_RANGES[skill];
  const shape = BOARD_SHAPE[board];
  const idealMin = Math.max(0.3, round1(ranges.ideal.min * shape.lo));
  const idealMax = Math.max(idealMin + 0.5, round1(ranges.ideal.max * shape.hi));
  const acceptableMin = Math.max(0.3, round1(ranges.acceptable.min * shape.lo));
  const acceptableMax = Math.max(
    acceptableMin + 0.5,
    round1(ranges.acceptable.max * shape.hi),
  );

  if (waveHeight >= idealMin && waveHeight <= idealMax) return 0.5;
  if (waveHeight < acceptableMin) {
    return -Math.min(1, Math.max(0.5, round1((acceptableMin - waveHeight) * 0.5)));
  }
  if (waveHeight > acceptableMax) {
    return -Math.min(1, Math.max(0.5, round1((waveHeight - acceptableMax) * 0.5)));
  }
  return 0;
}

describe("match score board band migration", () => {
  const migrationsDir = join(process.cwd(), "supabase", "migrations");

  function currentCoreMigration(): string {
    const migration = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .reverse()
      .find((name) => {
        const sql = readFileSync(join(migrationsDir, name), "utf8");
        return /create\s+or\s+replace\s+function\s+public\.compute_user_match_score_core\b/i.test(
          sql,
        );
      });

    expect(migration).toEqual(expect.any(String));
    return migration!;
  }

  function readMigration(name = currentCoreMigration()): string {
    return readFileSync(join(migrationsDir, name), "utf8");
  }

  function boardAliasMaps(sql: string): string[] {
    return sql.match(/case[\s\S]*?end\s+as\s+board_class/gi) ?? [];
  }

  function expectBoardAliasParity(sql: string): void {
    for (const [alias, boardClass] of Object.entries(BOARD_TYPE_TO_BOARD_CLASS)) {
      expect(sql).toContain(`'${alias}'`);
      expect(sql).toContain(`then '${boardClass}'`);
    }
  }

  it("replaces only compute_user_match_score_core and preserves the wrapper", () => {
    const sql = readMigration();
    const normalizedSql = sql.replace(/\s+/g, " ").toLowerCase();

    expect(hasTransactionOrBackfilledMetadata(sql)).toBe(true);
    expect(normalizedSql).toContain(
      "create or replace function public.compute_user_match_score_core",
    );
    expect(normalizedSql).not.toContain(
      "create or replace function public.compute_user_match_score(",
    );
    expect(normalizedSql).toContain("grant execute on function public.compute_user_match_score_core");
    expect(normalizedSql).toContain("notify pgrst, 'reload schema'");
  });

  it("normalizes primary positive-session boards to canonical board classes", () => {
    const sql = readMigration();
    const normalizedSql = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalizedSql).toContain("left join public.boards b on b.id = s.board_id");
    expect(normalizedSql).toContain("coalesce(s.board_snapshot->>'board_type', b.board_type)");
    expect(normalizedSql).toContain("coalesce(s.board_snapshot->>'name', b.name)");
    expect(normalizedSql).toContain("s.rating >= 4");
    expect(normalizedSql).toContain("s.arrival_time > now() - interval '12 months'");
    expect(normalizedSql).toContain("s.deleted_at is null");
    expect(normalizedSql).toContain("sfs.forecast_snapshot is not null");
    expect(normalizedSql).toContain("'(^-+|-+$)'");
    expect(normalizedSql).toContain("when key in ('foamie', 'foam', 'foamboard'");
    expect(normalizedSql).toContain("softboard");
    expect(normalizedSql).toContain("standuppaddleboard");
    expect(normalizedSql).toContain("then 'mid-length'");
    expect(normalizedSql).toContain("then 'step-up'");
    expect(normalizedSql).toContain("order by use_count desc, last_used_at desc");
  });

  it("keeps SQL board aliases in parity with the TypeScript board-class map", () => {
    const sql = readMigration().replace(/\s+/g, " ").toLowerCase();
    expect(sql).toContain("'foamie'");
    expectBoardAliasParity(sql);
  });

  it("guards the current core and every SQL board map it defines", () => {
    const wrapper = readMigration(PRODUCTION_WRAPPER_MIGRATION).toLowerCase();
    const currentCore = readMigration().toLowerCase();
    const currentBoardMaps = boardAliasMaps(currentCore);

    expect(wrapper).toContain("return public.compute_user_match_score_core");
    expect(currentCore).toContain(
      "create or replace function public.compute_user_match_score_core",
    );
    expect(currentBoardMaps).toHaveLength(2);

    for (const boardMap of currentBoardMaps) {
      expectBoardAliasParity(boardMap);
      expect(boardMap).not.toContain("'thruster'");
    }
  });

  it("mirrors web rideability skill ranges and board shape multipliers", () => {
    const sql = readMigration();
    const normalizedSql = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalizedSql).toContain("when 'intermediate' then 2.0");
    expect(normalizedSql).toContain("when 'advanced' then 8.0");
    expect(normalizedSql).toContain("when 'expert' then 20.0");
    expect(normalizedSql).toContain("when 'longboard' then 0.5");
    expect(normalizedSql).toContain("when 'shortboard' then 1.15");
    expect(normalizedSql).toContain("when 'foil' then 0.2");
    expect(normalizedSql).toContain("v_board_band_adjustment := 0.5");
    expect(normalizedSql).toContain("v_base_score - v_aversion_penalty + v_session_fit_adjustment + v_board_band_adjustment");
  });

  it("adds board metadata without removing existing score facts", () => {
    const sql = readMigration();
    const normalizedSql = sql.replace(/\s+/g, " ").toLowerCase();

    expect(normalizedSql).toContain("'board_class', v_board_class");
    expect(normalizedSql).toContain("'board_band_adjustment'");
    expect(normalizedSql).toContain("'board_ideal_wave_min_ft'");
    expect(normalizedSql).toContain("'board_ideal_wave_max_ft'");
    expect(normalizedSql).toContain("'fit_signal_adjustment'");
    expect(normalizedSql).toContain("'fit_signal_negative_count'");
    expect(normalizedSql).toContain("'board_tip', v_board_tip");
  });

  it("scores a small clean forecast higher for a longboard than a shortboard", () => {
    const longboardAdjustment = boardBandAdjustment({
      skill: "intermediate",
      board: "longboard",
      waveHeight: 1.5,
    });
    const shortboardAdjustment = boardBandAdjustment({
      skill: "intermediate",
      board: "shortboard",
      waveHeight: 1.5,
    });

    expect(longboardAdjustment).toBe(0.5);
    expect(shortboardAdjustment).toBeLessThan(longboardAdjustment);
    expect(7 + longboardAdjustment).toBeGreaterThan(7 + shortboardAdjustment);
  });
});
