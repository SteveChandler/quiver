import { createHash } from "node:crypto";

export const ACCOUNT_SCENARIOS = {
  fresh: { sessions: 0, access: "free", paused: false, description: "New user, onboarding incomplete" },
  free: { sessions: 0, access: "free", paused: false, description: "Onboarded free user, no sessions" },
  four: { sessions: 4, access: "free", paused: false, description: "One session away from the reward" },
  five: { sessions: 5, access: "free", paused: false, description: "Five historical completed sessions" },
  trial: { sessions: 5, access: "trial", paused: false, description: "Simulated active trial" },
  paid: { sessions: 5, access: "paid", paused: false, description: "Simulated paid subscriber" },
  gift: { sessions: 5, access: "gift", paused: false, description: "Simulated three-month gift" },
  expired: { sessions: 5, access: "expired", paused: false, description: "Expired access; free again" },
} as const;
export type AccountScenario = keyof typeof ACCOUNT_SCENARIOS;
export const QA_REGISTRY = "quiver-local-qa-v1";

export function scenarioName(value: string | undefined): AccountScenario {
  if (!value || !Object.hasOwn(ACCOUNT_SCENARIOS, value)) throw new Error("Choose a scenario from qa:accounts list");
  return value as AccountScenario;
}

export function localUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "postgresql:", "postgres:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.search || url.hash ||
    (url.protocol === "http:" && (url.username || url.password || url.pathname !== "/"))) {
    throw new Error("QA accounts require a direct loopback URL; hosted environments are refused");
  }
  return url;
}

export function accountEmail(scenario: AccountScenario): string {
  return `qa-lifecycle-${scenario}@quivertest.local`;
}

export function assertOwnedAccount(user: { id: string; email?: string; app_metadata: Record<string, unknown> }, scenario: AccountScenario): void {
  if (user.email !== accountEmail(scenario) || user.app_metadata.qa_registry !== QA_REGISTRY || user.app_metadata.qa_scenario !== scenario) {
    throw new Error("Refusing an account outside the QA registry");
  }
}

export function assertLease(lease: { owner: string; expires_at: string } | undefined, owner: string, now: number): void {
  if (lease && lease.owner !== owner && (!Number.isFinite(Date.parse(lease.expires_at)) || Date.parse(lease.expires_at) > now)) {
    throw new Error("Account is leased by another worktree; release it there or wait for expiry");
  }
}

function uuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error("Invalid QA identity");
  return value;
}

export function resetAccountSql(scenario: AccountScenario, userId: string, beachId: string): string {
  const user = uuid(userId), beach = uuid(beachId), preset = ACCOUNT_SCENARIOS[scenario];
  const pro = ["trial", "paid", "gift"].includes(preset.access);
  const expiry = preset.access === "expired" ? "now()-interval '1 day'" : preset.access === "gift" ? "now()+interval '3 months'" : preset.access === "trial" ? "now()+interval '14 days'" : "now()+interval '1 month'";
  const rows = Array.from({ length: preset.sessions }, (_, index) => {
    const hex = createHash("sha256").update(`${QA_REGISTRY}:${user}:${index}`).digest("hex");
    const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
    return `('${id}','${user}','${beach}',now()-interval '${index+1} days',90,'completed',4,'QA scenario fixture')`;
  });
  return `BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(hashtextextended('${user}',0));
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id='${user}' AND email='${accountEmail(scenario)}'
   AND raw_app_meta_data->>'qa_registry'='${QA_REGISTRY}' AND raw_app_meta_data->>'qa_scenario'='${scenario}') THEN
   RAISE EXCEPTION 'QA ownership check failed'; END IF;
 IF EXISTS (SELECT 1 FROM user_entitlements WHERE user_id='${user}' AND
   ((product_id IS NOT NULL AND left(product_id,11)<>'qa_fixture_')
    OR (rc_raw IS NOT NULL AND rc_raw->>'qa_registry' IS DISTINCT FROM '${QA_REGISTRY}')
    OR ((is_pro OR is_trialing) AND product_id IS NULL))) THEN
   RAISE EXCEPTION 'Provider-managed access found; reset the sandbox provider before preparing this fixture'; END IF;
END $$;
UPDATE profiles SET is_mock=true, display_name='QA ${scenario}', notif_email_enabled=false, notif_push_enabled=false,
 home_beach_id='${beach}', timezone='America/Los_Angeles', onboarding_completed_at=${scenario === "fresh" ? "NULL" : "now()"} WHERE id='${user}';
DELETE FROM sessions WHERE user_id='${user}';
${rows.length ? `INSERT INTO sessions(id,user_id,beach_id,arrival_time,duration_minutes,status,rating,notes) VALUES ${rows.join(",")};` : ""}
INSERT INTO user_entitlements(user_id,is_pro,is_trialing,trial_ends_at,expires_at,product_id,will_renew,rc_raw)
VALUES('${user}',${pro},${preset.access === "trial"},${preset.access === "trial" ? expiry : "NULL"},${preset.access === "free" ? "NULL" : expiry},'qa_fixture_${preset.access}',${preset.access === "paid" || preset.access === "trial"},'{"qa_registry":"${QA_REGISTRY}","evidence":"simulated_local_only"}')
ON CONFLICT(user_id) DO UPDATE SET is_pro=excluded.is_pro,is_trialing=excluded.is_trialing,trial_ends_at=excluded.trial_ends_at,
 expires_at=excluded.expires_at,product_id=excluded.product_id,will_renew=excluded.will_renew,rc_raw=excluded.rc_raw,billing_issue=false;
COMMIT;`;
}
