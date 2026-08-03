/**
 * Real syntax gate for `supabase/migrations/*.sql`.
 *
 * Every other test under `__tests__/migrations/` is a `toContain()` string match, so a file
 * that Postgres cannot even parse still passes them (see
 * `20260802162000_detect_apple_orphan_after_sign_in.sql`, which used the reserved word
 * `current_user` as a table alias and aborted `CREATE FUNCTION` in every environment).
 *
 * Two layers, because one is not enough:
 *
 * 1. `libpg-query` (the real Postgres grammar compiled to WASM) parses each file. This catches
 *    top-level syntax errors but stops at dollar-quoted routine bodies — to a statement parser
 *    a broken plpgsql body is just an opaque string literal.
 * 2. PGlite (Postgres itself compiled to WASM) creates each plpgsql routine into a scratch
 *    database. `check_function_bodies` makes `CREATE FUNCTION` compile the body, which is what
 *    actually rejects the reserved-word alias. The scratch database has none of the real schema,
 *    so only `42601 syntax_error` counts as a failure; missing tables and types are reported as
 *    unchecked coverage instead.
 *
 * `LANGUAGE sql` bodies skip PGlite entirely — parsing the body text is pure syntax, whereas
 * `CREATE FUNCTION` would run full parse analysis and fail on tables the scratch database lacks.
 */
import fs from "node:fs";
import path from "node:path";

/** Postgres error code for a parse failure — the only class this gate fails on. */
const SYNTAX_ERROR = "42601";

/** Schemas migrations create routines in, so a missing schema is not scored as lost coverage. */
const SCRATCH_SCHEMAS = [
  "syntax_check",
  "auth",
  "extensions",
  "storage",
  "graphql",
  "realtime",
  "net",
  "cron",
  "vault",
];

const ROUTINE_NAME =
  /^(CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+)("(?:[^"]|"")+"|[^\s(]+)/i;

/** Dollar-quote tags used to re-wrap `DO` bodies; the first one absent from the body wins. */
const DOLLAR_TAGS = ["qsyn", "qsyn_a", "qsyn_b", "qsyn_c"];

export interface MigrationSyntaxError {
  file: string;
  /** Where the failure came from: the file itself, a routine body, or a `DO` block. */
  where: string;
  message: string;
}

/** A routine whose body could not be compiled for a non-syntax reason (missing type, table, ...). */
export interface MigrationSyntaxSkip {
  file: string;
  reason: string;
}

export interface MigrationSyntaxReport {
  filesChecked: number;
  plpgsqlRoutinesChecked: number;
  sqlRoutinesChecked: number;
  doBlocksChecked: number;
  errors: MigrationSyntaxError[];
  skipped: MigrationSyntaxSkip[];
}

interface DefElem {
  DefElem?: {
    defname?: string;
    arg?: {
      String?: { sval?: string };
      List?: { items?: Array<{ String?: { sval?: string } }> };
    };
  };
}

interface RawStmt {
  stmt?: {
    CreateFunctionStmt?: { options?: DefElem[] };
    DoStmt?: { args?: DefElem[] };
  };
  stmt_location?: number;
  stmt_len?: number;
}

interface ParseResult {
  stmts?: RawStmt[];
}

