import { rm, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const webpackCacheDir = path.join(process.cwd(), ".next", "cache", "webpack");

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(webpackCacheDir))) {
    return;
  }

  await rm(webpackCacheDir, { recursive: true, force: true });
  // Only log when we actually did something (keeps dev output clean).
  console.log("[clean-next-webpack-cache] Cleared .next/cache/webpack");
}

main().catch((err) => {
  console.error(
    "[clean-next-webpack-cache] Failed to clear .next/cache/webpack:",
    err
  );
  process.exit(1);
});

