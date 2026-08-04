import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { experimentArm } from "@/lib/experiments/assignment-hash";
import type { Database } from "@/types/database.generated";

const LOCAL_URL = "http://127.0.0.1:54321";

function assertion(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function localServiceRoleKey(): string {
  const output = execFileSync("supabase", ["status", "--output", "env"], {
    encoding: "utf8",
  });
  const line = output.split("\n").find((value) => value.startsWith("SERVICE_ROLE_KEY="));
  const key = line?.slice("SERVICE_ROLE_KEY=".length).replace(/^['"]|['"]$/g, "");
  assertion(key, "Local Supabase SERVICE_ROLE_KEY was not available from `supabase status --output env`");
  return key;
}

interface Assignment {
  experiment_key: string;
  user_id: string;
  arm: number;
  index_at: string;
  assignment_version: string;
  build: string | null;
  source: string | null;
}

function expectedArm(userId: string, key: string): number {
  return experimentArm(userId, key);
}

async function createUser(
  client: SupabaseClient<Database>,
  label: string,
  provider?: string,
): Promise<{ id: string; createdAt: string }> {
  const email = `wassign-${label}-${randomUUID()}@quiver.test`;
  const { data, error } = await client.auth.admin.createUser({
    email,
    password: "Wassign-local-verify-123!",
    email_confirm: true,
    ...(provider ? { app_metadata: { provider } } : {}),
  });
  if (error) throw error;
  assertion(data.user, `createUser(${label}) returned no user`);
  return { id: data.user.id, createdAt: data.user.created_at };
}

async function assignmentRows(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<Assignment[]> {
  const { data, error } = await client
    .from("experiment_assignments")
    .select("experiment_key, user_id, arm, index_at, assignment_version, build, source")
    .eq("user_id", userId)
    .order("experiment_key");
  if (error) throw error;
  return data as Assignment[];
}

async function verify(): Promise<void> {
  const client = createClient<Database>(LOCAL_URL, localServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const createdUserIds: string[] = [];

  try {
    const neverReopen = await createUser(client, "never-reopen");
    createdUserIds.push(neverReopen.id);
    const emailRows = await assignmentRows(client, neverReopen.id);
    assertion(emailRows.length === 2, "never-reopen signup did not receive both t3 and t10 rows");
    for (const row of emailRows) {
      assertion(
        row.arm === expectedArm(neverReopen.id, row.experiment_key),
        `never-reopen hash mismatch for ${row.experiment_key}`,
      );
      assertion(
        Date.parse(row.index_at) === Date.parse(neverReopen.createdAt),
        `never-reopen index_at differs from auth.users.created_at for ${row.experiment_key}`,
      );
      assertion(row.build === null && row.source === null, "never-reopen user is not eligibility_unknown");
    }

    const oauthUser = await createUser(client, "oauth", "google");
    createdUserIds.push(oauthUser.id);
    const oauthRowsBeforeLink = await assignmentRows(client, oauthUser.id);
    assertion(oauthRowsBeforeLink.length === 2, "OAuth signup did not receive both t3 and t10 rows");
    const { data: linkedRows, error: linkError } = await client.rpc("link_experiment_eligibility", {
      p_user_id: oauthUser.id,
      p_build: "web",
      p_source: "web_oauth",
    });
    if (linkError) throw linkError;
    assertion(linkedRows?.[0]?.rows_linked === 2, "OAuth linkage did not link both assignment rows");
    const oauthRows = await assignmentRows(client, oauthUser.id);
    assertion(
      oauthRows.every((row) => row.build === "web" && row.source === "web_oauth"),
      "OAuth user was not classifiable as known-ineligible",
    );

    const { data: retryRows, error: retryError } = await client.rpc("link_experiment_eligibility", {
      p_user_id: oauthUser.id,
      p_build: "13",
      p_source: "native_app",
    });
    if (retryError) throw retryError;
    assertion(retryRows?.[0]?.rows_linked === 0, "write-once linkage retry changed rows");
    const immutableRows = await assignmentRows(client, oauthUser.id);
    assertion(
      immutableRows.every((row) => row.build === "web" && row.source === "web_oauth"),
      "write-once linkage retry changed the original values",
    );

    const originalArm = immutableRows[0]?.arm;
    assertion(originalArm === 0 || originalArm === 1, "linked user has no assignment arm");
    const { error: armUpdateError } = await client
      .from("experiment_assignments")
      .update({ arm: originalArm === 0 ? 1 : 0 })
      .eq("experiment_key", immutableRows[0].experiment_key)
      .eq("user_id", oauthUser.id);
    assertion(armUpdateError, "direct arm update did not raise the immutability trigger");
    const { error: buildUpdateError } = await client
      .from("experiment_assignments")
      .update({ build: "x" })
      .eq("experiment_key", immutableRows[0].experiment_key)
      .eq("user_id", oauthUser.id);
    assertion(buildUpdateError, "direct build update did not raise the write-once trigger");

    const raceUser = await createUser(client, "race");
    createdUserIds.push(raceUser.id);
    const raceIndexAt = "2026-08-04T09:00:00.000Z";
    const raceResults = await Promise.all(
      Array.from({ length: 10 }, () =>
        client.rpc("assign_experiment", {
          p_user_id: raceUser.id,
          p_experiment_key: "t2a-swellwatch-v1",
          p_index_at: raceIndexAt,
        }),
      ),
    );
    const raceRows = raceResults.map(({ data, error }) => {
      if (error) throw error;
      return data as Assignment;
    });
    assertion(
      raceRows.every((row) => row.arm === raceRows[0]?.arm && row.index_at === raceRows[0]?.index_at),
      "concurrent assign_experiment calls did not return one stable row",
    );
    const { count: raceCount, error: raceCountError } = await client
      .from("experiment_assignments")
      .select("*", { count: "exact", head: true })
      .eq("experiment_key", "t2a-swellwatch-v1")
      .eq("user_id", raceUser.id);
    if (raceCountError) throw raceCountError;
    assertion(raceCount === 1, `concurrent assignment created ${raceCount} rows instead of one`);

    const preAssigned = await createUser(client, "batch-preassigned");
    const batchNew = await createUser(client, "batch-new");
    createdUserIds.push(preAssigned.id, batchNew.id);
    const preAssignedAt = "2026-08-04T09:01:00.000Z";
    const batchAt = "2026-08-04T09:02:00.000Z";
    const { error: preAssignError } = await client.rpc("assign_experiment", {
      p_user_id: preAssigned.id,
      p_experiment_key: "t2a-swellwatch-v1",
      p_index_at: preAssignedAt,
    });
    if (preAssignError) throw preAssignError;
    const { data: batchRows, error: batchError } = await client.rpc("allocate_experiment_batch", {
      p_experiment_key: "t2a-swellwatch-v1",
      p_user_ids: [preAssigned.id, batchNew.id],
      p_index_at: batchAt,
    });
    if (batchError) throw batchError;
    const rowsByUser = new Map((batchRows as Assignment[]).map((row) => [row.user_id, row]));
    assertion(
      Date.parse(rowsByUser.get(preAssigned.id)?.index_at ?? "") === Date.parse(preAssignedAt),
      "batch re-indexed a pre-assigned user",
    );
    assertion(
      Date.parse(rowsByUser.get(batchNew.id)?.index_at ?? "") === Date.parse(batchAt),
      "batch did not set index_at for a new user",
    );
    for (const [userId, row] of rowsByUser) {
      assertion(row.arm === expectedArm(userId, row.experiment_key), `batch hash mismatch for ${userId}`);
    }

    console.log("W-ASSIGN local verification passed: race, signup coverage, linkage, immutability, batch allocator.");
  } finally {
    if (createdUserIds.length > 0) {
      const deletionErrors = (await Promise.all(
        createdUserIds.map(async (userId) => {
          const { error } = await client.auth.admin.deleteUser(userId);
          return error ? `${userId}: ${error.message}` : null;
        }),
      )).filter((error): error is string => error !== null);

      const { data: retainedRows, error: retainedRowsError } = await client
        .from("experiment_assignments")
        .select("user_id")
        .in("user_id", createdUserIds);
      if (retainedRowsError) throw retainedRowsError;

      // Some local DBs guard auth.users deletion behind a protective trigger
      // (app.allow_destructive). Assignment rows are only cleaned for users
      // that were actually deleted: removing a live user's assignment would
      // recreate the exact signup-coverage gap the trigger exists to prevent.
      const failedIds = new Set(deletionErrors.map((line) => line.split(":")[0]));
      const deletedUserIds = createdUserIds.filter((id) => !failedIds.has(id));

      if (deletionErrors.length > 0) {
        console.warn(
          `auth-user cleanup blocked by environment guard; test users AND their assignments remain: ${deletionErrors.join(", ")}`,
        );
      }
      if (deletedUserIds.length > 0) {
        const retainedUserIds = new Set((retainedRows ?? []).map((row) => row.user_id));
        assertion(
          deletedUserIds.every((id) => retainedUserIds.has(id)),
          "account deletion did not retain an orphaned W-ASSIGN row for every deleted test user",
        );

        const { error: assignmentCleanupError } = await client
          .from("experiment_assignments")
          .delete()
          .in("user_id", deletedUserIds);
        if (assignmentCleanupError) throw assignmentCleanupError;

        const { count: remainingRows, error: remainingRowsError } = await client
          .from("experiment_assignments")
          .select("*", { count: "exact", head: true })
          .in("user_id", deletedUserIds);
        if (remainingRowsError) throw remainingRowsError;
        assertion(remainingRows === 0, "service-role cleanup left W-ASSIGN test rows behind");
      }
    }
  }
}

void verify().catch((error) => {
  console.error("W-ASSIGN local verification failed:", error);
  process.exitCode = 1;
});
