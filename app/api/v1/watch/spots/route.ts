import { createSuccessResponse } from "@/lib/api-utils";
import { withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { loadWatchSpots } from "@/lib/watch/saved-spots";
import { withWatchAuth } from "@/lib/watch/with-watch-auth";

export const runtime = "nodejs";

export const GET = withNoStore(withRateLimit(withWatchAuth(async (_request, { userId, service }) => {
  const spots = (await loadWatchSpots(service, userId)).map(({ id, name, lat, lon }) => ({ id, name, lat, lon }));
  return createSuccessResponse({ spots });
}, { errorMessage: "Failed to load watch spots" }), "authenticated-default"));
