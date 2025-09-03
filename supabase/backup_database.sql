-- Complete Database Backup Script for Quiver
-- This script creates a comprehensive backup of all data
-- Run this in your Supabase SQL editor or via psql

-- Create a backup schema to organize our exports
CREATE SCHEMA IF NOT EXISTS backup_exports;

-- 1. Export all table structures
CREATE OR REPLACE VIEW backup_exports.table_structures AS
SELECT 
    t.table_name,
    string_agg(
        c.column_name || ' ' || 
        CASE 
            WHEN c.data_type = 'character varying' THEN 'varchar(' || c.character_maximum_length || ')'
            WHEN c.data_type = 'character' THEN 'char(' || c.character_maximum_length || ')'
            WHEN c.data_type = 'numeric' THEN 'numeric(' || c.numeric_precision || ',' || c.numeric_scale || ')'
            ELSE c.data_type
        END ||
        CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
        E',\n    '
        ORDER BY c.ordinal_position
    ) as columns_definition
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;

-- 2. Export all data from each table
-- Sessions table
CREATE TABLE IF NOT EXISTS backup_exports.sessions_backup AS
SELECT * FROM sessions;

-- Profiles table
CREATE TABLE IF NOT EXISTS backup_exports.profiles_backup AS
SELECT * FROM profiles;

-- Boards table
CREATE TABLE IF NOT EXISTS backup_exports.boards_backup AS
SELECT * FROM boards;

-- Sessions_boards junction table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions_boards' AND table_schema = 'public') THEN
        EXECUTE 'CREATE TABLE IF NOT EXISTS backup_exports.sessions_boards_backup AS SELECT * FROM sessions_boards';
    END IF;
END $$;

-- Board_members table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'board_members' AND table_schema = 'public') THEN
        EXECUTE 'CREATE TABLE IF NOT EXISTS backup_exports.board_members_backup AS SELECT * FROM board_members';
    END IF;
END $$;

-- User_settings table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_settings' AND table_schema = 'public') THEN
        EXECUTE 'CREATE TABLE IF NOT EXISTS backup_exports.user_settings_backup AS SELECT * FROM user_settings';
    END IF;
END $$;

-- Any other tables that might exist
DO $$
DECLARE
    table_rec RECORD;
    backup_query TEXT;
BEGIN
    FOR table_rec IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name NOT IN ('sessions', 'profiles', 'boards', 'sessions_boards', 'board_members', 'user_settings')
    LOOP
        backup_query := format('CREATE TABLE IF NOT EXISTS backup_exports.%I_backup AS SELECT * FROM %I', 
                              table_rec.table_name, table_rec.table_name);
        
        EXECUTE backup_query;
        
        RAISE NOTICE 'Backed up table: %', table_rec.table_name;
    END LOOP;
END $$;

-- 3. Create a summary of what was backed up
CREATE OR REPLACE VIEW backup_exports.backup_summary AS
SELECT 
    schemaname,
    tablename,
    n_tup_ins as rows_inserted,
    n_tup_upd as rows_updated,
    n_tup_del as rows_deleted,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables 
WHERE schemaname = 'backup_exports'
ORDER BY tablename;

-- 4. Export schema information
CREATE OR REPLACE VIEW backup_exports.schema_info AS
SELECT 
    t.table_name,
    c.column_name,
    c.ordinal_position,
    c.column_default,
    c.is_nullable,
    c.data_type,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale,
    c.udt_name
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- 5. Export constraints and indexes
CREATE OR REPLACE VIEW backup_exports.constraints_info AS
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    STRING_AGG(kcu.column_name, ', ') as columns,
    rc.match_option,
    rc.update_rule,
    rc.delete_rule,
    rc.unique_constraint_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type, rc.match_option, rc.update_rule, rc.delete_rule, rc.unique_constraint_name
ORDER BY tc.table_name, tc.constraint_name;

-- 6. Export RLS policies
CREATE OR REPLACE VIEW backup_exports.rls_policies AS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 7. Create a data export in JSON format for easy import
CREATE OR REPLACE FUNCTION backup_exports.export_table_as_json(table_name TEXT)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    EXECUTE format('SELECT json_agg(row_to_json(t)) FROM %I t', table_name) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 8. Generate restoration commands
CREATE OR REPLACE VIEW backup_exports.restoration_commands AS
SELECT 
    table_name,
    'DROP TABLE IF EXISTS ' || table_name || ' CASCADE;' as drop_command,
    'CREATE TABLE ' || table_name || ' (' || columns_definition || ');' as create_command
FROM backup_exports.table_structures
ORDER BY table_name;

-- Query to get all your data for manual export
SELECT 'Run these queries to export your data:' as instruction;

-- Individual table exports (run these separately)
SELECT 'Sessions data:' as table_name;
SELECT * FROM sessions ORDER BY created_at DESC;

SELECT 'Profiles data:' as table_name;
SELECT * FROM profiles ORDER BY created_at DESC;

SELECT 'Boards data:' as table_name;  
SELECT * FROM boards ORDER BY created_at DESC;

-- Get table row counts
SELECT 
    'Table statistics:' as info,
    schemaname,
    relname as table_name,
    n_tup_ins as total_inserts,
    n_tup_upd as total_updates, 
    n_tup_del as total_deletes,
    n_live_tup as current_rows
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;