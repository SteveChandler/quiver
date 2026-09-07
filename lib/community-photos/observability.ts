import { capturePostHogEvent } from "@/lib/posthog-server";
import type { RouteHandler } from "@/lib/middleware/api-wrappers/types";

type CommunityPhotoRouteSurface = "read" | "write" | "admin" | "retention";
type CommunityPhotoRolloutEligibility =
  | "eligible"
  | "ineligible"
  | "not_applicable"
  | "unknown";

interface CommunityPhotoRouteObservabilityConfig {
  route: string;
  surface: CommunityPhotoRouteSurface;
  successResultClass?: string;
}

const COMMUNITY_PHOTO_ROUTES = new Set([
  "/api/community-photos",
  "/api/community-photos/upload",
  "/api/community-photos/mine",
  "/api/community-photos/:photoId",
  "/api/community-photos/:photoId/vote",
  "/api/community-photos/:photoId/report",
  "/api/community-photos/:photoId/recover",
  "/api/community-photos/:photoId/image",
  "/api/admin/community-photos",
  "/api/admin/community-photos/monitoring",
  "/api/admin/community-photos/:photoId/image",
  "/api/admin/community-photos/:photoId/moderation",
  "/api/admin/community-photos/:photoId/pin",
  "/api/admin/community-photos/:photoId/hold",
  "/api/admin/community-photos/:photoId/recover",
  "/api/admin/community-photo-contributors/:contributorId/restriction",
  "/api/cron/community-photo-retention",
]);

function platformBuild(request: Request): string {
  const platform = request.headers.get("x-quiver-platform")?.toLowerCase();
  const build = request.headers.get("x-quiver-build-number");
  if (
    !platform ||
    !["ios", "android", "web"].includes(platform) ||
    !build ||
    !/^[a-z0-9._-]{1,32}$/i.test(build)
  ) {
    return "unknown";
  }
  return `${platform}:${build}`;
}

function deploymentSha(): string {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "";
  return /^[a-f0-9]{7,40}$/i.test(sha) ? sha.toLowerCase() : "unknown";
}

function resultClass(status: number, successResultClass: string): string {
  if (status >= 200 && status < 300) return successResultClass;
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 413 || status === 415) return "media_rejected";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  if (status >= 400) return "client_error";
  return "unexpected_status";
}

function rolloutEligibility(
  surface: CommunityPhotoRouteSurface,
  status: number,
): CommunityPhotoRolloutEligibility {
  if (surface === "admin" || surface === "retention") {
    return "not_applicable";
  }
  if (status >= 200 && status < 300) return "eligible";
  if (status === 401 || status === 403) return "ineligible";
  return "unknown";
}

function emitOutcome({
  config,
  request,
  status,
  durationMs,
}: {
  config: CommunityPhotoRouteObservabilityConfig;
  request: Request;
  status: number;
  durationMs: number;
}): void {
  try {
    const capture = capturePostHogEvent({
      distinctId: "community-photo-route",
      event: "community_photo_route_outcome",
      properties: {
        route: config.route,
        method: /^(GET|POST|PUT|DELETE|HEAD)$/.test(request.method)
          ? request.method
          : "UNKNOWN",
        status,
        duration_ms: Math.max(0, Math.round(durationMs)),
        platform_build: platformBuild(request),
        result_class: resultClass(
          status,
          config.successResultClass ?? "success",
        ),
        rollout_eligibility: rolloutEligibility(config.surface, status),
        deployment_sha: deploymentSha(),
      },
    });
    void capture.catch(() => undefined);
  } catch {
    // Metrics are never on the auth, audit, or response path.
  }
}

export function withCommunityPhotoRouteObservability<ResponseType extends Response>(
  config: CommunityPhotoRouteObservabilityConfig,
  handler: () => ResponseType | Promise<ResponseType>,
): (request: Request) => Promise<ResponseType>;
// Preserve both route signatures rather than inferring only the final overload.
export function withCommunityPhotoRouteObservability(
  config: CommunityPhotoRouteObservabilityConfig,
  handler: RouteHandler,
): RouteHandler;
export function withCommunityPhotoRouteObservability<
  RequestType extends Request,
  Args extends unknown[],
  ResponseType extends Response,
>(
  config: CommunityPhotoRouteObservabilityConfig,
  handler: (request: RequestType, ...args: Args) => ResponseType | Promise<ResponseType>,
): (request: RequestType, ...args: Args) => Promise<ResponseType>;
export function withCommunityPhotoRouteObservability<
  RequestType extends Request,
  Args extends unknown[],
  ResponseType extends Response,
>(
  config: CommunityPhotoRouteObservabilityConfig,
  handler: (
    request: RequestType,
    ...args: Args
  ) => ResponseType | Promise<ResponseType>,
): (request: RequestType, ...args: Args) => Promise<ResponseType> {
  if (!COMMUNITY_PHOTO_ROUTES.has(config.route)) {
    throw new Error("invalid community photo route template");
  }

  return async (
    request: RequestType,
    ...args: Args
  ): Promise<ResponseType> => {
    const startedAt = Date.now();
    try {
      const response = await handler(request, ...args);
      emitOutcome({
        config,
        request,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      emitOutcome({
        config,
        request,
        status: 500,
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  };
}
