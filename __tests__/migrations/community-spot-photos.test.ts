import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260725230000_create_community_spot_photos.sql",
  ),
  "utf8",
).toLowerCase();

describe("community spot photo schema", () => {
  it("uses an additive private canonical model and bucket", () => {
    for (const table of [
      "community_spot_photos",
      "community_photo_consents",
      "community_photo_votes",
      "community_photo_reports",
      "community_photo_moderation_events",
      "community_photo_feature_pins",
      "community_photo_investigation_holds",
      "community_photo_contributor_restrictions",
      "community_photo_action_events",
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`,
      );
    }
    expect(sql).toContain("'community-spot-photos'");
    expect(sql).toContain("public = false");
    expect(sql).not.toContain("alter table public.beach_photo_submissions");
    expect(sql).toContain(
      "drop policy if exists bps_insert_own on public.beach_photo_submissions",
    );
    expect(sql).toContain(
      "drop policy if exists bps_update_own on public.beach_photo_submissions",
    );
    expect(sql).toContain(
      "drop policy if exists bpsv_insert_own on public.beach_photo_submission_votes",
    );
    expect(sql).toContain(
      "drop policy if exists bpsv_delete_own on public.beach_photo_submission_votes",
    );
  });

  it("enforces immediate publication, bounded targets and consent", () => {
    expect(sql).toContain("processing_status");
    expect(sql).toContain("'visible'");
    expect(sql).toMatch(/target_type[\s\S]*'beach'[\s\S]*'custom_spot'/);
    expect(sql).toContain("terms_version");
    expect(sql).toContain("rights_confirmed");
    expect(sql).toContain("2026-07-25");
    expect(sql).toContain("3 active photos per contributor and target");
    expect(sql).toContain("5 rolling uploads per 24 hours");
    expect(sql).toContain(
      "preflight_community_spot_photo_upload_v1",
    );
  });

  it("makes failed attempts terminal and distinguishes processing from ready replays", () => {
    const preflight = sql.match(
      /create or replace function public\.preflight_community_spot_photo_upload_v1\(([\s\S]*?)\n\$\$;/,
    )?.[0];
    const reservation = sql.match(
      /create or replace function public\.reserve_community_spot_photo_v1\(([\s\S]*?)\n\$\$;/,
    )?.[0];
    const failure = sql.match(
      /create or replace function public\.fail_community_spot_photo_upload_v1\(([\s\S]*?)\n\$\$;/,
    )?.[0];

    expect(preflight).toContain("p_idempotency_key uuid");
    expect(preflight).toContain("upload_attempt_failed");
    expect(preflight).toContain("upload_reserved");
    expect(reservation).toContain("processing_status");
    expect(reservation).toContain("storage_path");
    expect(reservation).toContain("upload_attempt_failed");
    expect(reservation).toMatch(
      /existing_status[\s\S]*return query/,
    );
    expect(reservation).toMatch(
      /'upload_failed'[\s\S]*raise exception 'upload_attempt_failed'/,
    );
    expect(failure).not.toMatch(
      /delete from public\.community_photo_action_events/,
    );
    expect(failure).toMatch(
      /'upload_failed'[\s\S]*on conflict \(actor_id, action, idempotency_key\)/,
    );
  });

  it("keeps voter and reporter identities private and permits anonymized photos", () => {
    expect(sql).toContain("voter_id");
    expect(sql).toContain("reporter_id");
    expect(sql).toContain("photo_owner_cannot_vote");
    expect(sql).toContain(
      "owner_id is not null and owner_id = p_voter_id",
    );
    expect(sql).toContain(
      "owner_id is not null and owner_id = p_reporter_id",
    );
    expect(sql).not.toMatch(/grant select on table public\.community_photo_(votes|reports)/);
  });

  it("implements severe immediate hide and three-reporter quality hide", () => {
    expect(sql).toMatch(/'explicit'[\s\S]*'privacy'[\s\S]*'safety'/);
    expect(sql).toMatch(/'wrong_spot'[\s\S]*'stale'/);
    expect(sql).toContain(">= 3");
    expect(sql).toContain("moderation_status = 'hidden'");
  });

  it("uses Wilson ranking with no recency and deterministic UUID tie breaking", () => {
    expect(sql).toContain("community_photo_wilson_lower_bound");
    expect(sql).toContain("1.959963984540054");
    expect(sql).toContain("when (p_upvotes + p_downvotes) < 5 then 0");
    expect(sql).toMatch(
      /order by[\s\S]*is_pinned desc[\s\S]*wilson_score desc[\s\S]*\(c\.upvotes \+ c\.downvotes\) desc[\s\S]*photo_id asc/,
    );
    const resolver = sql.match(
      /create or replace function public\.resolve_community_spot_photos_v1\(([\s\S]*?)\n\$\$;/,
    )?.[0];
    expect(resolver).toMatch(
      /community_photo_feature_config[\s\S]*read_enabled/,
    );
    expect(resolver).not.toContain("created_at desc");
  });

  it("fails closed for direct image reads when database reads are disabled", () => {
    const imageResolver = sql.match(
      /create or replace function public\.get_community_spot_photo_image_v1\(([\s\S]*?)\n\$\$;/,
    )?.[0];

    expect(imageResolver).toMatch(
      /community_photo_feature_config[\s\S]*read_enabled/,
    );
  });

  it("supports audited reversible pins, 30-day removal recovery, holds and purge", () => {
    expect(sql).toContain("revoked_at");
    expect(sql).toContain("community_photo_moderation_events");
    expect(sql).toContain("recoverable_until");
    expect(sql).toContain("interval '30 days'");
    expect(sql).toContain("community_photo_investigation_holds");
    expect(sql).toContain("purge_removed_community_spot_photos_v1");
    expect(sql).toContain("not exists");
    expect(sql).toContain("recover_owned_community_spot_photo_v1");
    expect(sql).toContain("list_owned_removed_community_spot_photos_v1");
    expect(sql).toContain("moderation_status = 'visible'");
    expect(sql).toContain("for update");
    expect(sql).toMatch(
      /hold_community_spot_photo_v1[\s\S]*lifecycle_status[\s\S]*for update/,
    );
    expect(sql).toMatch(
      /claimed as[\s\S]*not exists[\s\S]*community_photo_investigation_holds/,
    );
  });

  it("uses direct upload resolution and audited hidden-media access", () => {
    expect(sql).toContain("resolve_community_spot_photo_by_id_v1");
    expect(sql).toContain("get_admin_community_spot_photo_image_v1");
    expect(sql).toContain("'admin_view_hidden'");
    expect(sql).toMatch(
      /get_admin_community_spot_photo_image_v1[\s\S]*moderation_status = 'hidden'[\s\S]*lifecycle_status in \('active', 'removed'\)/,
    );
  });

  it("claims stuck processing uploads and inventories storage orphans", () => {
    expect(sql).toMatch(
      /processing_status[\s\S]*'processing'[\s\S]*'ready'[\s\S]*'cleanup'/,
    );
    expect(sql).toContain(
      "claim_stuck_community_spot_photo_uploads_v1",
    );
    expect(sql).toContain(
      "finalize_stuck_community_spot_photo_uploads_v1",
    );
    expect(sql).toContain(
      "release_stuck_community_spot_photo_uploads_v1",
    );
    expect(sql).toContain("list_orphan_community_photo_objects_v1");
    expect(sql).toContain("storage.objects");
    expect(sql).toMatch(
      /finalize_community_spot_photo_v1[\s\S]*processing_status = 'processing'/,
    );
  });

  it("anonymizes account deletion and exposes only service-role RPCs", () => {
    expect(sql).toContain("on delete set null");
    expect(sql).toContain("'quiver community'");
    expect(sql).toContain("service_role");
    expect(sql).not.toMatch(
      /grant execute on function public\.[^(]+\([^;]+ to authenticated/,
    );
  });
});
