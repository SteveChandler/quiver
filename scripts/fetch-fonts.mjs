#!/usr/bin/env node
// Idempotently fetches required font files into public/fonts so Satori/Resvg
// can render social share images consistently across all environments.
// Safe to run multiple times; skips downloads if files already exist.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "fonts");

// Reliable sources: use Noto Sans from googlefonts repo (raw URLs stable)
const FILES = [
  {
    url: "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
    dest: path.join(outDir, "NotoSans", "NotoSans-Regular.ttf"),
  },
  {
    url: "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf",
    dest: path.join(outDir, "NotoSans", "NotoSans-Bold.ttf"),
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function fileExistsNonEmpty(p) {
  try {
    const s = fs.statSync(p);
    return s.isFile() && s.size > 0;
  } catch {
    return false;
  }
}

function download(url, dest, attempt = 1) {
  return new Promise((resolve, reject) => {
    const maxAttempts = 3;
    const tmp = `${dest}.tmp`;
    ensureDir(path.dirname(dest));

    const req = https.get(url, (res) => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        // follow redirects
        res.resume();
        return resolve(download(res.headers.location, dest, attempt));
      }
      if (!res.statusCode || res.statusCode >= 400) {
        res.resume();
        if (attempt < maxAttempts) {
          return setTimeout(
            () => resolve(download(url, dest, attempt + 1)),
            300 * attempt
          );
        }
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      const file = fs.createWriteStream(tmp);
      res.pipe(file);
      file.on("finish", () => {
        file.close(() => {
          try {
            fs.renameSync(tmp, dest);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    });

    req.on("error", (err) => {
      if (attempt < maxAttempts) {
        return setTimeout(
          () => resolve(download(url, dest, attempt + 1)),
          300 * attempt
        );
      }
      reject(err);
    });
  });
}

async function main() {
  ensureDir(outDir);
  const tasks = FILES.map(async ({ url, dest }) => {
    if (fileExistsNonEmpty(dest)) return { dest, skipped: true };
    await download(url, dest);
    return { dest, skipped: false };
  });

  const results = await Promise.allSettled(tasks);
  const ok = results.filter((r) => r.status === "fulfilled");
  const failed = results.filter((r) => r.status === "rejected");
  const downloaded = ok.filter((r) => !r.value.skipped).length;
  const skipped = ok.filter((r) => r.value.skipped).length;

  console.log(
    `fonts: downloaded=${downloaded} skipped=${skipped} failed=${failed.length}`
  );
  if (failed.length > 0) {
    failed.forEach((f) =>
      console.warn("font download failed:", f.reason?.message || f.reason)
    );
  }
}

main().catch((err) => {
  console.warn("fonts: script error (continuing)", err?.message || err);
  process.exit(0);
});
