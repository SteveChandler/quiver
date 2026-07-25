import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationSQL = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260725122000_add_growth_activation_semantic_views.sql",
  ),
  "utf8",
);
const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

describe("growth activation semantic views migration", () => {
  it("creates three security-invoker views with separate grains", () => {
    for (const viewName of [
      "growth_web_signup_activation_v1",
      "growth_native_install_activation_v1",
      "growth_app_handoff_v1",
    ]) {
      expect(normalizedSQL).toContain(
        `create or replace view public.${viewName} with (security_invoker = true) as`,
      );
    }

    expect(normalizedSQL).toContain(
      "row_number() over ( partition by p.id",
    );
    expect(normalizedSQL).toContain(
      "partition by nullif(ue.metadata->>'native_install_id', '')",
    );
    expect(normalizedSQL).toContain("group by he.handoff_id");
  });

  it("uses strict real-user, bot, founder, Maestro, and native-device filters", () => {
    for (const exclusion of [
      "p.analytics_is_real_user = true",
      "coalesce(p.is_mock, false) = false",
      "coalesce(p.is_system_account, false) = false",
      "p.deleted_at is null",
      "73040cff-afe9-4fa0-a874-2016203fc015",
      "c15c2ab3-275c-49d1-ac4f-dcc493db0653",
      "coalesce(ue.bot_flagged, false) = false",
      "coalesce(ue.metadata->>'is_emulator', 'false') not in ('true', '1')",
      "coalesce(ue.metadata->>'is_test', 'false') not in ('true', '1')",
    ]) {
      expect(normalizedSQL).toContain(exclusion);
    }

    expect(normalizedSQL).toContain("ue.event_type = 'native_app_first_open'");
    expect(normalizedSQL).toContain(
      "coalesce(ue.metadata->>'platform', ue.metadata->>'_platform') in",
    );
    expect(normalizedSQL).toContain(
      "nullif(ue.metadata->>'native_install_id', '') ~*",
    );
  });

  it("does not classify native signup or auth events as web behavior", () => {
    expect(normalizedSQL).toMatch(
      /ue\.event_type = 'signup_success'[\s\S]{0,700}coalesce\(\s*ue\.metadata->>'platform',\s*ue\.metadata->>'_platform',\s*'web'\s*\) not in/i,
    );
    expect(normalizedSQL).toMatch(
      /ue\.event_type in \('signed_in', 'signup_success', 'login_success'\)[\s\S]{0,500}coalesce\(ue\.metadata->>'platform', ue\.metadata->>'_platform'\) in/i,
    );
  });

  it("keeps missing source unknown and labels evidence explicitly", () => {
    expect(normalizedSQL).toContain("as source_capture_status");
    expect(normalizedSQL).toContain("as source_group");
    expect(normalizedSQL).toContain("as evidence_level");
    expect(normalizedSQL).toContain("then 'direct'");
    expect(normalizedSQL).toContain(
      "signup_context->>'referrer' = 'direct'",
    );
    expect(normalizedSQL).toContain("else 'unknown'");
    expect(normalizedSQL).not.toMatch(
      /coalesce\([^;]{0,240}'direct'\)\s+as source_group/i,
    );
  });

  it("uses exact cohort windows and only meaningful product activity for returns", () => {
    for (const boundary of [
      "interval '24 hours'",
      "interval '48 hours'",
      "interval '7 days'",
      "interval '168 hours'",
      "interval '192 hours'",
    ]) {
      expect(normalizedSQL).toContain(boundary);
    }

    expect(normalizedSQL).toContain("product_activity_events as");
    expect(normalizedSQL).toContain("'beach_view'");
    expect(normalizedSQL).toContain("'forecast_interaction'");
    expect(normalizedSQL).toContain("'home_beach_forecast_viewed'");
    expect(normalizedSQL).toContain("'session_log_start'");
    expect(normalizedSQL).not.toMatch(
      /product_activity_events[\s\S]{0,1800}event_type\s+in\s*\([^)]*'login_success'/i,
    );
  });

  it("derives persisted activation from completed non-deleted sessions", () => {
    expect(normalizedSQL).toContain("from public.sessions s");
    expect(normalizedSQL).toContain("s.status = 'completed'");
    expect(normalizedSQL).toContain("s.deleted_at is null");
    expect(normalizedSQL).toContain("as first_persisted_session_at");
    expect(normalizedSQL).toContain("as persisted_session_within_7d");
  });

  it("joins native and handoff outcomes only through exact linked identities", () => {
    expect(normalizedSQL).toMatch(
      /(?:ue|pae)\.user_id = nc\.linked_profile_id/,
    );
    expect(normalizedSQL).toContain(
      "ue.user_id = hc.linked_profile_id",
    );
    expect(normalizedSQL).toContain(
      "nc.linked_profile_id is not null",
    );
    expect(normalizedSQL).toContain(
      "hc.linked_profile_id is not null",
    );
  });

  it("publishes eligibility, stage timestamps, D1/D7 flags, and no PII", () => {
    for (const field of [
      "cohort_anchor",
      "eligible_24h",
      "eligible_7d",
      "eligible_d1",
      "eligible_d7",
      "d1_returned",
      "d7_returned",
      "first_persisted_session_at",
    ]) {
      expect(normalizedSQL).toContain(field);
    }

    expect(normalizedSQL).not.toContain("p.email");
    expect(normalizedSQL).not.toContain("auth.users");
    expect(normalizedSQL).not.toContain("raw_user_meta_data");
    expect(normalizedSQL).not.toContain("signup_location");
    expect(normalizedSQL).not.toContain("phone_number");
  });

  it("revokes public roles and grants SELECT only to service_role", () => {
    for (const viewName of [
      "growth_web_signup_activation_v1",
      "growth_native_install_activation_v1",
      "growth_app_handoff_v1",
    ]) {
      expect(normalizedSQL).toContain(
        `revoke all on public.${viewName} from public, anon, authenticated`,
      );
      expect(normalizedSQL).toContain(
        `grant select on public.${viewName} to service_role`,
      );
    }
  });
});
