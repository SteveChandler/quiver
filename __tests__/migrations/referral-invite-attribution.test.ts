import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260521200000_referral_invite_attribution.sql"
  ),
  "utf8"
);

describe("referral invite attribution migration", () => {
  it("is wrapped in a transaction", () => {
    expect(migrationSQL).toMatch(/^BEGIN;/m);
    expect(migrationSQL).toMatch(/^COMMIT;/m);
  });

  it("adds source with referral_code defaults and invite_token support", () => {
    expect(migrationSQL).toMatch(/ADD COLUMN IF NOT EXISTS source text/i);
    expect(migrationSQL).toMatch(/SET source = 'referral_code'/i);
    expect(migrationSQL).toMatch(/ALTER COLUMN source SET DEFAULT 'referral_code'/i);
    expect(migrationSQL).toMatch(/ALTER COLUMN source SET NOT NULL/i);
    expect(migrationSQL).toMatch(/CONSTRAINT referrals_source_check/i);
    expect(migrationSQL).toContain("'referral_code'");
    expect(migrationSQL).toContain("'invite_token'");
  });

  it("defines record_referral_attribution as an auth-guarded SECURITY DEFINER RPC", () => {
    expect(migrationSQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.record_referral_attribution\(\s*referrer uuid,\s*referee uuid,\s*source text,\s*referral_code text DEFAULT NULL\s*\) RETURNS jsonb/i
    );
    expect(migrationSQL).toMatch(/SECURITY DEFINER/i);
    expect(migrationSQL).toMatch(/SET search_path = public/i);
    expect(migrationSQL).toMatch(/auth\.uid\(\) IS DISTINCT FROM \$2/i);
    expect(migrationSQL).toMatch(/cannot refer yourself/i);
    expect(migrationSQL).toMatch(/public\.generate_referral_code\(\)/i);
    expect(migrationSQL).toMatch(/ON CONFLICT \(referee_id\) DO NOTHING/i);
    expect(migrationSQL).toMatch(/'created', true/i);
    expect(migrationSQL).toMatch(/'existing', true/i);
  });

  it("defines accept_invite_for_user as a shared invite acceptance RPC", () => {
    expect(migrationSQL).toMatch(
      /CREATE OR REPLACE FUNCTION public\.accept_invite_for_user\(\s*inviter uuid,\s*invitee uuid\s*\) RETURNS jsonb/i
    );
    expect(migrationSQL).toMatch(/auth\.uid\(\) IS DISTINCT FROM \$2/i);
    expect(migrationSQL).toMatch(/INSERT INTO public\.user_follows \(follower_id, following_id\)/i);
    expect(migrationSQL).toMatch(/ON CONFLICT \(follower_id, following_id\) DO NOTHING/i);
    expect(migrationSQL).toMatch(/public\.record_referral_attribution\(\s*\$1,\s*\$2,\s*'invite_token',\s*NULL\s*\)/i);
    expect(migrationSQL).toMatch(/'follow_created'/i);
    expect(migrationSQL).toMatch(/'referral_existing'/i);
  });

  it("grants both RPCs to authenticated callers", () => {
    expect(migrationSQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.record_referral_attribution\(uuid, uuid, text, text\)\s+TO authenticated, service_role/i
    );
    expect(migrationSQL).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.accept_invite_for_user\(uuid, uuid\)\s+TO authenticated, service_role/i
    );
  });
});
