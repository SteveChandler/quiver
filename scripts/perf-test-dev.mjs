#!/usr/bin/env node

/**
 * Performance testing script for dev.quiversurf.app
 * Runs Lighthouse audits against the dev environment
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  url: process.env.TEST_URL || "https://dev.quiversurf.app",
  outputPath: path.join(__dirname, "dev-performance-results.json"),
  lighthousePath: path.join(__dirname, "dev-lighthouse.json"),
  reportPath: path.join(__dirname, "dev-lighthouse.report.html"),
  thresholds: {
    performance: 80,
    accessibility: 90,
    bestPractices: 90,
    seo: 90,
    lcp: 2500,
    fcp: 1500,
    cls: 0.1,
    tbt: 300, // Slightly more lenient for production
  },
  urls: [
    "", // Home page
    "/discover",
    "/map",
    "/beaches/usa/california/san-diego",
  ],
};

// Colors for console output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log("\n" + "=".repeat(70));
  log(message, colors.bold + colors.blue);
  console.log("=".repeat(70));
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

function getScoreEmoji(score) {
  if (score >= 90) return "✅";
  if (score >= 75) return "⚠️";
  return "❌";
}

async function checkUrlAccessible(url) {
  try {
    execSync(`curl -s -o /dev/null -w "%{http_code}" ${url}`, {
      stdio: "pipe",
      encoding: "utf-8",
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function runLighthouseForUrl(testUrl, urlPath) {
  const fullUrl = `${testUrl}${urlPath}`;
  const pageName = urlPath === "" ? "home" : urlPath.replace(/\//g, "-").substring(1);
  const outputBase = path.join(__dirname, `dev-${pageName}`);

  log(`\n🔍 Testing: ${fullUrl}`, colors.cyan);

  try {
    const lighthouseCmd = [
      "lighthouse",
      `"${fullUrl}"`,
      "--output=json",
      "--output=html",
      `--output-path="${outputBase}"`,
      '--chrome-flags="--headless --disable-gpu --no-sandbox"',
      "--throttling-method=simulate",
      "--form-factor=desktop",
      "--preset=desktop",
      "--quiet",
    ].join(" ");

    execSync(lighthouseCmd, { stdio: "inherit" });
    log(`   ✅ Completed audit for ${pageName}`, colors.green);

    return {
      pageName,
      url: fullUrl,
      resultsPath: `${outputBase}.json`,
      reportPath: `${outputBase}.report.html`,
    };
  } catch (error) {
    log(`   ❌ Failed to audit ${pageName}:`, colors.red);
    log(`   ${error.message}`, colors.red);
    return null;
  }
}

function analyzeResults(resultPath, pageName) {
  if (!existsSync(resultPath)) {
    log(`❌ Results file not found for ${pageName}`, colors.red);
    return null;
  }

  try {
    const results = JSON.parse(readFileSync(resultPath, "utf8"));
    const audits = results.audits;
    const categories = results.categories;

    const metrics = {
      pageName,
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

    return metrics;
  } catch (error) {
    log(`❌ Failed to analyze results for ${pageName}:`, colors.red);
    log(error.message, colors.red);
    return null;
  }
}

function displayResults(allMetrics) {
  logHeader("📊 Performance Summary - dev.quiversurf.app");

  console.log("\n" + "─".repeat(70));
  console.log(
    `${"Page".padEnd(20)} ${"Perf".padEnd(8)} ${"A11y".padEnd(8)} ${"Best".padEnd(8)} ${"SEO".padEnd(8)}`
  );
  console.log("─".repeat(70));

  allMetrics.forEach((metrics) => {
    if (!metrics) return;

    const perfEmoji = getScoreEmoji(metrics.performance);
    const a11yEmoji = getScoreEmoji(metrics.accessibility);
    const bpEmoji = getScoreEmoji(metrics.bestPractices);
    const seoEmoji = getScoreEmoji(metrics.seo);

    console.log(
      `${metrics.pageName.padEnd(20)} ` +
        `${perfEmoji} ${getScoreColor(metrics.performance)}${metrics.performance}${colors.reset}`.padEnd(16) +
        `${a11yEmoji} ${getScoreColor(metrics.accessibility)}${metrics.accessibility}${colors.reset}`.padEnd(16) +
        `${bpEmoji} ${getScoreColor(metrics.bestPractices)}${metrics.bestPractices}${colors.reset}`.padEnd(16) +
        `${seoEmoji} ${getScoreColor(metrics.seo)}${metrics.seo}${colors.reset}`
    );
  });

  console.log("─".repeat(70));

  // Calculate averages
  const validMetrics = allMetrics.filter((m) => m !== null);
  const avgPerf = Math.round(
    validMetrics.reduce((sum, m) => sum + m.performance, 0) / validMetrics.length
  );
  const avgA11y = Math.round(
    validMetrics.reduce((sum, m) => sum + m.accessibility, 0) / validMetrics.length
  );
  const avgBP = Math.round(
    validMetrics.reduce((sum, m) => sum + m.bestPractices, 0) / validMetrics.length
  );
  const avgSEO = Math.round(
    validMetrics.reduce((sum, m) => sum + m.seo, 0) / validMetrics.length
  );

  console.log(
    `${"AVERAGE".padEnd(20)} ` +
      `${getScoreColor(avgPerf)}${avgPerf}${colors.reset}`.padEnd(14) +
      `${getScoreColor(avgA11y)}${avgA11y}${colors.reset}`.padEnd(14) +
      `${getScoreColor(avgBP)}${avgBP}${colors.reset}`.padEnd(14) +
      `${getScoreColor(avgSEO)}${avgSEO}${colors.reset}`
  );

  // Core Web Vitals Summary
  logHeader("⚡ Core Web Vitals Summary");

  validMetrics.forEach((metrics) => {
    console.log(`\n${colors.bold}${metrics.pageName}:${colors.reset}`);
    console.log(
      `   FCP: ${getScoreColor(metrics.fcp <= CONFIG.thresholds.fcp ? 100 : 0)}${formatTime(
        metrics.fcp
      )}${colors.reset} (target: ≤${formatTime(CONFIG.thresholds.fcp)})`
    );
    console.log(
      `   LCP: ${getScoreColor(metrics.lcp <= CONFIG.thresholds.lcp ? 100 : 0)}${formatTime(
        metrics.lcp
      )}${colors.reset} (target: ≤${formatTime(CONFIG.thresholds.lcp)})`
    );
    console.log(
      `   CLS: ${getScoreColor(metrics.cls <= CONFIG.thresholds.cls ? 100 : 0)}${metrics.cls.toFixed(
        3
      )}${colors.reset} (target: ≤${CONFIG.thresholds.cls})`
    );
    console.log(
      `   TBT: ${getScoreColor(metrics.tbt <= CONFIG.thresholds.tbt ? 100 : 0)}${formatTime(
        metrics.tbt
      )}${colors.reset} (target: ≤${formatTime(CONFIG.thresholds.tbt)})`
    );
  });

  return { avgPerf, avgA11y, avgBP, avgSEO };
}

async function main() {
  console.clear();
  logHeader("⚡ Quiver Dev Environment Performance Test");
  log(`Testing: ${colors.cyan}${CONFIG.url}${colors.reset}`, colors.bold);

  // Check if URL is accessible
  log("\n🔍 Checking if dev.quiversurf.app is accessible...", colors.blue);
  const isAccessible = await checkUrlAccessible(CONFIG.url);

  if (!isAccessible) {
    log("❌ Cannot reach dev.quiversurf.app", colors.red);
    log("Please ensure the site is deployed and accessible.", colors.yellow);
    process.exit(1);
  }

  log("✅ Site is accessible!", colors.green);

  // Run Lighthouse for each URL
  const results = [];
  for (const urlPath of CONFIG.urls) {
    const result = await runLighthouseForUrl(CONFIG.url, urlPath);
    if (result) {
      results.push(result);
    }
  }

  if (results.length === 0) {
    log("\n❌ No successful audits completed", colors.red);
    process.exit(1);
  }

  // Analyze all results
  const allMetrics = results.map((r) => analyzeResults(r.resultsPath, r.pageName));

  // Display results
  const averages = displayResults(allMetrics);

  // Save summary
  const summary = {
    timestamp: new Date().toISOString(),
    url: CONFIG.url,
    averages,
    pages: allMetrics,
    passed: averages.avgPerf >= CONFIG.thresholds.performance,
  };

  writeFileSync(CONFIG.outputPath, JSON.stringify(summary, null, 2));
  log(`\n💾 Summary saved to: ${CONFIG.outputPath}`, colors.blue);

  // Final verdict
  if (summary.passed) {
    log("\n🎉 Performance test PASSED!", colors.green);
    log(
      `Average performance score: ${colors.bold}${averages.avgPerf}${colors.reset}/100`,
      colors.green
    );
  } else {
    log("\n⚠️  Performance test needs improvement", colors.yellow);
    log(
      `Average performance score: ${colors.bold}${averages.avgPerf}${colors.reset}/100 (target: ${CONFIG.thresholds.performance})`,
      colors.yellow
    );
  }

  log(`\n📋 Individual reports saved in scripts/ directory`, colors.blue);
}

// Run the script
main().catch((error) => {
  log("\n❌ Script failed:", colors.red);
  log(error.message, colors.red);
  log(error.stack, colors.red);
  process.exit(1);
});
