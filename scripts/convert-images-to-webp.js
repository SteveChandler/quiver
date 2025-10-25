#!/usr/bin/env node

/**
 * Convert hero JPG images to WebP format for CDN optimization
 *
 * This script converts all specified hero images from JPG to WebP format
 * with optimized quality settings (85%) for a balance between file size and quality.
 *
 * Expected savings: 40-50% reduction in file size
 *
 * Usage: node scripts/convert-images-to-webp.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'images');

// Hero images to convert (from cdn-optimization-plan.md)
const IMAGES_TO_CONVERT = [
  'On_the_Beach_at_Bandon.jpg',
  'Agate_Beach_Marin_County_California.jpg',
  'Beacons_Beach.jpg',
  'windandsea-surf-shack-sunset.jpg',
  'blacks.jpg',
  'Winter-Swamis.jpg',
  'OceanBeachSurfers.jpg',
];

const WEBP_QUALITY = 85; // 85% quality for good balance

async function convertImage(filename) {
  const inputPath = path.join(PUBLIC_DIR, filename);
  const outputFilename = filename.replace(/\.jpg$/i, '.webp');
  const outputPath = path.join(PUBLIC_DIR, outputFilename);

  try {
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  Skipping ${filename} - file not found`);
      return { success: false, filename, reason: 'not found' };
    }

    // Check if output already exists
    if (fs.existsSync(outputPath)) {
      console.log(`⚠️  Skipping ${filename} - WebP already exists`);
      return { success: false, filename, reason: 'already exists' };
    }

    // Get original file size
    const originalStats = fs.statSync(inputPath);
    const originalSize = originalStats.size;

    // Convert to WebP
    await sharp(inputPath)
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath);

    // Get new file size
    const newStats = fs.statSync(outputPath);
    const newSize = newStats.size;

    // Calculate savings
    const savedBytes = originalSize - newSize;
    const savedPercent = ((savedBytes / originalSize) * 100).toFixed(1);

    console.log(`✅ ${filename}`);
    console.log(`   Original: ${(originalSize / 1024).toFixed(1)}KB`);
    console.log(`   WebP: ${(newSize / 1024).toFixed(1)}KB`);
    console.log(`   Saved: ${(savedBytes / 1024).toFixed(1)}KB (${savedPercent}%)`);

    return {
      success: true,
      filename,
      originalSize,
      newSize,
      savedBytes,
      savedPercent: parseFloat(savedPercent),
    };
  } catch (error) {
    console.error(`❌ Error converting ${filename}:`, error.message);
    return { success: false, filename, reason: error.message };
  }
}

async function main() {
  console.log('🖼️  Converting hero images to WebP format...\n');
  console.log(`Target quality: ${WEBP_QUALITY}%`);
  console.log(`Images to convert: ${IMAGES_TO_CONVERT.length}\n`);

  const results = [];

  for (const filename of IMAGES_TO_CONVERT) {
    const result = await convertImage(filename);
    results.push(result);
    console.log(''); // Empty line between conversions
  }

  // Summary
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 CONVERSION SUMMARY\n');

  if (successful.length > 0) {
    const totalOriginal = successful.reduce((sum, r) => sum + r.originalSize, 0);
    const totalNew = successful.reduce((sum, r) => sum + r.newSize, 0);
    const totalSaved = totalOriginal - totalNew;
    const avgPercent = (successful.reduce((sum, r) => sum + r.savedPercent, 0) / successful.length).toFixed(1);

    console.log(`✅ Successfully converted: ${successful.length} images`);
    console.log(`📦 Total original size: ${(totalOriginal / 1024).toFixed(1)}KB`);
    console.log(`📦 Total WebP size: ${(totalNew / 1024).toFixed(1)}KB`);
    console.log(`💾 Total saved: ${(totalSaved / 1024).toFixed(1)}KB (${avgPercent}% average reduction)`);
    console.log('');
  }

  if (failed.length > 0) {
    console.log(`⚠️  Skipped/Failed: ${failed.length} images`);
    failed.forEach((r) => {
      console.log(`   - ${r.filename}: ${r.reason}`);
    });
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✨ Image conversion complete!');
  console.log('\nNext steps:');
  console.log('1. Update component image references to use .webp extensions');
  console.log('2. Test WebP loading in browsers');
  console.log('3. Keep original JPGs as fallbacks');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
