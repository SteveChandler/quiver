import { withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { withWatchAuth } from "@/lib/watch/with-watch-auth";
import { completeWatchUpload } from "@/lib/watch/uploads";

export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = withNoStore(withRateLimit(withWatchAuth(completeWatchUpload, {
  errorMessage: "Failed to complete watch upload",
}), "authenticated-default"));
