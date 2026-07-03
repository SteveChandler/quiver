import { generateSurfDropSlug } from "@/lib/surf-drops/slug";
import {
  normalizeCreateSurfDropInput,
  normalizeUpdateSurfDropInput,
} from "@/lib/surf-drops/validation";
import type {
  Bbox,
  NormalizedUpdateSurfDropInput,
  QrBusinessVenueRecord,
  SurfDropRecord,
  SurfDropStatus,
  SurfDropTeaserPayload,
  SurfDropsRepository,
} from "@/lib/surf-drops/types";
import type { Json } from "@/types/database.generated";

export class SurfDropServiceError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "SurfDropServiceError";
    this.status = status;
    this.details = details;
  }
}

function isObject(value: Json | null): value is Record<string, Json> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getForecastTeaser(snapshot: Json | null): SurfDropTeaserPayload["forecast_teaser"] {
  if (!isObject(snapshot)) return undefined;
  const teaser: NonNullable<SurfDropTeaserPayload["forecast_teaser"]> = {};
  if ("wave_height_ft" in snapshot) teaser.wave_height_ft = snapshot.wave_height_ft;
  if ("rating" in snapshot) teaser.rating = snapshot.rating;
  return Object.keys(teaser).length > 0 ? teaser : undefined;
}

export function getSurfDropStatus(
  drop: SurfDropRecord | null,
  now: Date = new Date(),
): SurfDropStatus {
  if (!drop || drop.deleted_at) return "notfound";
  if (drop.cancelled_at) return "cancelled";
  if (new Date(drop.ends_at).getTime() <= now.getTime()) return "expired";
  return "active";
}

function assertDropActive(
  drop: SurfDropRecord | null,
  now: Date,
): SurfDropRecord {
  const status = getSurfDropStatus(drop, now);
  if (!drop || status === "notfound") {
    throw new SurfDropServiceError(404, "Surf Drop not found");
  }
  if (status === "cancelled") {
    throw new SurfDropServiceError(410, "Surf Drop is cancelled");
  }
  if (status === "expired") {
    throw new SurfDropServiceError(410, "Surf Drop has expired");
  }
  return drop;
}

export function buildSurfDropTeaserPayload(
  drop: SurfDropRecord | null,
  options: {
    viewerAuthorized: boolean;
    viewerSignedIn: boolean;
    now?: Date;
    slug?: string;
  },
): SurfDropTeaserPayload {
  const now = options.now ?? new Date();
  const status = getSurfDropStatus(drop, now);

  if (!drop || status === "notfound") {
    return {
      slug: options.slug ?? "",
      status: "notfound",
      creator: null,
      general_area: null,
      starts_at: null,
      ends_at: null,
      participants_count: 0,
      requires_signin: false,
      requires_claim: false,
      is_known_spot: false,
    };
  }

  const creatorName =
    drop.creator?.display_name?.trim() ||
    drop.creator?.full_name?.trim() ||
    "A surfer";
  const isActiveAuthorized = status === "active" && options.viewerAuthorized;
  const payload: SurfDropTeaserPayload = {
    slug: drop.share_slug,
    status,
    creator: {
      display_name: creatorName,
      avatar_url: drop.creator?.avatar_url ?? null,
    },
    general_area: drop.general_area,
    starts_at: drop.starts_at,
    ends_at: drop.ends_at,
    participants_count: drop.participants_count,
    requires_signin: status === "active" && !options.viewerSignedIn,
    requires_claim: status === "active" && !options.viewerAuthorized,
    is_known_spot: drop.location_type === "known_spot",
    forecast_teaser: getForecastTeaser(drop.forecast_snapshot),
  };

  if (drop.location_type === "known_spot" && drop.beach?.name) {
    payload.spot_name = drop.beach.name;
  }

  if (
    isActiveAuthorized &&
    drop.location_type === "custom_pin" &&
    drop.custom_lat != null &&
    drop.custom_lon != null
  ) {
    payload.drop_id = drop.id;
    payload.custom_pin = {
      lat: drop.custom_lat,
      lon: drop.custom_lon,
      exact_label: drop.exact_label,
    };
  } else if (isActiveAuthorized) {
    payload.drop_id = drop.id;
  }

  return payload;
}

export async function createSurfDrop(
  repository: SurfDropsRepository,
  userId: string,
  rawInput: unknown,
  now: Date = new Date(),
  slugFactory: () => string = generateSurfDropSlug,
): Promise<{ id: string; share_slug: string }> {
  if (!repository.insertDrop) {
    throw new SurfDropServiceError(500, "Surf Drop repository cannot insert drops");
  }

  const input = normalizeCreateSurfDropInput(rawInput, now);
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const share_slug = slugFactory();
    try {
      return await repository.insertDrop({
        ...input,
        user_id: userId,
        share_slug,
      });
    } catch (error) {
      const maybeError = error as { code?: string; message?: string };
      if (maybeError.code !== "23505" && !maybeError.message?.includes("share_slug")) {
        throw error;
      }
      lastError = error;
    }
  }

  throw new SurfDropServiceError(500, "Unable to generate unique Surf Drop link", lastError);
}

