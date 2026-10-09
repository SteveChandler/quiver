import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

/** @param {{ path?: string, override?: boolean }} [options] */
export function config({ path = ".env", override = false } = {}) {
  if (!existsSync(path)) return;

  if (override) {
    Object.assign(process.env, parseEnv(readFileSync(path, "utf8")));
  } else {
    process.loadEnvFile(path);
  }
}
