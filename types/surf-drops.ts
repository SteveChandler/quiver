/**
 * Client-facing Surf Drops payload shapes.
 *
 * Mirrors the API contract shipped by /app/api/go/*, /app/api/surf-drops/*.
 * We deliberately re-declare these here (rather than re-export from
 * lib/surf-drops/types) so client code stays decoupled from Node-only
 * imports (Json comes from types/database.generated).
 *
 * TeaserPayload is derived from SurfDropTeaserPayload (see
 * lib/surf-drops/service.ts::buildSurfDropTeaserPayload).
 *
 * DropDetail mirrors the shape returned by toDropDetailPayload in the
 * same file. We keep DropDetail forecast_snapshot loose (unknown) since
 * consumers read it defensively.
 */

export type SurfDropStatus = "active" | "expired" | "cancelled" | "notfound";
export type SurfDropAudience = "mutuals" | "friends" | "link" | "private";
export type SurfDropLocationType = "known_spot" | "custom_pin";

export interface SurfDropCreatorSummary {
  display_name: string | null;
  avatar_url: string | null;
}

export interface SurfDropTeaser {
  slug: string;
  status: SurfDropStatus;
  creator: SurfDropCreatorSummary | null;
  general_area: string | null;
  starts_at: string | null;
  ends_at: string | null;
  participants_count: number;
  requires_signin: boolean;
  requires_claim: boolean;
  is_known_spot: boolean;
  spot_name?: string;
  forecast_teaser?: {
    wave_height_ft?: unknown;
    rating?: unknown;
  };
  drop_id?: string;
  custom_pin?: {
    lat: number;
    lon: number;
    exact_label: string | null;
  };
}

export interface SurfDropBeach {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
}

export interface SurfDropParticipantProfile {
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface SurfDropParticipant {
  user_id: string;
  joined_at: string;
  profile: SurfDropParticipantProfile | null;
}

export interface SurfDropDetail {
  id: string;
  creator: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  share_slug: string;
  location_type: SurfDropLocationType;
  beach: SurfDropBeach | null;
  custom_pin: {
    lat: number;
    lon: number;
    exact_label: string | null;
  } | null;
  general_area: string | null;
  starts_at: string;
  ends_at: string;
  audience: SurfDropAudience;
  note: string | null;
  forecast_snapshot: unknown;
  participants: SurfDropParticipant[];
  participants_count: number;
  is_joined: boolean;
  can_edit: boolean;
  status: SurfDropStatus;
}

export interface SurfDropClaimResult {
  drop_id: string;
}

export interface SurfDropJoinResult {
  ok: true;
  participants_count: number;
}