export async function updateSurfDrop(
  repository: SurfDropsRepository,
  input: {
    dropId: string;
    userId: string;
    patch: unknown;
    now?: Date;
  },
): Promise<SurfDropRecord> {
  if (!repository.updateDrop) {
    throw new SurfDropServiceError(500, "Surf Drop repository cannot update drops");
  }

  const existing = await repository.findDropById(input.dropId);
  const drop = assertDropActive(existing, input.now ?? new Date());
  if (drop.user_id !== input.userId) {
    throw new SurfDropServiceError(403, "Only the creator can edit this Surf Drop");
  }

  const patch: NormalizedUpdateSurfDropInput = normalizeUpdateSurfDropInput(
    input.patch,
    drop,
    input.now ?? new Date(),
  );
  const updated = await repository.updateDrop(input.dropId, input.userId, patch);
  if (!updated) {
    throw new SurfDropServiceError(404, "Surf Drop not found");
  }
  return updated;
}

export async function cancelSurfDrop(
  repository: SurfDropsRepository,
  input: {
    dropId: string;
    userId: string;
    now?: Date;
  },
): Promise<{ ok: true }> {
  if (!repository.cancelDrop) {
    throw new SurfDropServiceError(500, "Surf Drop repository cannot cancel drops");
  }

  const existing = await repository.findDropById(input.dropId);
  const drop = assertDropActive(existing, input.now ?? new Date());
  if (drop.user_id !== input.userId) {
    throw new SurfDropServiceError(403, "Only the creator can cancel this Surf Drop");
  }

  const cancelled = await repository.cancelDrop(
    input.dropId,
    input.userId,
    (input.now ?? new Date()).toISOString(),
  );
  if (!cancelled) {
    throw new SurfDropServiceError(404, "Surf Drop not found");
  }
  return { ok: true };
}

export async function claimSurfDropLink(
  repository: SurfDropsRepository,
  input: {
    shareSlug: string;
    userId: string;
    now?: Date;
  },
): Promise<{ drop_id: string }> {
  const drop = assertDropActive(
    await repository.findDropByShareSlug(input.shareSlug),
    input.now ?? new Date(),
  );

  if (
    repository.hasBlockBetween &&
    await repository.hasBlockBetween(input.userId, drop.user_id)
  ) {
    throw new SurfDropServiceError(403, "Surf Drop is not available");
  }

  await repository.upsertLinkGrant(drop.id, input.userId);
  return { drop_id: drop.id };
}

export async function joinSurfDrop(
  repository: SurfDropsRepository,
  input: {
    dropId: string;
    userId: string;
    now?: Date;
  },
): Promise<{ ok: true; participants_count: number }> {
  const now = input.now ?? new Date();
  const drop = assertDropActive(await repository.findDropById(input.dropId), now);

  await repository.upsertParticipant(drop.id, input.userId, now.toISOString());
  const participants_count = await repository.countActiveParticipants(drop.id);
  return { ok: true, participants_count };
}

export async function leaveSurfDrop(
  repository: SurfDropsRepository,
  input: {
    dropId: string;
    userId: string;
    now?: Date;
  },
): Promise<{ ok: true }> {
  if (!repository.leaveParticipant) {
    throw new SurfDropServiceError(500, "Surf Drop repository cannot leave drops");
  }
  await repository.leaveParticipant(
    input.dropId,
    input.userId,
    (input.now ?? new Date()).toISOString(),
  );
  return { ok: true };
}

export async function viewerCanAccessDrop(
  repository: SurfDropsRepository,
  drop: SurfDropRecord,
  viewerId: string | null,
): Promise<boolean> {
  if (!viewerId) return false;
  if (viewerId === drop.user_id) return true;
  if (repository.hasBlockBetween && await repository.hasBlockBetween(viewerId, drop.user_id)) {
    return false;
  }
  if (repository.viewerHasLinkGrant && await repository.viewerHasLinkGrant(drop.id, viewerId)) {
    return true;
  }
  if (repository.viewerIsParticipant && await repository.viewerIsParticipant(drop.id, viewerId)) {
    return true;
  }
  if (
    (drop.audience === "mutuals" || drop.audience === "friends") &&
    repository.viewerIsMutual &&
    await repository.viewerIsMutual(viewerId, drop.user_id)
  ) {
    return true;
  }
  return false;
}

export function getDropCoordinates(
  drop: SurfDropRecord,
): { lat: number; lon: number } | null {
  if (drop.location_type === "custom_pin") {
    if (drop.custom_lat == null || drop.custom_lon == null) return null;
    return { lat: drop.custom_lat, lon: drop.custom_lon };
  }

  if (drop.beach?.lat == null || drop.beach.lon == null) return null;
  return { lat: drop.beach.lat, lon: drop.beach.lon };
}

