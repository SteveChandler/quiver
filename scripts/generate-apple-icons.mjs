#!/usr/bin/env node

/**
 * Generate Apple Touch Icons from existing 512x512 icon
 *
 * iOS requires specific icon sizes for home screen installation:
 * - 180x180: iPhone (primary)
 * - 167x167: iPad Pro
 * - 152x152: iPad, iPad mini
 * - 120x120: Older iPhones
 *
 * Usage: node scripts/generate-apple-icons.mjs
 */

import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const SOURCE_ICON = join(rootDir, "public/icons/icon-512x512.png");
const OUTPUT_DIR = join(rootDir, "public");

// Apple Touch Icon sizes (as per Apple's PWA guidelines)
const ICON_SIZES = [
  { size: 180, name: "apple-touch-icon-180x180.png", description: "iPhone" },
  { size: 167, name: "apple-touch-icon-167x167.png", description: "iPad Pro" },
  {
    size: 152,
    name: "apple-touch-icon-152x152.png",
    description: "iPad, iPad mini",
  },
  {
    size: 120,
    name: "apple-touch-icon-120x120.png",
    description: "Older iPhones",
  },
  { size: 180, name: "apple-touch-icon.png", description: "Default (180x180)" }, // Default fallback
];

async function generateAppleIcons() {
  console.log("🍎 Generating Apple Touch Icons for iOS PWA support...\n");

  // Check if source icon exists
  if (!existsSync(SOURCE_ICON)) {
    console.error(`❌ Source icon not found: ${SOURCE_ICON}`);
    process.exit(1);
  }

  try {
    // Generate all icon sizes
    for (const { size, name, description } of ICON_SIZES) {
      const outputPath = join(OUTPUT_DIR, name);

      await sharp(SOURCE_ICON)
        .resize(size, size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 }, // White background
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ Created ${name} (${size}x${size}) - ${description}`);
    }

    console.log("\n🎉 All Apple Touch Icons generated successfully!");
    console.log("\n📱 iOS Installation Support:");
    console.log('   - Users can now "Add to Home Screen" on iOS Safari');
    console.log("   - App will display with proper icon on iOS home screen");
    console.log("   - Standalone mode enabled for native app-like experience");
  } catch (error) {
    console.error("❌ Error generating icons:", error);
    process.exit(1);
  }
}

generateAppleIcons();
