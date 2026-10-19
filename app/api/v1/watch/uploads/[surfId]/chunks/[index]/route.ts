import { withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { withWatchAuth } from "@/lib/watch/with-watch-auth";
import { uploadWatchChunk } from "@/lib/watch/uploads";

export const runtime = "nodejs";
export const POST = withNoStore(withRateLimit(withWatchAuth(uploadWatchChunk, {
  errorMessage: "Failed to upload watch chunk",
}), "authenticated-default"));
