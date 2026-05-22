import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

import {
  parseApprovedRuntimePhotos,
  type ApprovedRuntimePhoto,
} from "./lib/beach-photo-candidates";

interface CliOptions {
  manifestPath: string;
  dryRun: boolean;
  onlySlugs: Set<string> | null;
}

const DEFAULT_MANIFEST_PATH = "scripts/data/socal-beginner-approved-photos.json";
const TARGET_WIDTH = 1600;
const TARGET_HEIGHT = 1200;
const DOWNLOAD_ATTEMPTS = 4;

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;

    const [key, inlineValue] = arg.slice(2).split("=");
    const nextValue = argv[index + 1];
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
    } else if (nextValue && !nextValue.startsWith("--")) {
      args.set(key, nextValue);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }

  const only = args.get("only");

  return {
    manifestPath: args.get("manifest") ?? DEFAULT_MANIFEST_PATH,
    dryRun: args.get("dryRun") === "true",
    onlySlugs: only
      ? new Set(
          only
            .split(",")
            .map((slug) => slug.trim())
            .filter(Boolean),
        )
      : null,
  };
}

async function readManifest(path: string): Promise<ApprovedRuntimePhoto[]> {
  const raw = await readFile(path, "utf8");
  return parseApprovedRuntimePhotos(JSON.parse(raw));
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function downloadToFile(url: string, path: string): Promise<void> {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent":
          "QuiverSurf/1.0 (https://www.quiversurf.app; approved-seo-photo-pipeline)",
      },
    });

    if (response.ok) {
      const bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(path, bytes);
      return;
    }

    lastStatus = response.status;
    if (response.status !== 429 && response.status < 500) break;

    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const retryDelay = Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : attempt * 1500;
    await delay(retryDelay);
  }

  throw new Error(`Failed to download ${url}: ${lastStatus}`);
}

async function convertToWebp(sourcePath: string, outputPath: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const normalizedPath = `${sourcePath}.normalized.png`;
  await runCommand("magick", [
    sourcePath,
    "-auto-orient",
    "-resize",
    `${TARGET_WIDTH}x${TARGET_HEIGHT}^`,
    "-gravity",
    "center",
    "-extent",
    `${TARGET_WIDTH}x${TARGET_HEIGHT}`,
    normalizedPath,
  ]);
  await runCommand("cwebp", ["-quiet", "-q", "82", normalizedPath, "-o", outputPath]);
  await rm(normalizedPath, { force: true });
}

async function processPhoto(photo: ApprovedRuntimePhoto): Promise<void> {
  const extension = extname(new URL(photo.imageUrl).pathname) || ".jpg";
  const tempPath = resolve(tmpdir(), `${photo.slug}${extension}`);
  const outputPath = resolve(photo.runtimeAssetPath);

  console.log(`Downloading ${photo.slug}`);
  await downloadToFile(photo.imageUrl, tempPath);
  await convertToWebp(tempPath, outputPath);
  await rm(tempPath, { force: true });
  console.log(`Wrote ${photo.runtimeAssetPath}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const photos = (await readManifest(resolve(options.manifestPath))).filter(
    (photo) => (options.onlySlugs ? options.onlySlugs.has(photo.slug) : true),
  );

  if (photos.length === 0) {
    throw new Error("No approved SEO photos matched the requested filters.");
  }

  if (options.dryRun) {
    for (const photo of photos) {
      console.log(`${photo.slug}: ${photo.imageUrl} -> ${photo.runtimeAssetPath}`);
    }
    return;
  }

  for (const photo of photos) {
    await processPhoto(photo);
    await delay(500);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
