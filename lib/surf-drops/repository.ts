import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AmenityRecord,
  Bbox,
  NormalizedCreateSurfDropInput,
  NormalizedUpdateSurfDropInput,
  QrBusinessVenueRecord,
  SurfDropParticipant,
  SurfDropRecord,
  SurfDropsRepository,
} from "@/lib/surf-drops/types";
import type { Database } from "@/types/database.generated";

type AnySupabase = SupabaseClient<Database> | any;

const DROP_SELECT = `
  id,
  user_id,
  share_slug,
  location_type,
  beach_id,
  custom_lat,
  custom_lon,
  general_area,
  exact_label,
  starts_at,
  ends_at,
  audience,
  note,
  forecast_snapshot,
  created_at,
  updated_at,
  cancelled_at,
  deleted_at,
  beach:beaches(id, name, lat, lon)
`;

function asDb(supabase: AnySupabase): any {
  return supabase as any;
}

async function fetchProfile(
  supabase: AnySupabase,
  userId: string,
): Promise<SurfDropRecord["creator"]> {
  const { data, error } = await asDb(supabase)
    .from("profiles")
    .select("display_name, full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

async function countActiveParticipants(
  supabase: AnySupabase,
  dropId: string,
): Promise<number> {
  const { count, error } = await asDb(supabase)
    .from("surf_drop_participants")
    .select("user_id", { count: "exact", head: true })
    .eq("drop_id", dropId)
    .is("left_at", null);

  if (error) throw error;
  return count ?? 0;
}

async function hydrateDrop(
  supabase: AnySupabase,
  row: any,
): Promise<SurfDropRecord | null> {
  if (!row) return null;
  const [creator, participants_count] = await Promise.all([
    fetchProfile(supabase, row.user_id),
    countActiveParticipants(supabase, row.id),
  ]);

  return {
    ...row,
    beach: Array.isArray(row.beach) ? row.beach[0] ?? null : row.beach ?? null,
    creator,
    participants_count,
  } as SurfDropRecord;
}

export function createSurfDropsRepository(
  supabase: AnySupabase,
): SurfDropsRepository {
  const db = asDb(supabase);

  return {
    async insertDrop(
      row: NormalizedCreateSurfDropInput & { user_id: string; share_slug: string },
    ): Promise<{ id: string; share_slug: string }> {
      const { data, error } = await db
        .from("surf_drops")
        .insert(row)
        .select("id, share_slug")
        .single();

      if (error) throw error;
      return data;
    },

    async findDropById(dropId: string): Promise<SurfDropRecord | null> {
      const { data, error } = await db
        .from("surf_drops")
        .select(DROP_SELECT)
        .eq("id", dropId)
        .maybeSingle();

      if (error) throw error;
      return hydrateDrop(supabase, data);
    },

    async findDropByShareSlug(shareSlug: string): Promise<SurfDropRecord | null> {
      const { data, error } = await db
        .from("surf_drops")
        .select(DROP_SELECT)
        .eq("share_slug", shareSlug)
        .maybeSingle();

      if (error) throw error;
      return hydrateDrop(supabase, data);
    },

    async updateDrop(
      dropId: string,
      userId: string,
      patch: NormalizedUpdateSurfDropInput,
    ): Promise<SurfDropRecord | null> {
      const { data, error } = await db
        .from("surf_drops")
        .update(patch)
        .eq("id", dropId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .select(DROP_SELECT)
        .maybeSingle();

      if (error) throw error;
      return hydrateDrop(supabase, data);
    },

    async cancelDrop(
      dropId: string,
      userId: string,
      cancelledAt: string,
    ): Promise<boolean> {
      const { data, error } = await db
        .from("surf_drops")
        .update({ cancelled_at: cancelledAt })
        .eq("id", dropId)
        .eq("user_id", userId)
        .is("cancelled_at", null)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      return Boolean(data);
    },

    async upsertLinkGrant(dropId: string, userId: string): Promise<void> {
      const { error } = await db
        .from("surf_drop_link_grants")
        .upsert(
          { drop_id: dropId, user_id: userId },
          { onConflict: "drop_id,user_id", ignoreDuplicates: true },
        );

      if (error) throw error;
    },

    async upsertParticipant(
      dropId: string,
      userId: string,
      joinedAt: string,
    ): Promise<void> {
      const { error } = await db
        .from("surf_drop_participants")
        .upsert(
          {
            drop_id: dropId,
            user_id: userId,
            joined_at: joinedAt,
            left_at: null,
          },
          { onConflict: "drop_id,user_id" },
        );

      if (error) throw error;
    },

    async leaveParticipant(
      dropId: string,
      userId: string,
      leftAt: string,
    ): Promise<void> {
      const { error } = await db
        .from("surf_drop_participants")
        .update({ left_at: leftAt })
        .eq("drop_id", dropId)
        .eq("user_id", userId)
        .is("left_at", null);

      if (error) throw error;
    },

    async countActiveParticipants(dropId: string): Promise<number> {
      return countActiveParticipants(supabase, dropId);
    },

    async listActiveParticipants(dropId: string): Promise<SurfDropParticipant[]> {
      const { data, error } = await db
        .from("surf_drop_participants")
        .select("user_id, joined_at")
        .eq("drop_id", dropId)
        .is("left_at", null)
        .order("joined_at", { ascending: true });

      if (error) throw error;

      const rows = data ?? [];
      const profiles = await Promise.all(
        rows.map((row: { user_id: string }) => fetchProfile(supabase, row.user_id)),
      );

      return rows.map((row: { user_id: string; joined_at: string }, index: number) => ({
        user_id: row.user_id,
        joined_at: row.joined_at,
        profile: profiles[index],
      }));
    },

    async listVisibleDrops(nowIso: string): Promise<SurfDropRecord[]> {
      const { data, error } = await db
        .from("surf_drops")
        .select(DROP_SELECT)
        .is("cancelled_at", null)
        .is("deleted_at", null)
        .gt("ends_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(500);

      if (error) throw error;
      return Promise.all((data ?? []).map((row: any) => hydrateDrop(supabase, row)));
    },

    async viewerHasLinkGrant(dropId: string, userId: string): Promise<boolean> {
      const { data, error } = await db
        .from("surf_drop_link_grants")
        .select("drop_id")
        .eq("drop_id", dropId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return Boolean(data);
    },

    async viewerIsParticipant(dropId: string, userId: string): Promise<boolean> {
      const { data, error } = await db
        .from("surf_drop_participants")
        .select("drop_id")
        .eq("drop_id", dropId)
        .eq("user_id", userId)
        .is("left_at", null)
        .maybeSingle();

      if (error) throw error;
      return Boolean(data);
    },

    async viewerIsMutual(viewerId: string, ownerId: string): Promise<boolean> {
      const { data, error } = await db.rpc("is_mutual_follow", {
        a: viewerId,
        b: ownerId,
      });

      if (error) throw error;
      return data === true;
    },

    async hasBlockBetween(viewerId: string, ownerId: string): Promise<boolean> {
      const { data, error } = await db.rpc("has_user_block_between", {
        a: viewerId,
        b: ownerId,
      });

      if (error) throw error;
      return data === true;
    },

    async listAmenities(bbox: Bbox, types: string[]): Promise<AmenityRecord[]> {
      let query = db
        .from("amenities")
        .select("id, amenity_type, lat, lon, label, source, source_ref, confidence, verified_at, imported_at, raw")
        .gte("lon", bbox.minLon)
        .lte("lon", bbox.maxLon)
        .gte("lat", bbox.minLat)
        .lte("lat", bbox.maxLat)
        .order("confidence", { ascending: false })
        .limit(500);

      if (types.length > 0) {
        query = query.in("amenity_type", types);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },

    async listQrVenues(bbox: Bbox): Promise<QrBusinessVenueRecord[]> {
      const { data, error } = await db
        .from("qr_business_venues")
        .select("id, name, lat, lon, qr_scan_count, activation_threshold, claimed_user_id, activated_at, admin_visible, created_at")
        .or("activated_at.not.is.null,admin_visible.eq.true")
        .gte("lon", bbox.minLon)
        .lte("lon", bbox.maxLon)
        .gte("lat", bbox.minLat)
        .lte("lat", bbox.maxLat)
        .order("name", { ascending: true })
        .limit(200);

      if (error) throw error;
      return data ?? [];
    },

    async findQrVenueById(venueId: string): Promise<QrBusinessVenueRecord | null> {
      const { data, error } = await db
        .from("qr_business_venues")
        .select("id, name, lat, lon, qr_scan_count, activation_threshold, claimed_user_id, activated_at, admin_visible, created_at")
        .eq("id", venueId)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },

    async updateQrVenueScan(
      venueId: string,
      patch: Pick<QrBusinessVenueRecord, "qr_scan_count" | "activated_at">,
    ): Promise<QrBusinessVenueRecord> {
      const { data, error } = await db
        .from("qr_business_venues")
        .update(patch)
        .eq("id", venueId)
        .select("id, name, lat, lon, qr_scan_count, activation_threshold, claimed_user_id, activated_at, admin_visible, created_at")
        .single();

      if (error) throw error;
      return data;
    },
  };
}
