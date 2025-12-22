import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const nextDir = path.join(projectRoot, ".next");
const webpackCacheDir = path.join(nextDir, "cache", "webpack");
const webpackServerDevCacheDir = path.join(
  webpackCacheDir,
  "server-development"
);
const lockFilePath = path.join(webpackCacheDir, ".quiver-dev-lock.json");

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isProcessAlive(pid) {
  if (!pid || typeof pid !== "number") return false;
  try {
    // Does not actually kill; just checks if process exists.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readLockFile() {
  try {
    const raw = await readFile(lockFilePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function acquireLockOrExit() {
  await mkdir(webpackCacheDir, { recursive: true });

  if (await exists(lockFilePath)) {
    const lock = await readLockFile();
    const pid = lock?.pid;

    if (isProcessAlive(pid)) {
      console.error(
        `[dev] Another dev server appears to be running (pid ${pid}).\n` +
          "Stop the existing `next dev` process before starting a new one.\n" +
          `If this lock is stale, delete ${lockFilePath}.`
      );
      process.exit(1);
    }

    // Stale lock file (process is gone) — remove and proceed.
    await rm(lockFilePath, { force: true });
  }

  const lockPayload = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  await writeFile(lockFilePath, JSON.stringify(lockPayload, null, 2), "utf8");

  const release = async () => {
    try {
      const current = await readLockFile();
      if (current?.pid === process.pid) {
        await rm(lockFilePath, { force: true });
      }
    } catch {
      // ignore
    }
  };

  process.on("exit", () => {
    // best effort (can't await here)
    void rm(lockFilePath, { force: true });
  });
  process.on("SIGINT", async () => {
    await release();
    process.exit(130);
  });
  process.on("SIGTERM", async () => {
    await release();
    process.exit(143);
  });

  return release;
}

async function cleanWebpackServerDevCache() {
  if (!(await exists(webpackServerDevCacheDir))) return;
  await rm(webpackServerDevCacheDir, { recursive: true, force: true });
  console.log(
    "[dev] Cleared .next/cache/webpack/server-development to avoid packfile ENOENT"
  );
}

async function main() {
  const releaseLock = await acquireLockOrExit();
  await cleanWebpackServerDevCache();

  const nextBin = path.join(projectRoot, "node_modules", ".bin", "next");
  const args = ["dev", ...process.argv.slice(2)];

  const child = spawn(nextBin, args, {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", async (code, signal) => {
    await releaseLock();
    if (signal) {
      // Forward signal exit semantics
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("[dev] Failed to start dev server:", err);
  process.exit(1);
});
