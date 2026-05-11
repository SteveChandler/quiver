export function isBackfilledMigrationMetadata(migrationSQL: string): boolean {
  return /Backfilled from remote supabase_migrations\.schema_migrations/i.test(
    migrationSQL
  );
}

export function hasTransactionOrBackfilledMetadata(
  migrationSQL: string
): boolean {
  const hasTransaction =
    /\bbegin;/i.test(migrationSQL) && /\bcommit;/i.test(migrationSQL);

  return hasTransaction || isBackfilledMigrationMetadata(migrationSQL);
}