function hasCoordinatesInBbox(
  coords: { lat: number; lon: number } | null,
  bbox: Bbox,
): boolean {
  if (!coords) return false;
  return (
    coords.lon >= bbox.minLon &&
    coords.lon <= bbox.maxLon &&
    coords.lat >= bbox.minLat &&
    coords.lat <= bbox.maxLat
  );
}

export function filterRowsByBbox<T extends {
  lat?: number;
  lon?: number;
  custom_lat?: number | null;
  custom_lon?: number | null;
  location_type?: string;
  beach?: { lat: number | null; lon: number | null } | null;
}>(
  rows: T[],
  bbox: Bbox,
): T[] {
  return rows.filter((row) => {
    if (typeof row.lat === "number" && typeof row.lon === "number") {
      return hasCoordinatesInBbox({ lat: row.lat, lon: row.lon }, bbox);
    }
    if (row.location_type === "custom_pin") {
      if (row.custom_lat == null || row.custom_lon == null) return false;
      return hasCoordinatesInBbox({ lat: row.custom_lat, lon: row.custom_lon }, bbox);
    }
    if (row.beach?.lat == null || row.beach.lon == null) return false;
    return hasCoordinatesInBbox({ lat: row.beach.lat, lon: row.beach.lon }, bbox);
  });
}

export function computeQrVenueScanUpdate(
  venue: QrBusinessVenueRecord,
  now: Date = new Date(),
): Pick<QrBusinessVenueRecord, "qr_scan_count" | "activated_at"> {
  const qr_scan_count = venue.qr_scan_count + 1;
  const shouldActivate =
    !venue.activated_at && qr_scan_count >= venue.activation_threshold;

  return {
    qr_scan_count,
    activated_at: shouldActivate ? now.toISOString() : venue.activated_at,
  };
}

export function toMapDropPayload(drop: SurfDropRecord): Record<string, unknown> {
  const coords = getDropCoordinates(drop);
  return {
    id: drop.id,
    share_slug: drop.share_slug,
    location_type: drop.location_type,
    lat: coords?.lat ?? null,
    lon: coords?.lon ?? null,
    beach_id: drop.beach_id,
    spot_name: drop.beach?.name ?? null,
    general_area: drop.general_area,
    exact_label: drop.location_type === "custom_pin" ? drop.exact_label : null,
    starts_at: drop.starts_at,
    ends_at: drop.ends_at,
    audience: drop.audience,
    creator: {
      id: drop.user_id,
      display_name:
        drop.creator?.display_name?.trim() ||
        drop.creator?.full_name?.trim() ||
        "A surfer",
      avatar_url: drop.creator?.avatar_url ?? null,
    },
    participants_count: drop.participants_count,
  };
}

export async function buildAccessibleMapDropPayloads(
  repository: SurfDropsRepository,
  rows: SurfDropRecord[],
  bbox: Bbox,
  viewerId: string | null,
): Promise<Record<string, unknown>[]> {
  const payloads: Record<string, unknown>[] = [];
  const inBoundsRows = filterRowsByBbox(rows, bbox);

  for (const row of inBoundsRows) {
    if (await viewerCanAccessDrop(repository, row, viewerId)) {
      payloads.push(toMapDropPayload(row));
    }
  }

  return payloads;
}

export function toDropDetailPayload(
  drop: SurfDropRecord,
  input: {
    viewerId: string;
    participants?: Array<{
      user_id: string;
      joined_at: string;
      profile: { display_name: string | null; full_name: string | null; avatar_url: string | null } | null;
    }>;
  },
): Record<string, unknown> {
  const coords = getDropCoordinates(drop);
  return {
    id: drop.id,
    creator: {
      id: drop.user_id,
      display_name:
        drop.creator?.display_name?.trim() ||
        drop.creator?.full_name?.trim() ||
        "A surfer",
      avatar_url: drop.creator?.avatar_url ?? null,
    },
    share_slug: drop.share_slug,
    location_type: drop.location_type,
    beach: drop.beach,
    custom_pin:
      drop.location_type === "custom_pin" && coords
        ? { lat: coords.lat, lon: coords.lon, exact_label: drop.exact_label }
        : null,
    general_area: drop.general_area,
    starts_at: drop.starts_at,
    ends_at: drop.ends_at,
    audience: drop.audience,
    note: drop.note,
    forecast_snapshot: drop.forecast_snapshot,
    participants: input.participants ?? [],
    participants_count: drop.participants_count,
    is_joined: (input.participants ?? []).some((participant) => participant.user_id === input.viewerId),
    can_edit: drop.user_id === input.viewerId,
    status: getSurfDropStatus(drop),
  };
}
