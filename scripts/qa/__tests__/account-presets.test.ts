/** @jest-environment node */
import { ACCOUNT_SCENARIOS, QA_REGISTRY, accountEmail, assertLease, assertOwnedAccount, localUrl, resetAccountSql, scenarioName } from '../account-presets';
const id='11111111-1111-4111-8111-111111111111', beach='22222222-2222-4222-8222-222222222222';
it('keeps the standard trial at fourteen days and the manual gift at three months', () => {
 expect(resetAccountSql('trial',id,beach)).toContain("now()+interval '14 days'");
 expect(resetAccountSql('trial',id,beach)).not.toContain("interval '1 month'");
 expect(resetAccountSql('gift',id,beach)).toContain("now()+interval '3 months'");
});
it.each(['https://project.supabase.co','http://localhost.evil.com','http://evil.test/?next=127.0.0.1','http://user:password@localhost','http://127.0.0.1/proxy','http://127.0.0.1?host=prod'])('refuses unsafe endpoint %s', value => { expect(() => localUrl(value)).toThrow(); });
it.each(['http://127.0.0.1:54321','http://localhost:54321','postgresql://postgres:local@127.0.0.1:54322/postgres'])('accepts direct local endpoint %s', value => { expect(localUrl(value).port).toMatch(/^5432[12]$/); });
it('rejects arbitrary scenarios, identities and unregistered users', () => {
 expect(() => scenarioName('__proto__')).toThrow();
 expect(() => resetAccountSql('five',"';DELETE",beach)).toThrow();
 expect(() => assertOwnedAccount({id,email:accountEmail('five'),app_metadata:{}},'five')).toThrow();
 expect(() => assertOwnedAccount({id,email:'owner@gmail.com',app_metadata:{qa_registry:QA_REGISTRY,qa_scenario:'five'}},'five')).toThrow();
});
it('leases prevent simultaneous worktree use, with explicit expiry', () => {
 expect(() => assertLease({owner:'other',expires_at:'2030-01-01'},'me',0)).toThrow();
 expect(() => assertLease({owner:'other',expires_at:'broken'},'me',0)).toThrow();
 expect(() => assertLease({owner:'me',expires_at:'2030-01-01'},'me',0)).not.toThrow();
 expect(() => assertLease({owner:'other',expires_at:'2000-01-01'},'me',Date.now())).not.toThrow();
});
it.each(Object.keys(ACCOUNT_SCENARIOS))('generates scoped, deterministic reset for %s', name => {
 const scenario=scenarioName(name), sql=resetAccountSql(scenario,id,beach);
 expect(sql).toBe(resetAccountSql(scenario,id,beach));
 expect(sql).toContain(`DELETE FROM sessions WHERE user_id='${id}'`);
 expect(sql).toContain('QA ownership check failed');
 expect(sql).toContain('Provider-managed access found');
 expect(sql).toContain('simulated_local_only');
 expect(sql.match(/90,'completed',4/g)?.length ?? 0).toBe(ACCOUNT_SCENARIOS[scenario].sessions);
 expect(sql).toMatch(/^BEGIN;/);expect(sql).toMatch(/COMMIT;$/);
});
