import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");
const MIGRATION_FILE = "20261020233000_guard_user_id_definer_rpcs.sql";

const migration = readFileSync(join(MIGRATIONS_DIR, MIGRATION_FILE), "utf8");

const laterMigrations = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql") && file > MIGRATION_FILE)
  .map((file) => ({
    file,
    sql: readFileSync(join(MIGRATIONS_DIR, file), "utf8"),
  }));

function definition(
  sql: string,
  name: string,
): { header: string; body: string } | null {
  const create = new RegExp(
    `CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+(public\\.)?${name}\\s*\\(`,
    "i",
  ).exec(sql);
  if (!create) return null;
  const quote = /\$[A-Za-z_]*\$/.exec(sql.slice(create.index));
  if (!quote) throw new Error(`${name} has no dollar-quoted body`);
  const bodyStart = create.index + quote.index + quote[0].length;
  const bodyEnd = sql.indexOf(quote[0], bodyStart);
  return {
    header: sql.slice(create.index, bodyStart),
    body: sql.slice(bodyStart, bodyEnd),
  };
}

function functionBody(sql: string, name: string): string {
  const found = definition(sql, name);
  if (!found) throw new Error(`${name} is not redefined`);
  return found.body;
}

const GUARDED_FUNCTIONS = [
  "create_activity",
  "finalize_anon_alert_capture",
  "get_user_storage_stats",
];

const INVOKER_FUNCTIONS = ["get_profile_stats", "get_most_visited_beach"];

const CLIENT_ROLE = "\\b(PUBLIC|anon|authenticated)\\b";

const SERVICE_ONLY_FUNCTIONS = [
  "public.notify_session_invite(uuid, uuid, uuid, jsonb)",
  "public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text)",
];

describe("guard user-id SECURITY DEFINER RPCs migration", () => {
  it("runs in one transaction", () => {
    expect(migration).toMatch(/^BEGIN;$/m);
    expect(migration).toMatch(/^COMMIT;$/m);
  });

  it.each(GUARDED_FUNCTIONS)(
    "rejects callers other than the owner before touching data in %s",
    (name) => {
      const body = functionBody(migration, name);
      const guard = body.indexOf(
        "IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN",
      );
      expect(guard).toBeGreaterThan(-1);
      expect(body.slice(guard)).toMatch(
        /^IF[^;]+THEN\s+RAISE EXCEPTION '[^']+'\s+USING ERRCODE = '42501';/,
      );
      expect(guard).toBeLessThan(body.search(/\b(insert|RETURN QUERY)\b/i));
    },
  );

  it.each(GUARDED_FUNCTIONS)(
    "keeps %s SECURITY DEFINER with the hardened search_path",
    (name) => {
      const header = definition(migration, name)?.header ?? "";
      expect(header).toContain("SECURITY DEFINER");
      expect(header).toContain(
        "SET search_path TO 'public', 'extensions', 'pg_temp'",
      );
    },
  );

  it("binds finalize_anon_alert_capture to the caller's own email", () => {
    const body = functionBody(migration, "finalize_anon_alert_capture");
    expect(body).toContain("FROM auth.users u");
    expect(body).toContain("WHERE u.id = auth.uid()");
    expect(body).toContain("AND lower(u.email) = lower(p_email)");
    expect(body.indexOf("lower(u.email) = lower(p_email)")).toBeLessThan(
      body.indexOf("RETURN QUERY"),
    );
  });

  it.each(INVOKER_FUNCTIONS)(
    "lets sessions RLS decide which sessions %s counts",
    (name) => {
      expect(migration).toContain(
        `ALTER FUNCTION public.${name}(uuid) SECURITY INVOKER;`,
      );
      expect(migration).not.toMatch(new RegExp(`REVOKE[^;]+${name}`));
    },
  );

  it.each(SERVICE_ONLY_FUNCTIONS)(
    "removes client roles and keeps service_role on %s",
    (signature) => {
      expect(migration).toContain(
        `REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated;`,
      );
      expect(migration).toContain(
        `GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`,
      );
    },
  );

  it("is not undone by a later migration", () => {
    for (const { file, sql } of laterMigrations) {
      expect({
        file,
        bulkGrant: new RegExp(
          `GRANT[^;]+ON\\s+ALL\\s+FUNCTIONS\\s+IN\\s+SCHEMA\\s+public[^;]+TO[^;]*${CLIENT_ROLE}`,
          "i",
        ).test(sql),
      }).toEqual({ file, bulkGrant: false });

      // Name-list loops (see 20260521120000_supabase_advisor_cleanup.sql) build grants
      // with format(), so a quoted name next to a dynamic client grant counts too.
      const dynamicClientGrant = new RegExp(
        `'GRANT[^']+TO[^']*${CLIENT_ROLE}`,
        "i",
      ).test(sql);

      for (const name of [
        "notify_session_invite",
        "sync_session_wave_observation_candidate",
      ]) {
        expect({
          file,
          regrants:
            new RegExp(
              `GRANT[^;]+FUNCTION\\s+(public\\.)?${name}\\b[^;]+TO[^;]*${CLIENT_ROLE}`,
              "i",
            ).test(sql) ||
            (dynamicClientGrant && sql.includes(`'${name}'`)),
        }).toEqual({ file, regrants: false });
      }

      for (const name of GUARDED_FUNCTIONS) {
        const redefined = definition(sql, name);
        if (!redefined) continue;
        expect({ file, guarded: redefined.body.includes("auth.uid()") })
          .toEqual({ file, guarded: true });
      }

      for (const name of INVOKER_FUNCTIONS) {
        expect({
          file,
          name,
          definer:
            /SECURITY\s+DEFINER/i.test(definition(sql, name)?.header ?? "") ||
            new RegExp(
              `ALTER\\s+FUNCTION\\s+(public\\.)?${name}\\b[^;]*SECURITY\\s+DEFINER`,
              "i",
            ).test(sql),
        }).toEqual({ file, name, definer: false });
      }
    }
  });
});
