import type { SupabaseClient } from "@supabase/supabase-js";
import { BOARD_CLASSES, normalizeBoardClass, type BoardClass } from "@/lib/domains/rideability";
import type { Database } from "@/types/database.generated";

// Small chunks keep the `in()` URL short; paging gets past the PostgREST row cap.
const BOARD_USER_CHUNK_SIZE = 100;
const BOARD_ROW_PAGE_SIZE = 1000;

function toBoardClasses(boardTypes: ReadonlyArray<string | null>): BoardClass[] {
  return Array.from(
    new Set(
      boardTypes
        .map((boardType) => normalizeBoardClass(boardType))
        .filter((boardClass): boardClass is BoardClass => boardClass !== null)
    )
  );
}

// Row order is not a real order (no ORDER BY, or a random uuid id). On a tied score the
// scorer keeps the first board, so go-check readers use this fixed class order.
export function orderBoardClasses(boardClasses: readonly BoardClass[]): BoardClass[] {
  const present = new Set(boardClasses);
  return BOARD_CLASSES.filter((boardClass) => present.has(boardClass));
}

export async function fetchUserBoardClasses(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<BoardClass[]> {
  const { data, error } = await supabase
    .from("boards")
    .select("board_type")
    .eq("user_id", userId)
    .is("retired_at", null);
  if (error || !Array.isArray(data)) return [];

  return toBoardClasses(data.map((row) => row.board_type));
}

async function fetchChunkBoardTypes(
  supabase: SupabaseClient<Database>,
  chunk: readonly string[]
): Promise<Map<string, Array<string | null>> | null> {
  const boardTypesByUser = new Map<string, Array<string | null>>(
    chunk.map((userId) => [userId, []])
  );

  for (let from = 0; ; from += BOARD_ROW_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("boards")
      .select("id, user_id, board_type")
      .in("user_id", [...chunk])
      .is("retired_at", null)
      .order("id")
      .range(from, from + BOARD_ROW_PAGE_SIZE - 1);
    if (error) {
      console.warn("[board-classes] batch read failed", error.message);
      return null;
    }

    const rows = data ?? [];
    for (const row of rows) {
      boardTypesByUser.get(row.user_id)?.push(row.board_type);
    }
    if (rows.length < BOARD_ROW_PAGE_SIZE) return boardTypesByUser;
  }
}

export async function fetchBoardClassesByUser(
  supabase: SupabaseClient<Database>,
  userIds: readonly string[]
): Promise<Map<string, BoardClass[]>> {
  const ids = Array.from(new Set(userIds));
  const boardClassesByUser = new Map<string, BoardClass[]>();

  for (let start = 0; start < ids.length; start += BOARD_USER_CHUNK_SIZE) {
    const chunk = ids.slice(start, start + BOARD_USER_CHUNK_SIZE);
    const boardTypesByUser = await fetchChunkBoardTypes(supabase, chunk);
    for (const userId of chunk) {
      boardClassesByUser.set(userId, orderBoardClasses(toBoardClasses(boardTypesByUser?.get(userId) ?? [])));
    }
  }

  return boardClassesByUser;
}
