/**
 * Parses and compiles every `supabase/migrations/*.sql` file. Exits 1 on any syntax error.
 *
 *   yarn migrations:check
 *   yarn migrations:check --dir /tmp/some-migrations --json
 *
 * Runs as a standalone process because PGlite loads its WASM bundle through a dynamic `import()`,
 * which Jest's CommonJS VM cannot do without `--experimental-vm-modules`. The gate itself lives in
 * `test-utils/migration-sql-syntax.ts`; `__tests__/migrations/migration-sql-syntax.test.ts` shells
 * out to this script so `yarn test:unit` enforces it without a runner flag.
 */
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { loadModule, parseSync } from "libpg-query";
import {
  checkMigrationSyntax,
  formatSyntaxErrors,
} from "../test-utils/migration-sql-syntax";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<number> {
  const asJson = process.argv.includes("--json");
  const migrationsDir =
    argValue("--dir") ?? path.join(process.cwd(), "supabase/migrations");

  await loadModule();
  const report = await checkMigrationSyntax({
    migrationsDir,
    parseSql: parseSync,
    createDatabase: async () => {
      const db = new PGlite();
      await db.waitReady;
      return db;
    },
  });

  if (asJson) {
    process.stdout.write(JSON.stringify(report));
    return report.errors.length === 0 ? 0 : 1;
  }

  console.log(
    `Checked ${report.filesChecked} migrations: ` +
      `${report.plpgsqlRoutinesChecked} plpgsql routines, ` +
      `${report.sqlRoutinesChecked} sql routines, ` +
      `${report.doBlocksChecked} DO blocks.`
  );

  if (report.skipped.length > 0) {
    console.log(
      `\n${report.skipped.length} routine(s) not compiled — their signature references a type ` +
        `or table the scratch database does not have:`
    );
    for (const skip of report.skipped) {
      console.log(`  ${skip.file}: ${skip.reason}`);
    }
  }

  if (report.errors.length === 0) {
    console.log("\nNo SQL syntax errors.");
    return 0;
  }

  console.error(`\n${report.errors.length} SQL syntax error(s):`);
  console.error(formatSyntaxErrors(report.errors));
  return 1;
}

main().then(
  (code) => {
    process.exit(code);
  },
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  }
);