interface PgliteLike {
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

export function listMigrationFiles(migrationsDir: string): string[] {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

function optionValue(options: DefElem[] | undefined, name: string): DefElem["DefElem"] | undefined {
  return options?.find((option) => option.DefElem?.defname === name)?.DefElem;
}

function routineLanguage(options: DefElem[] | undefined): string | undefined {
  return optionValue(options, "language")?.arg?.String?.sval?.toLowerCase();
}

/**
 * The body text of an `AS` clause. Returns null for forms this gate cannot check: two-part
 * `AS 'obj_file', 'link_symbol'` (C functions) and SQL-standard `BEGIN ATOMIC` bodies, which
 * the grammar has already validated by the time we see the tree.
 */
function routineBody(options: DefElem[] | undefined): string | null {
  const as = optionValue(options, "as");
  if (!as) return null;
  if (as.arg?.String?.sval !== undefined) return as.arg.String.sval;
  const items = as.arg?.List?.items ?? [];
  return items.length === 1 ? (items[0]?.String?.sval ?? null) : null;
}

/**
 * `stmt_location` points at the end of the previous statement, so the slice can begin with
 * whitespace and comments. The routine-rename regex is anchored, so trim them off first.
 */
function stripLeadingNoise(text: string): string {
  let index = 0;
  for (;;) {
    const rest = text.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }
    if (rest.startsWith("--")) {
      const newline = rest.indexOf("\n");
      if (newline === -1) return "";
      index += newline + 1;
      continue;
    }
    if (rest.startsWith("/*")) {
      const end = rest.indexOf("*/");
      if (end === -1) return "";
      index += end + 2;
      continue;
    }
    return rest;
  }
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Applies every migration's routine bodies to a throwaway Postgres and returns what failed.
 *
 * The parser and database are injected so the Jest spec owns the `require` of two WASM modules —
 * `test-utils/` is type-checked and linted as app code and should not pull them in at import time.
 */
export async function checkMigrationSyntax(options: {
  migrationsDir: string;
  parseSql: (sql: string) => unknown;
  createDatabase: () => Promise<PgliteLike>;
}): Promise<MigrationSyntaxReport> {
  const { migrationsDir, parseSql, createDatabase } = options;
  const report: MigrationSyntaxReport = {
    filesChecked: 0,
    plpgsqlRoutinesChecked: 0,
    sqlRoutinesChecked: 0,
    doBlocksChecked: 0,
    errors: [],
    skipped: [],
  };

  const db = await createDatabase();
  let scratchId = 0;

  try {
    for (const schema of SCRATCH_SCHEMAS) {
      await db.exec(`CREATE SCHEMA IF NOT EXISTS ${schema};`);
    }

    for (const file of listMigrationFiles(migrationsDir)) {
      report.filesChecked += 1;
      // Byte buffer, not a string: stmt_location/stmt_len are byte offsets, and migrations
      // containing non-ASCII characters would otherwise slice mid-token.
      const bytes = fs.readFileSync(path.join(migrationsDir, file));

      let tree: ParseResult;
      try {
        tree = parseSql(bytes.toString("utf8")) as ParseResult;
      } catch (error) {
        report.errors.push({ file, where: "file", message: errorMessage(error) });
        continue;
      }

      for (const rawStmt of tree.stmts ?? []) {
        const start = rawStmt.stmt_location ?? 0;
        const length = rawStmt.stmt_len ?? 0;

        const createFunction = rawStmt.stmt?.CreateFunctionStmt;
        if (createFunction) {
          const language = routineLanguage(createFunction.options);
          const body = routineBody(createFunction.options);

          if (body === null) {
            report.skipped.push({ file, reason: `unsupported AS clause (language=${language})` });
            continue;
          }

          if (language === "sql") {
            report.sqlRoutinesChecked += 1;
            try {
              parseSql(body);
            } catch (error) {
              report.errors.push({
                file,
                where: "sql routine body",
                message: errorMessage(error),
              });
            }
            continue;
          }

          if (language !== "plpgsql") {
            report.skipped.push({ file, reason: `language=${language}` });
            continue;
          }

          const statement = stripLeadingNoise(bytes.subarray(start, start + length).toString("utf8"));
          // Rename into the scratch schema so redefinitions across migrations don't collide with
          // each other ("cannot change return type of existing function") and skip compilation.
          const renamed = statement.replace(
            ROUTINE_NAME,
            (_match, head: string) => `${head}syntax_check.r${(scratchId += 1)}`
          );
          if (renamed === statement) {
            report.skipped.push({ file, reason: "could not rewrite routine name" });
            continue;
          }

          report.plpgsqlRoutinesChecked += 1;
          try {
            await db.exec(renamed);
          } catch (error) {
            const code = errorCode(error);
            if (code === SYNTAX_ERROR) {
              report.errors.push({
                file,
                where: "plpgsql routine body",
                message: errorMessage(error),
              });
            } else {
              report.skipped.push({ file, reason: `${code}: ${errorMessage(error)}` });
            }
          }
          continue;
        }

        const doStmt = rawStmt.stmt?.DoStmt;
        if (!doStmt) continue;

        const language = routineLanguage(doStmt.args) ?? "plpgsql";
        if (language !== "plpgsql") {
          report.skipped.push({ file, reason: `DO language=${language}` });
          continue;
        }
        const body = routineBody(doStmt.args);
        if (body === null) {
          report.skipped.push({ file, reason: "DO block without a readable body" });
          continue;
        }
        const tag = DOLLAR_TAGS.find((candidate) => !body.includes(`$${candidate}$`));
        if (!tag) {
          report.skipped.push({ file, reason: "DO block dollar-quote tag collision" });
          continue;
        }

        report.doBlocksChecked += 1;
        // Wrapped in a function rather than executed: compiling the body is the check, and
        // running arbitrary DO blocks against the scratch database is not.
        try {
          await db.exec(
            `CREATE OR REPLACE FUNCTION syntax_check.d${(scratchId += 1)}() RETURNS void ` +
              `LANGUAGE plpgsql AS $${tag}$${body}$${tag}$;`
          );
        } catch (error) {
          const code = errorCode(error);
          if (code === SYNTAX_ERROR) {
            report.errors.push({ file, where: "DO block", message: errorMessage(error) });
          } else {
            report.skipped.push({ file, reason: `DO ${code}: ${errorMessage(error)}` });
          }
        }
      }
    }
  } finally {
    await db.close();
  }

  return report;
}

export function formatSyntaxErrors(errors: MigrationSyntaxError[]): string {
  return errors
    .map((error) => `  ${error.file} [${error.where}]: ${error.message}`)
    .join("\n");
}
