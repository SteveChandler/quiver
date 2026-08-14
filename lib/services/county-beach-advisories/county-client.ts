import "server-only";

import { createHash } from "node:crypto";

import {
  COUNTY_ADVISORY_TYPES,
  COUNTY_FEED_API_VERSION,
  COUNTY_FEED_BASE_URL,
  COUNTY_FEED_USER_AGENT,
  type CountyAdvisoryType,
  type CountyEventTypeIdentifier,
  type CountyFeedFetcher,
  type CountyFeedManifest,
  type CountyNotificationResponse,
  type CountySiteNotification,
} from "./types";

const ANONYMOUS_CSRF_TOKEN = "T6C+9iB49TLra4jEsMeSckDMNhQ=";
const REQUEST_TIMEOUT_MS = 10_000;

type CountyFeedErrorKind = "transient" | "version_mismatch" | "shape_change";

export class CountyFeedError extends Error {
  public readonly kind: CountyFeedErrorKind;

  public constructor(kind: CountyFeedErrorKind, message: string) {
    super(message);
    this.name = "CountyFeedError";
    this.kind = kind;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(raw: string, endpoint: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new CountyFeedError(
      "shape_change",
      `County feed returned non-JSON from ${endpoint}`,
    );
  }
}

function parseManifest(payload: unknown): CountyFeedManifest {
  if (!isRecord(payload) || !isRecord(payload.manifest)) {
    throw new CountyFeedError("shape_change", "County manifest shape changed");
  }
  const versionToken = payload.manifest.versionToken;
  const versionSequence = payload.manifest.versionSequence;
  if (
    typeof versionToken !== "string" ||
    versionToken.length === 0 ||
    typeof versionSequence !== "number" ||
    !Number.isInteger(versionSequence)
  ) {
    throw new CountyFeedError("shape_change", "County manifest version fields changed");
  }
  return { versionToken, versionSequence };
}

function parseCoordinate(value: unknown, name: string): number {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new CountyFeedError("shape_change", `County site ${name} is not numeric`);
  }
  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isFinite(parsed)) {
    throw new CountyFeedError("shape_change", `County site ${name} is not numeric`);
  }
  return parsed;
}

function parseNotificationSites(payload: unknown): CountySiteNotification[] {
  if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.data.Out1)) {
    throw new CountyFeedError("shape_change", "County notification response shape changed");
  }
  const list = payload.data.Out1.List;
  if (!Array.isArray(list)) {
    throw new CountyFeedError("shape_change", "County notification list shape changed");
  }

  return list.map((item, index) => {
    if (!isRecord(item)) {
      throw new CountyFeedError("shape_change", `County notification row ${index} changed`);
    }
    const latitude = parseCoordinate(item.Latitude, "Latitude");
    const longitude = parseCoordinate(item.Longitude, "Longitude");
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new CountyFeedError("shape_change", `County notification row ${index} has invalid coordinates`);
    }
    return {
      latitude,
      longitude,
      sourceSiteIdentifier: `${latitude.toFixed(6)},${longitude.toFixed(6)}`,
    };
  });
}

function advisoryTypeFor(eventTypeIdentifier: CountyEventTypeIdentifier): CountyAdvisoryType {
  const advisoryType = COUNTY_ADVISORY_TYPES[eventTypeIdentifier - 1];
  if (!advisoryType) {
    throw new CountyFeedError("shape_change", "Unsupported County event type");
  }
  return advisoryType;
}

async function requestJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<{ payload: unknown; rawPayload: string }> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new CountyFeedError(
      "transient",
      `County feed request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const rawPayload = await response.text();
  if (!response.ok) {
    throw new CountyFeedError(
      "transient",
      `County feed returned HTTP ${response.status}`,
    );
  }
  return { payload: parseJson(rawPayload, url), rawPayload };
}

export function createCountyFeedFetcher(
  fetchImpl: typeof fetch = fetch,
  baseUrl: string = COUNTY_FEED_BASE_URL,
): CountyFeedFetcher {
  const request = async (
    url: string,
    init: RequestInit,
  ): Promise<{ payload: unknown; rawPayload: string }> => {
    return requestJson(fetchImpl, url, init);
  };

  return {
    async fetchManifest(): Promise<CountyFeedManifest> {
      const { payload } = await request(`${baseUrl}/moduleservices/moduleinfo?latest`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": COUNTY_FEED_USER_AGENT,
        },
        cache: "no-store",
      });
      return parseManifest(payload);
    },

    async fetchNotifications(
      eventTypeIdentifier: CountyEventTypeIdentifier,
      manifest: CountyFeedManifest,
    ): Promise<CountyNotificationResponse> {
      const endpoint = `${baseUrl}/screenservices/CoSD_Beach_Water_CW/MainFlow/HomeBlockNew/ActionGetSitesByTypeNotification`;
      const { payload, rawPayload } = await request(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json; charset=UTF-8",
          // Required by OutSystems anonymous screen-service requests; it is not browser spoofing.
          "X-CSRFToken": ANONYMOUS_CSRF_TOKEN,
          "User-Agent": COUNTY_FEED_USER_AGENT,
        },
        body: JSON.stringify({
          versionInfo: {
            moduleVersion: manifest.versionToken,
            apiVersion: COUNTY_FEED_API_VERSION,
          },
          viewName: "MainFlow.Home",
          inputParameters: { EventTypeIdentifier: eventTypeIdentifier },
        }),
        cache: "no-store",
      });

      if (!isRecord(payload) || !isRecord(payload.versionInfo)) {
        throw new CountyFeedError(
          "shape_change",
          "County screen service version metadata changed",
        );
      }
      if (
        payload.versionInfo.hasModuleVersionChanged === true ||
        payload.versionInfo.hasApiVersionChanged === true
      ) {
        throw new CountyFeedError(
          "version_mismatch",
          "County screen service reported a version change",
        );
      }
      if (payload.exception !== undefined && payload.exception !== null) {
        throw new CountyFeedError(
          "shape_change",
          "County screen service returned an exception payload",
        );
      }

      const sites = parseNotificationSites(payload);
      return {
        eventTypeIdentifier,
        advisoryType: advisoryTypeFor(eventTypeIdentifier),
        sites,
        rawPayload: payload as CountyNotificationResponse["rawPayload"],
        rawPayloadHash: createHash("sha256").update(rawPayload).digest("hex"),
      };
    },
  };
}
