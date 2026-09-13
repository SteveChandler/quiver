import { NextResponse, type NextRequest } from "next/server";

import {
  withAuth,
  withBotBlockingAndRateLimit,
  withErrorHandler,
  type OptionalAuthContext,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { SurfGameScoreSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

const BRACKET_SIZE = 10;
const MAX_LIMIT = 25;

interface ScoreRow {
  id: string;
  user_id: string | null;
  initials: string;
  score: number;
  break_slug: string;
  created_at: string;
}

export interface BracketEntry {
  rank: number;
  initials: string;
  score: number;
  break: string;
  you: boolean;
}

type ScoresTable = {
  from: (table: "surf_game_scores") => any;
};

async function readBracket(supabase: ScoresTable, limit: number, userId: string | null): Promise<BracketEntry[]> {
  const { data, error } = await supabase
    .from("surf_game_scores")
    .select("id, user_id, initials, score, break_slug, created_at")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as ScoreRow[]).map((row, index) => ({
    rank: index + 1,
    initials: row.initials,
    score: row.score,
    break: row.break_slug,
    you: userId !== null && row.user_id === userId,
  }));
}

/** A signed-in player's best and where it sits overall (1 + the number of strictly higher scores). */
async function readYou(supabase: ScoresTable, userId: string): Promise<{ best: number; rank: number; initials: string } | null> {
  const { data: best, error } = await supabase
    .from("surf_game_scores")
    .select("score, initials, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!best) return null;
  const { count, error: countError } = await supabase
    .from("surf_game_scores")
    .select("id", { count: "exact", head: true })
    .gt("score", best.score);
  if (countError) throw countError;
  return { best: best.score, rank: (count ?? 0) + 1, initials: best.initials };
}

export const GET = withErrorHandler(
  withBotBlockingAndRateLimit(
    withAuth(
      async (request: NextRequest, { user }: OptionalAuthContext) => {
        const requested = Number(request.nextUrl.searchParams.get("limit") ?? BRACKET_SIZE);
        const limit = Number.isFinite(requested) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(requested))) : BRACKET_SIZE;
        const supabase = (await createSupabaseServiceRoleClient()) as unknown as ScoresTable;
        const [entries, you] = await Promise.all([
          readBracket(supabase, limit, user?.id ?? null),
          user ? readYou(supabase, user.id) : Promise.resolve(null),
        ]);
        return NextResponse.json({ success: true, entries, you }, { headers: { "Cache-Control": "no-store" } });
      },
      { optional: true },
    ),
    { key: "public-default" },
  ),
  { errorMessage: "Failed to read the surf game bracket" },
);

export const POST = withErrorHandler(
  withBotBlockingAndRateLimit(
    withAuth(
      async (request: NextRequest, { user }: OptionalAuthContext) => {
        const parsed = SurfGameScoreSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
          const field = parsed.error.issues[0]?.path[0];
          return NextResponse.json({ success: false, error: field === "initials" ? "invalid_initials" : "invalid_input" }, { status: 400 });
        }
        const { score, initials, waves = 0, barrels = 0 } = parsed.data;
        const breakSlug = parsed.data.break;
        const supabase = (await createSupabaseServiceRoleClient()) as unknown as ScoresTable;

        let kept = true;
        if (user) {
          // one row per account: only a new personal best replaces it
          const { data: existing, error: readError } = await supabase
            .from("surf_game_scores")
            .select("id, score")
            .eq("user_id", user.id)
            .maybeSingle();
          if (readError) throw readError;
          if (existing && existing.score >= score) kept = false;
          else if (existing) {
            const { error } = await supabase
              .from("surf_game_scores")
              .update({ score, initials, break_slug: breakSlug, waves, barrels, created_at: new Date().toISOString() })
              .eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("surf_game_scores")
              .insert({ user_id: user.id, score, initials, break_slug: breakSlug, waves, barrels });
            if (error) throw error;
          }
        } else {
          const { error } = await supabase
            .from("surf_game_scores")
            .insert({ user_id: null, score, initials, break_slug: breakSlug, waves, barrels });
          if (error) throw error;
        }

        const { count, error: countError } = await supabase
          .from("surf_game_scores")
          .select("id", { count: "exact", head: true })
          .gt("score", score);
        if (countError) throw countError;
        const entries = await readBracket(supabase, BRACKET_SIZE, user?.id ?? null);
        return NextResponse.json({ success: true, kept, rank: (count ?? 0) + 1, entries }, { headers: { "Cache-Control": "no-store" } });
      },
      { optional: true },
    ),
    { key: "public-default" },
  ),
  { errorMessage: "Failed to save the surf game score" },
);
