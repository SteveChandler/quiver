import fs from 'node:fs';
import path from 'node:path';

const migrationsDirectory = path.join(process.cwd(), 'supabase', 'migrations');

describe('native canonical session funnel event idempotency migration', () => {
  it('repairs legacy duplicate event ids before adding owner-scoped uniqueness', () => {
    const migrationName = fs
      .readdirSync(migrationsDirectory)
      .find((name) => name.endsWith('_dedupe_native_session_funnel_events.sql'));

    expect(migrationName ?? '').toMatch(
      /^\d+_dedupe_native_session_funnel_events\.sql$/,
    );
    if (!migrationName) return;

    const sql = fs
      .readFileSync(path.join(migrationsDirectory, migrationName), 'utf8')
      .toLowerCase();
    const beginPosition = sql.indexOf('begin;');
    const lockPosition = sql.indexOf(
      'lock table public.user_events in share row exclusive mode;',
    );
    const repairPosition = sql.indexOf('update public.user_events');
    const indexPosition = sql.indexOf('create unique index');

    expect(sql).toContain('begin;');
    expect(sql).toContain('commit;');
    expect(sql).not.toContain('delete from public.user_events');
    expect(lockPosition).toBeGreaterThan(beginPosition);
    expect(repairPosition).toBeGreaterThan(lockPosition);
    expect(repairPosition).toBeGreaterThanOrEqual(0);
    expect(indexPosition).toBeGreaterThan(repairPosition);
    expect(sql).toMatch(
      /partition by[\s\S]+user_id,\s*metadata\s*->>\s*'event_id'/,
    );
    expect(sql).toMatch(
      /on public\.user_events[\s\S]*\(\s*user_id,\s*\(\(metadata\s*->>\s*'event_id'\)\)\s*\)/,
    );
    expect(sql).toContain("'session_log_start'");
    expect(sql).toContain("'session_log_form_view'");
    expect(sql).toContain("'session_log_validation_failed'");
    expect(sql).toContain("'session_log_submit'");
    expect(sql).toContain("metadata ->> 'event_id' is not null");
  });
});
