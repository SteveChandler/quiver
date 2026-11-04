-- Restore the tables dropped by 20261104150000_drop_dead_shadow_and_backup_tables.
--
-- The data lives in the pre-drop dump, not in SQL, so restore with pg_restore
-- (client 15+, prod owner connection) from the workspace root:
--
--   pg_restore --no-owner --no-privileges -d "$POSTGRES_URL_NON_POOLING" \
--     db-backups/dead-tables-pre-drop-20261104.dump
--
-- To restore a single table add: -t <table_name>
-- After restoring, re-enable RLS if needed and re-grant as the original
-- migrations did (the dump was taken with --no-privileges).

SELECT 1;
