import { describe, it, expect } from '@jest/globals';
import { convertDumpToGraphDdl } from '../db/graphify-schema';

const header = (name: string, type: string): string => `\n--\n-- Name: ${name}; Type: ${type}; Schema: public; Owner: -\n--\n\n`;

const dump = [
  'SET statement_timeout = 0;',
  header('beaches', 'TABLE') + 'CREATE TABLE public.beaches (\n    id uuid DEFAULT gen_random_uuid() NOT NULL\n);',
  header('alert_rules', 'TABLE') + 'CREATE TABLE public."alert_rules" (\n    beach_id uuid\n);',
  header('beach_audit', 'VIEW') +
    "CREATE VIEW public.beach_audit WITH (security_invoker='true') AS\n SELECT b.id\n   FROM public.beaches b;",
  header('beach_stats', 'MATERIALIZED VIEW') +
    'CREATE MATERIALIZED VIEW public.beach_stats AS\n SELECT id FROM public.beaches\n  WITH NO DATA;',
  header('touch()', 'FUNCTION') +
    'CREATE FUNCTION public.touch() RETURNS trigger\n    LANGUAGE plpgsql\n    AS $$\nBEGIN\n  UPDATE public.beaches SET id = id;\n  RETURN NEW;\nEND;\n$$;',
  header('alert_rules alert_rules_beach_id_fkey', 'FK CONSTRAINT') +
    'ALTER TABLE ONLY public.alert_rules\n    ADD CONSTRAINT alert_rules_beach_id_fkey FOREIGN KEY (beach_id) REFERENCES public.beaches(id) ON DELETE CASCADE;',
  header('alert_rules alert_rules_user_id_fkey', 'FK CONSTRAINT') +
    'ALTER TABLE ONLY public.alert_rules\n    ADD CONSTRAINT alert_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);',
  header('alert_rules touch_alert_rules', 'TRIGGER') +
    'CREATE TRIGGER touch_alert_rules BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.touch();',
  header('alert_rules policy', 'POLICY') + 'CREATE POLICY p ON public.alert_rules USING (true);',
].join('\n');

describe('convertDumpToGraphDdl', () => {
  const { ddl, counts } = convertDumpToGraphDdl(dump);

  it('keeps every object kind the graph needs and skips policies', () => {
    expect(counts).toEqual({ table: 2, view: 2, function: 1, fk: 2, trigger: 1, external: 1 });
    expect(ddl).not.toContain('POLICY');
  });

  it('writes unqualified names so FK edges join the table nodes', () => {
    expect(ddl).toContain('CREATE TABLE beaches (id INT);');
    expect(ddl).toContain('CREATE TABLE alert_rules (id INT);');
    expect(ddl).toContain(
      'ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_beach_id_fkey FOREIGN KEY (beach_id) REFERENCES beaches(id);',
    );
    expect(ddl).not.toMatch(/\bpublic\./);
  });

  it('adds a stub table for FK targets outside public', () => {
    expect(ddl).toContain('CREATE TABLE auth_users (id INT);');
    expect(ddl).toContain('REFERENCES auth_users(id);');
  });

  it('keeps view and function bodies so reads_from edges exist', () => {
    expect(ddl).toContain('CREATE VIEW beach_audit AS SELECT b.id\n   FROM beaches b;');
    expect(ddl).toContain('CREATE VIEW beach_stats AS SELECT id FROM beaches;');
    expect(ddl).toMatch(/CREATE FUNCTION touch\(\) RETURNS void AS \$gfx\$[\s\S]*UPDATE beaches[\s\S]*\$gfx\$ LANGUAGE plpgsql;/);
    expect(ddl).toContain('CREATE TRIGGER touch_alert_rules AFTER INSERT ON alert_rules FOR EACH ROW EXECUTE FUNCTION touch();');
  });

  it('returns no tables for input that is not a pg_dump', () => {
    expect(convertDumpToGraphDdl('SELECT 1;').counts.table).toBe(0);
  });
});
