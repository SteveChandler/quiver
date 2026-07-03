import type { Json } from "@/types/database.generated";

export type SurfDropAudience = "mutuals" | "friends" | "link" | "private";
export type SurfDropLocationType = "known_spot" | "custom_pin";
export type SurfDropStatus = "active" | "expired" | "cancelled" | "notfound";

export interface Bbox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface SurfDropBeach {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
}

export interface SurfDropCreator {
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface SurfDropParticipant {
  user_id: string;
  joined_at: string;
  profile: SurfDropCreator | null;
}

export interface SurfDropRecord {
  id: string;
  user_id: string;
  share_slug: string;
  location_type: SurfDropLocationType;
  beach_id: string | null;
  custom_lat: number | null;
  custom_lon: number | null;
  general_area: string | null;
  exact_label: string | null;
  starts_at: string;
  ends_at: string;
  audience: SurfDropAudience;
  note: string | null;
  forecast_snapshot: Json | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  deleted_at: string | null;
  beach: SurfDropBeach | null;
  creator: SurfDropCreator | null;
  participants_count: number;
}

export interface NormalizedCreateSurfDropInput {
  user_id?: string;
  location_type: SurfDropLocationType;
  beach_id: string | null;
  custom_lat: number | null;
  custom_lon: number | null;
  general_area: string | null;
  exact_label: string | null;
  starts_at: string;
  ends_at: string;
  audience: SurfDropAudience;
  note: string | null;
  forecast_snapshot: Json | null;
}

export type NormalizedUpdateSurfDropInput = Partial<
  Pick<
    NormalizedCreateSurfDropInput,
    | "location_type"
    | "beach_id"
    | "custom_lat"
    | "custom_lon"
    | "general_area"
    | "exact_label"
    | "starts_at"
    | "ends_at"
    | "audience"
    | "note"
    | "forecast_snapshot"
  >
>;

export interface AmenityRecord {
  id: string;
  amenity_type: string;
  lat: number;
  lon: number;
  label: string | null;
  source: string;
  source_ref: string | null;
  confidence: number;
  verified_at: string | null;
  imported_at: string;
  raw: Json | null;
}

export interface QrBusinessVenueRecord {
  id: string;
  name: string;
  lat: number;
  lon: number;
  qr_scan_count: number;
  activation_threshold: number;
  claimed_user_id: string | null;
  activated_at: string | null;
  admin_visible: boolean;
  created_at: string;
}

export interface SurfDropsRepository {
  insertDrop?: (
    row: NormalizedCreateSurfDropInput & { user_id: string; share_slug: string },
  ) => Promise<{ id: string; share_slug: string }>;
  findDropById: (dropId: string) => Promise<SurfDropRecord | null>;
  findDropByShareSlug: (shareSlug: string) => Promise<SurfDropRecord | null>;
  updateDrop?: (
    dropId: string,
    userId: string,
    patch: NormalizedUpdateSurfDropInput,
  ) => Promise<SurfDropRecord | null>;
  cancelDrop?: (
    dropId: string,
    userId: string,
    cancelledAt: string,
  ) => Promise<boolean>;
  upsertLinkGrant: (dropId: string, userId: string) => Promise<void>;
  upsertParticipant: (
    dropId: string,
    userId: string,
    joinedAt: string,
  ) => Promise<void>;
  leaveParticipant?: (
    dropId: string,
    userId: string,
    leftAt: string,
  ) => Promise<void>;
  countActiveParticipants: (dropId: string) => Promise<number>;
  listActiveParticipants?: (dropId: string) => Promise<SurfDropParticipant[]>;
  listVisibleDrops?: (nowIso: string) => Promise<SurfDropRecord[]>;
  viewerHasLinkGrant?: (dropId: string, userId: string) => Promise<boolean>;
  viewerIsParticipant?: (dropId: string, userId: string) => Promise<boolean>;
  viewerIsMutual?: (viewerId: string, ownerId: string) => Promise<boolean>;
  hasBlockBetween?: (viewerId: string, ownerId: string) => Promise<boolean>;
  listAmenities?: (bbox: Bbox, types: string[]) => Promise<AmenityRecord[]>;
  listQrVenues?: (bbox: Bbox) => Promise<QrBusinessVenueRecord[]>;
  findQrVenueById?: (venueId: string) => Promise<QrBusinessVenueRecord | null>;
  updateQrVenueScan?: (
    venueId: string,
    patch: Pick<QrBusinessVenueRecord, "qr_scan_count" | "activated_at">,
  ) => Promise<QrBusinessVenueRecord>;
}

export interface SurfDropTeaserPayload {
  slug: string;
  status: SurfDropStatus;
  creator: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  general_area: string | null;
  starts_at: string | null;
  ends_at: string | null;
  participants_count: number;
  requires_signin: boolean;
  requires_claim: boolean;
  is_known_spot: boolean;
  spot_name?: string;
  forecast_teaser?: {
    wave_height_ft?: Json;
    rating?: Json;
  };
  drop_id?: string;
  custom_pin?: {
    lat: number;
    lon: number;
    exact_label: string | null;
  };
}
