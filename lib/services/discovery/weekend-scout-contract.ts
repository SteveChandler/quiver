import { z } from "zod";

export const WEEKEND_SCOUT_CONTRACT_VERSION = "weekend-scout-v1" as const;

function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

const LocalDateSchema = z.string().refine(isValidLocalDate, "Invalid local date");
const IsoTimestampSchema = z.string().datetime({ offset: true });
const RankSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const SourceLabelSchema = z.enum(["nearby", "home", "saved"]);

export const WeekendScoutResultSchema = z
  .object({
    rank: RankSchema,
    beachId: z.string().uuid(),
    beachName: z.string().min(1),
    beachSlug: z.string().min(1).nullable(),
    distanceMiles: z.number().finite().nonnegative(),
    sourceLabels: z.array(SourceLabelSchema).min(1).max(3),
    bestWindow: z.object({
      start: IsoTimestampSchema,
      end: IsoTimestampSchema,
      peakTime: IsoTimestampSchema,
      localLabel: z.string().min(1),
      waveHeight: z.string().min(1).nullable(),
      period: z.string().min(1).nullable(),
      windSpeed: z.string().min(1).nullable(),
      windDirection: z.string().min(1).nullable(),
      tideHeightFt: z.number().finite().nullable(),
      tidePhase: z.string().min(1).nullable(),
      confidence: z.number().finite().min(0).max(100).nullable(),
      freshnessAt: IsoTimestampSchema,
    }),
    conditionScore: z.number().finite().min(0).max(100),
    rankingScore: z.number().finite().min(0).max(100),
    takeaway: z.string().min(1),
  })
  .superRefine((result, context) => {
    if (!result.sourceLabels.includes("nearby")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceLabels"],
        message: "sourceLabels must include nearby",
      });
    }
    if (new Set(result.sourceLabels).size !== result.sourceLabels.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceLabels"],
        message: "sourceLabels must be unique",
      });
    }
    if (new Date(result.bestWindow.end) <= new Date(result.bestWindow.start)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bestWindow", "end"],
        message: "bestWindow end must be after start",
      });
    }
  });

const WeekendScoutRankingFields = {
  contractVersion: z.literal(WEEKEND_SCOUT_CONTRACT_VERSION),
  weekendStart: LocalDateSchema,
  weekendEnd: LocalDateSchema,
  generatedAt: IsoTimestampSchema,
  locationCapturedAt: IsoTimestampSchema,
  timezone: z.string().min(1).max(64),
  qualifyingCount: RankSchema,
  scorerVersion: z.string().min(1),
  results: z.array(WeekendScoutResultSchema).min(1).max(3),
};

function addRankingIssues(
  ranking: z.infer<z.ZodObject<typeof WeekendScoutRankingFields>>,
  context: z.RefinementCtx
): void {
  if (ranking.qualifyingCount !== ranking.results.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["qualifyingCount"],
      message: "qualifyingCount must match results length",
    });
  }

  const beachIds = ranking.results.map((result) => result.beachId);
  if (new Set(beachIds).size !== beachIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["results", "beachId"],
      message: "results beachId values must be unique",
    });
  }

  ranking.results.forEach((result, index) => {
    if (result.rank !== index + 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["results", index, "rank"],
        message: "result rank must match its one-based position",
      });
    }
  });

  const expectedEnd = new Date(`${ranking.weekendStart}T00:00:00.000Z`);
  expectedEnd.setUTCDate(expectedEnd.getUTCDate() + 1);
  if (ranking.weekendEnd !== expectedEnd.toISOString().slice(0, 10)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weekendEnd"],
      message: "weekendEnd must be the Sunday after weekendStart",
    });
  }
}

export const WeekendScoutRankingSchema = z
  .object(WeekendScoutRankingFields)
  .superRefine(addRankingIssues);

export const WeekendScoutSnapshotSchema = z
  .object({
    snapshotId: z.string().uuid(),
    ...WeekendScoutRankingFields,
  })
  .superRefine(addRankingIssues);

export type WeekendScoutResultV1 = z.infer<typeof WeekendScoutResultSchema>;
export type WeekendScoutRankingV1 = z.infer<typeof WeekendScoutRankingSchema>;
export type WeekendScoutSnapshotV1 = z.infer<typeof WeekendScoutSnapshotSchema>;

export function parseWeekendScoutRanking(input: unknown): WeekendScoutRankingV1 {
  return WeekendScoutRankingSchema.parse(input);
}

export function parseWeekendScoutSnapshot(input: unknown): WeekendScoutSnapshotV1 {
  return WeekendScoutSnapshotSchema.parse(input);
}
