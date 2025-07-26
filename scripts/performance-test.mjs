#!/usr/bin/env node

/**
 * Performance testing script for Quiver app
 * Runs Lighthouse audits and provides performance insights
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  url: "http://localhost:3000",
  outputPath: path.join(__dirname, "performance-results.json"),
  lighthousePath: path.join(__dirname, "lighthouseRun.json"),
  reportPath: path.join(__dirname, "performance-report.html"),
  thresholds: {
    performance: 80,
    accessibility: 90,
    bestPractices: 90,
    seo: 90,
    lcp: 2500,
    fcp: 1500,
    cls: 0.1,
    tbt: 200,
  },
};

// Colors for console output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log("\n" + "=".repeat(60));
  log(message, colors.bold + colors.blue);
  console.log("=".repeat(60));
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatTime(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getScoreColor(score) {
  if (score >= 90) return colors.green;
  if (score >= 50) return colors.yellow;
  return colors.red;
}

async function checkServerRunning() {
  try {
    execSync(`curl -s ${CONFIG.url} > /dev/null`, { stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

async function runLighthouse() {
  logHeader("🚀 Running Lighthouse Performance Audit");

  const isRunning = await checkServerRunning();
  if (!isRunning) {
    log(
      "❌ Server is not running. Please start the development server first:",
      colors.red
    );
    log("   npm run dev", colors.yellow);
    process.exit(1);
  }

  try {
    log("Running Lighthouse audit...", colors.blue);

    const lighthouseCmd = [
      "lighthouse",
      CONFIG.url,
      "--output=json",
      "--output=html",
      `--output-path=${CONFIG.lighthousePath.replace(".json", "")}`,
      '--chrome-flags="--headless --disable-gpu --no-sandbox"',
      "--throttling-method=simulate",
      "--form-factor=desktop",
      "--preset=desktop",
      "--quiet",
    ].join(" ");

    execSync(lighthouseCmd, { stdio: "inherit" });
    log("✅ Lighthouse audit completed!", colors.green);
  } catch (error) {
    log("❌ Lighthouse audit failed:", colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

function analyzeLighthouseResults() {
  logHeader("📊 Analyzing Performance Results");

  if (!existsSync(CONFIG.lighthousePath)) {
    log("❌ Lighthouse results file not found", colors.red);
    return null;
  }

  try {
    const results = JSON.parse(readFileSync(CONFIG.lighthousePath, "utf8"));
    const audits = results.audits;
    const categories = results.categories;

    // Extract key metrics
    const metrics = {
      performance: Math.round(categories.performance.score * 100),
      accessibility: Math.round(categories.accessibility.score * 100),
      bestPractices: Math.round(categories["best-practices"].score * 100),
      seo: Math.round(categories.seo.score * 100),
      fcp: audits["first-contentful-paint"].numericValue,
      lcp: audits["largest-contentful-paint"].numericValue,
      cls: audits["cumulative-layout-shift"].numericValue,
      tbt: audits["total-blocking-time"].numericValue,
      speedIndex: audits["speed-index"].numericValue,
    };

    // Display results
    console.log("\n📈 Core Web Vitals:");
    console.log(
      `   First Contentful Paint: ${getScoreColor(
        metrics.fcp <= CONFIG.thresholds.fcp ? 100 : 0
      )}${formatTime(metrics.fcp)}${colors.reset} (target: ≤ ${formatTime(
        CONFIG.thresholds.fcp
      )})`
    );
    console.log(
      `   Largest Contentful Paint: ${getScoreColor(
        metrics.lcp <= CONFIG.thresholds.lcp ? 100 : 0
      )}${formatTime(metrics.lcp)}${colors.reset} (target: ≤ ${formatTime(
        CONFIG.thresholds.lcp
      )})`
    );
    console.log(
      `   Cumulative Layout Shift: ${getScoreColor(
        metrics.cls <= CONFIG.thresholds.cls ? 100 : 0
      )}${metrics.cls.toFixed(3)}${colors.reset} (target: ≤ ${
        CONFIG.thresholds.cls
      })`
    );
    console.log(
      `   Total Blocking Time: ${getScoreColor(
        metrics.tbt <= CONFIG.thresholds.tbt ? 100 : 0
      )}${formatTime(metrics.tbt)}${colors.reset} (target: ≤ ${formatTime(
        CONFIG.thresholds.tbt
      )})`
    );

    console.log("\n🎯 Lighthouse Scores:");
    console.log(
      `   Performance: ${getScoreColor(metrics.performance)}${
        metrics.performance
      }${colors.reset}/100`
    );
    console.log(
      `   Accessibility: ${getScoreColor(metrics.accessibility)}${
        metrics.accessibility
      }${colors.reset}/100`
    );
    console.log(
      `   Best Practices: ${getScoreColor(metrics.bestPractices)}${
        metrics.bestPractices
      }${colors.reset}/100`
    );
    console.log(
      `   SEO: ${getScoreColor(metrics.seo)}${metrics.seo}${colors.reset}/100`
    );

    // Performance opportunities
    console.log("\n🔧 Performance Opportunities:");
    const opportunities = [
      "render-blocking-resources",
      "unused-css-rules",
      "unused-javascript",
      "unminified-css",
      "unminified-javascript",
      "uses-optimized-images",
      "uses-text-compression",
    ];

    opportunities.forEach((audit) => {
      if (audits[audit] && audits[audit].score < 1) {
        const savings = audits[audit].details?.overallSavingsMs || 0;
        console.log(
          `   ${audits[audit].title}: ${colors.yellow}${formatTime(
            savings
          )} potential savings${colors.reset}`
        );
      }
    });

    // Save results
    const reportData = {
      timestamp: new Date().toISOString(),
      metrics,
      url: CONFIG.url,
      passed: metrics.performance >= CONFIG.thresholds.performance,
    };

    writeFileSync(CONFIG.outputPath, JSON.stringify(reportData, null, 2));
    log(`\n💾 Results saved to: ${CONFIG.outputPath}`, colors.blue);

    return reportData;
  } catch (error) {
    log("❌ Failed to analyze Lighthouse results:", colors.red);
    log(error.message, colors.red);
    return null;
  }
}

function generateRecommendations(results) {
  if (!results) return;

  logHeader("💡 Performance Recommendations");

  const recommendations = [];

  if (results.metrics.lcp > CONFIG.thresholds.lcp) {
    recommendations.push(
      "• Optimize Largest Contentful Paint by preloading hero images and critical resources"
    );
    recommendations.push(
      "• Consider using Next.js Image component with priority loading"
    );
  }

  if (results.metrics.fcp > CONFIG.thresholds.fcp) {
    recommendations.push(
      "• Improve First Contentful Paint by reducing render-blocking resources"
    );
    recommendations.push("• Optimize font loading with font-display: swap");
  }

  if (results.metrics.cls > CONFIG.thresholds.cls) {
    recommendations.push(
      "• Fix Cumulative Layout Shift by adding explicit dimensions to images"
    );
    recommendations.push("• Avoid inserting content above existing content");
  }

  if (results.metrics.tbt > CONFIG.thresholds.tbt) {
    recommendations.push(
      "• Reduce Total Blocking Time by code splitting and lazy loading"
    );
    recommendations.push(
      "• Minimize main thread work by optimizing JavaScript execution"
    );
  }

  if (results.metrics.performance < CONFIG.thresholds.performance) {
    recommendations.push("• Enable compression (gzip/brotli) on your server");
    recommendations.push("• Implement proper caching strategies");
    recommendations.push("• Consider using a CDN for static assets");
  }

  if (recommendations.length === 0) {
    log(
      "🎉 Great job! Your app meets all performance thresholds!",
      colors.green
    );
  } else {
    recommendations.forEach((rec) => log(rec, colors.yellow));
  }

  log(
    `\n📋 Full report available at: ${CONFIG.lighthousePath.replace(
      ".json",
      ".report.html"
    )}`,
    colors.blue
  );
}

async function main() {
  console.clear();
  logHeader("⚡ Quiver Performance Testing Suite");

  await runLighthouse();
  const results = analyzeLighthouseResults();
  generateRecommendations(results);

  if (results && results.passed) {
    log("\n🎉 Performance test passed!", colors.green);
    process.exit(0);
  } else {
    log(
      "\n⚠️  Performance test failed. See recommendations above.",
      colors.yellow
    );
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  log("❌ Script failed:", colors.red);
  log(error.message, colors.red);
  process.exit(1);
});
