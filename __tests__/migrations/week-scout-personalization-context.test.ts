import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260923041000_week_scout_personalization_context.sql'), 'utf8');

describe('Week Scout personalization migration contract', () => {
  it('delegates every slot to the existing canonical scorer without a copied scoring algorithm', () => {
    expect(sql).toContain('FROM public.compute_user_match_scores(p_user_id, p_beach_ids,');
    expect(sql).not.toContain('public.compute_user_match_score(');
    expect(sql).not.toContain('public.score_user_match_inputs(');
    expect(sql).not.toMatch(/\bLOOP\b/);
    expect(sql).not.toContain('compute_user_match_score_batch(');
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.compute_user_match_score/);
    expect(sql).toContain('SELECT DISTINCT value AS slot FROM jsonb_array_elements(p_slots)');
  });

  it('restricts private user context to the service role and validates candidate scope', () => {
    expect(sql).toMatch(/BEGIN;[\s\S]*COMMIT;/);
    expect(sql).toContain('SECURITY INVOKER');
    expect(sql).toContain('SET search_path = public, pg_temp');
    expect(sql).toContain('FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.get_week_scout_personalization(uuid, uuid[], jsonb) TO service_role;');
    expect(sql).toContain("jsonb_typeof(p_slots) IS DISTINCT FROM 'array'");
    expect(sql).toContain("(slot->>'beach_id')::uuid = ANY(p_beach_ids)");
    expect(sql).toContain('ue.user_id = p_user_id');
    expect(sql).toContain('WITH (security_invoker = true)');
    expect(sql).toContain('a.user_id = p.id');
    expect(sql).toContain('prefs.user_id = p.id');
    expect(sql).toContain('implicit.user_id = p.id');
  });
});
