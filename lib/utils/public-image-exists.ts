import { existsSync } from "fs";
import { join } from "path";

/**
 * Build/server-time guard for optional local imagery: remote URLs pass
 * through, local paths must exist under public/ to render.
 */
export function publicImageExists(src: string): boolean {
  if (!src.startsWith("/")) return true;
  return existsSync(join(process.cwd(), "public", src.slice(1)));
}
