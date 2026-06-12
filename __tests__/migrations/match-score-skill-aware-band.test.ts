import { readFileSync, readdirSync } from "fs";
import { join } from "path";

import { boardImpliedSkill } from "@/lib/domains/rideability";
import type { BoardClass } from "@/lib/domains/rideability/board-class";
import type { SkillLevel } from "@/lib/domains/user-preferences/skill-level";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

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

const BOARD_CLASSES = Object.keys(BOARD_SHAPE) as BoardClass[];
const SKILL_LEVELS = Object.keys(SKILL_WAVE_RANGES) as SkillLevel[];

function readMigration(): string {
  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const migrationPath = readdirSync(migrationsDir).find((name) =>
    name.endsWith("_match_score_skill_aware_band.sql"),
  );

  expect(migrationPath).toEqual(expect.any(String));
  return readFileSync(join(migrationsDir, migrationPath!), "utf8");
}

function normalized(sql: string): string {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function bandFor(skill: SkillLevel, board: BoardClass): {
  idealMin: number;
  idealMax: number;
  acceptableMin: number;
  acceptableMax: number;
} {
  const range = SKILL_WAVE_RANGES[skill];
  const shape = BOARD_SHAPE[board];
  const idealMin = Math.max(0.3, round1(range.ideal.min * shape.lo));
  const idealMax = Math.max(idealMin + 0.5, round1(range.ideal.max * shape.hi));
  const acceptableMin = Math.max(0.3, round1(range.acceptable.min * shape.lo));
  const acceptableMax = Math.max(
    acceptableMin + 0.5,
    round1(range.acceptable.max * shape.hi),
  );

  return { idealMin, idealMax, acceptableMin, acceptableMax };
}

function skillFromCapabilityCeiling(ceilingFt: number): SkillLevel {
  if (ceilingFt <= 3) return "beginner";
  if (ceilingFt <= 5) return "intermediate";
  if (ceilingFt <= 8) return "advanced";
  return "expert";
}

describe("match score skill-aware band migration", () => {
  it("replaces only compute_user_match_score_core and keeps the prod branch gate visible", () => {
    const sql = readMigration();
    const compactSql = normalized(sql);

    expect(hasTransactionOrBackfilledMetadata(sql)).toBe(true);
    expect(compactSql).toContain(
      "create or replace function public.compute_user_match_score_core",
    );
    expect(compactSql).not.toContain(
      "create or replace function public.compute_user_match_score(",
    );
    expect(compactSql).toContain("grant execute on function public.compute_user_match_score_core");
    expect(compactSql).toContain("production merge auto-applies this migration");
    expect(compactSql).toContain("branch verification is required");
    expect(compactSql).toContain("mirrors skill_wave_ranges and board_shape");
  });

  it("keeps capability ceiling distinct from the preference-peak mean", () => {
    const compactSql = normalized(readMigration());

    expect(compactSql).toContain("capability ceiling");
    expect(compactSql).toContain("percentile_cont(0.85)");
    expect(compactSql).toContain("c_skill_fit_ceiling_weight constant numeric := 0.15");
    expect(compactSql).toContain("weighted mean of conditions over sessions with rating >= 4");
    expect(compactSql).toContain("sum(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') * (s.rating - 3))");
  });

  it("resolves skill by session-derived, profile, board prior, then default", () => {
    const compactSql = normalized(readMigration());
    const sessionIndex = compactSql.indexOf("if v_cap_sample >= c_capability_min_samples");
    const profileIndex = compactSql.indexOf("elsif v_profile_skill in");
    const boardIndex = compactSql.indexOf("elsif v_board_class is not null");
    const defaultIndex = compactSql.indexOf("v_skill_source := 'default'");

    expect(sessionIndex).toBeGreaterThan(-1);
    expect(profileIndex).toBeGreaterThan(sessionIndex);
    expect(boardIndex).toBeGreaterThan(profileIndex);
    expect(defaultIndex).toBeGreaterThan(boardIndex);
    expect(compactSql).toContain("v_skill_source := 'session_derived'");
    expect(compactSql).toContain("v_skill_source := 'profile'");
    expect(compactSql).toContain("v_skill_source := 'board_prior'");
  });

  it("keeps SQL board priors in parity with TypeScript", () => {
    const sql = readMigration().toLowerCase();
    const resolverBlock = sql.match(
      /v_resolved_skill := case v_board_class[\s\S]*?end;/,
    )?.[0];

    expect(resolverBlock).toEqual(expect.any(String));
    for (const board of BOARD_CLASSES) {
      expect(resolverBlock).toContain(`when '${board}' then '${boardImpliedSkill(board)}'`);
    }
  });

  it("maps capability ceilings to the intended skill bucket thresholds", () => {
    const compactSql = normalized(readMigration());

    expect(compactSql).toContain("when v_cap_ceiling <= 3 then 'beginner'");
    expect(compactSql).toContain("when v_cap_ceiling <= 5 then 'intermediate'");
    expect(compactSql).toContain("when v_cap_ceiling <= 8 then 'advanced'");
    expect(skillFromCapabilityCeiling(6)).toBe("advanced");
    expect(skillFromCapabilityCeiling(9)).toBe("expert");
  });

  it("uses the resolved skill for all skill range rows and returns skill metadata", () => {
    const compactSql = normalized(readMigration());

    expect(compactSql).toContain("case v_resolved_skill when 'intermediate' then 2.0");
    expect(compactSql).toContain("case v_resolved_skill when 'intermediate' then 5.0");
    expect(compactSql).toContain("case v_resolved_skill when 'intermediate' then 1.0");
    expect(compactSql).toContain("case v_resolved_skill when 'intermediate' then 6.0");
    expect(compactSql).toContain("'skill_used', v_resolved_skill");
    expect(compactSql).toContain("'skill_source', v_skill_source");
    expect(compactSql).toContain("'board_class', v_board_class");
    expect(compactSql).toContain("'board_band_adjustment'");
  });

  it("keeps all skill and board band combinations ordered", () => {
    for (const skill of SKILL_LEVELS) {
      for (const board of BOARD_CLASSES) {
        const band = bandFor(skill, board);
        expect(band.idealMax).toBeGreaterThan(band.idealMin);
        expect(band.acceptableMax).toBeGreaterThan(band.acceptableMin);
      }
    }

    expect(bandFor("advanced", "shortboard")).toMatchObject({
      idealMin: 3.5,
      idealMax: 8.4,
    });
    expect(bandFor("beginner", "shortboard")).toMatchObject({
      idealMin: 1.2,
      idealMax: 3.2,
    });
  });
});
