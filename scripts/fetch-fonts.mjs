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

// Reliable sources: use fonts from official Google Fonts repos (raw URLs stable)
// All fonts required for Satori rendering of session share card variants 1-6
const FILES = [
  // NotoSans - Required for all variants
  {
    url: "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
    dest: path.join(outDir, "NotoSans", "NotoSans-Regular.ttf"),
  },
  {
    url: "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf",
    dest: path.join(outDir, "NotoSans", "NotoSans-Bold.ttf"),
  },
  // Roboto - Used in various variants
  {
    url: "https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Regular.ttf",
    dest: path.join(outDir, "Roboto", "Roboto-Regular.ttf"),
  },
  {
    url: "https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf",
    dest: path.join(outDir, "Roboto", "Roboto-Bold.ttf"),
  },
  // Open Sans - Used in various variants
  {
    url: "https://github.com/googlefonts/opensans/raw/main/fonts/ttf/OpenSans-Regular.ttf",
    dest: path.join(outDir, "OpenSans", "OpenSans-Regular.ttf"),
  },
  {
    url: "https://github.com/googlefonts/opensans/raw/main/fonts/ttf/OpenSans-SemiBold.ttf",
    dest: path.join(outDir, "OpenSans", "OpenSans-SemiBold.ttf"),
  },
  // Montserrat - Used in variant designs
  {
    url: "https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-SemiBold.ttf",
    dest: path.join(outDir, "Montserrat", "Montserrat-SemiBold.ttf"),
  },
  // Inter - Modern sans-serif for clean variants
  // Note: Using WOFF2 format (Satori supports both TTF and WOFF2)
  // TODO: Convert to TTF for optimal Satori compatibility
  {
    url: "https://unpkg.com/@fontsource/inter@5.0.16/files/inter-latin-400-normal.woff2",
    dest: path.join(outDir, "Inter", "Inter-Regular.woff2"),
  },
  {
    url: "https://unpkg.com/@fontsource/inter@5.0.16/files/inter-latin-700-normal.woff2",
    dest: path.join(outDir, "Inter", "Inter-Bold.woff2"),
  },
  // Space Grotesk - Brand heading font for OG images
  {
    url: "https://github.com/floriankarsten/space-grotesk/raw/master/fonts/ttf/static/SpaceGrotesk-Bold.ttf",
    dest: path.join(outDir, "SpaceGrotesk", "SpaceGrotesk-Bold.ttf"),
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
