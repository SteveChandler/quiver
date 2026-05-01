import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

interface BlockedUserRow {
  blocked_id: string;
  created_at: string;
  blocked: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

export const GET = withAuth(
  async (_request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const { data, error } = await supabase
      .from("user_blocks")
      .select(
        `blocked_id, created_at, blocked:profiles!user_blocks_blocked_id_fkey(id, full_name, avatar_url)`,
      )
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as unknown as BlockedUserRow[];
    const blocked = rows.map((row) => ({
      id: row.blocked_id,
      full_name: row.blocked?.full_name ?? null,
      avatar_url: row.blocked?.avatar_url ?? null,
      blocked_at: row.created_at,
    }));

    const res = createSuccessResponse({ blocked });
    res.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    return res;
  },
  { errorMessage: "Failed to load blocked accounts" },
);
