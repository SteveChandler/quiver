import { readFileSync } from "fs";
import { join } from "path";

import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

describe("maintain boards session_count migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260504003041_maintain_boards_session_count.sql"
    ),
    "utf8"
  );
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps the trigger replacement and backfill in a transaction", () => {
    expect(hasTransactionOrBackfilledMetadata(migrationSQL)).toBe(true);
  });

  it("maintains session_count for inserts, deletes, and board_id moves", () => {
    expect(normalizedSQL).toContain("if tg_op = 'insert'");
    expect(normalizedSQL).toContain("elsif tg_op = 'delete'");
    expect(normalizedSQL).toContain("elsif tg_op = 'update'");
    expect(normalizedSQL).toContain("old.board_id is distinct from new.board_id");
    expect(normalizedSQL).toContain("greatest(coalesce(session_count, 0) - 1, 0)");
  });

  it("replaces the sessions trigger and backfills existing boards", () => {
    expect(normalizedSQL).toContain(
      "drop trigger if exists trigger_maintain_board_session_count on sessions"
    );
    expect(normalizedSQL).toContain(
      "create trigger trigger_maintain_board_session_count after insert or update of board_id or delete on sessions"
    );
    expect(normalizedSQL).toContain("select board_id, count(*) as cnt from sessions");
    expect(normalizedSQL).toContain("set session_count = 0");
    expect(normalizedSQL).toContain("not exists (select 1 from sessions s where s.board_id = b.id)");
  });
});
