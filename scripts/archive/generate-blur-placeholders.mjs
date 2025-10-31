#!/usr/bin/env node
/**
 * Generate blur placeholder data URLs for hero images
 * This improves perceived performance by showing a blurred version while the full image loads
 *
 * Usage: node scripts/generate-blur-placeholders.mjs
 */

import sharp from 'sharp';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const PROJECT_ROOT = join(__dirname, '..');

// Hero images directory
const IMAGES_DIR = join(PROJECT_ROOT, 'public', 'images');

// Hero images we want to generate placeholders for
const HERO_IMAGES = [
  'On_the_Beach_at_Bandon.webp',
  'Agate_Beach_Marin_County_California.webp',
  'Beacons_Beach.webp',
  'blacks.webp',
  'Winter-Swamis.webp',
  'windandsea-surf-shack-sunset.webp',
  'OceanBeachSurfers.webp',
];

/**
 * Generate a blur placeholder data URL for an image
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<string>} Base64 data URL
 */
async function generateBlurPlaceholder(imagePath) {
  try {
    // Generate a tiny 10x10 blurred version
    const buffer = await sharp(imagePath)
      .resize(10, 10, {
        fit: 'inside',
      })
      .blur(2)
      .webp({ quality: 20 })
      .toBuffer();

    // Convert to base64 data URL
    const base64 = buffer.toString('base64');
    return `data:image/webp;base64,${base64}`;
  } catch (error) {
    console.error(`Error generating placeholder for ${imagePath}:`, error.message);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🎨 Generating blur placeholders for hero images...\n');

  const placeholders = {};
  let successCount = 0;
  let failCount = 0;

  for (const image of HERO_IMAGES) {
    const imagePath = join(IMAGES_DIR, image);
    console.log(`Processing: ${image}`);

    const placeholder = await generateBlurPlaceholder(imagePath);

    if (placeholder) {
      // Store with filename as key (without extension for easier lookup)
      const key = image.replace(/\.(webp|jpg|jpeg|png)$/i, '');
      placeholders[key] = placeholder;
      successCount++;
      console.log(`  ✅ Generated (${placeholder.length} chars)\n`);
    } else {
      failCount++;
      console.log(`  ❌ Failed\n`);
    }
  }

  // Output TypeScript constant for easy import
  console.log('\n📦 Generated blur placeholders:\n');
  console.log('```typescript');
  console.log('// lib/constants/blur-placeholders.ts');
  console.log('/**');
  console.log(' * Blur placeholder data URLs for hero images');
  console.log(' * Generated with: npm run generate-blur-placeholders');
  console.log(' * DO NOT EDIT MANUALLY - regenerate using the script');
  console.log(' */');
  console.log('export const BLUR_PLACEHOLDERS = {');

  for (const [key, value] of Object.entries(placeholders)) {
    console.log(`  "${key}": "${value}",`);
  }

  console.log('} as const;');
  console.log('');
  console.log('export type BlurPlaceholderKey = keyof typeof BLUR_PLACEHOLDERS;');
  console.log('```\n');

  console.log(`\n✨ Summary:`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed:  ${failCount}`);
  console.log(`   Total:   ${HERO_IMAGES.length}`);
  console.log('\n💡 Copy the output above to lib/constants/blur-placeholders.ts');
}

main().catch(console.error);
