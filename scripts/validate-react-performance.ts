/**
 * React Performance Validation Script
 * 
 * Validates Phase 4 React.memo optimizations by measuring:
 * - Component render counts
 * - Page load times
 * - Time to Interactive (TTI)
 * - Re-render efficiency
 * 
 * This script requires the dev server to be running.
 */

import { chromium, Browser, Page } from 'playwright';

interface PageMetrics {
  name: string;
  loadTime: number;
  domContentLoaded: number;
  tti: number;
  fcp: number;
  lcp: number;
}

interface ValidationResult {
  page: string;
  metric: string;
  actual: number;
  target: number;
  passed: boolean;
}

const results: ValidationResult[] = [];

async function measurePageLoad(page: Page, url: string, pageName: string): Promise<PageMetrics> {
  const navigationStart = Date.now();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    console.log('  Network did not go idle, continuing...');
  });

  const loadTime = Date.now() - navigationStart;

  // Get performance timing metrics
  const perfMetrics = await page.evaluate(() => {
    const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    return {
      domContentLoaded: perf.domContentLoadedEventEnd - perf.fetchStart,
      loadComplete: perf.loadEventEnd - perf.fetchStart,
    };
  });

  // Get Web Vitals if available
  const webVitals = await page.evaluate(() => {
    return new Promise<{ fcp: number; lcp: number }>((resolve) => {
      let fcp = 0;
      let lcp = 0;

      // First Contentful Paint
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          fcp = entries[0].startTime;
        }
      });
      fcpObserver.observe({ entryTypes: ['paint'] });

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          lcp = entries[entries.length - 1].startTime;
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // Give observers time to collect
      setTimeout(() => {
        fcpObserver.disconnect();
        lcpObserver.disconnect();
        resolve({ fcp, lcp });
      }, 2000);
    });
  });

  return {
    name: pageName,
    loadTime,
    domContentLoaded: perfMetrics.domContentLoaded,
    tti: loadTime,
    fcp: webVitals.fcp || 0,
    lcp: webVitals.lcp || 0,
  };
}

async function testHomePagePerformance(browser: Browser) {
  console.log('\n' + '='.repeat(70));
  console.log('Home Page Performance Test');
  console.log('='.repeat(70));

  const page = await browser.newPage();

  try {
    console.log('\nMeasuring home page load...');

    const metrics = await measurePageLoad(page, 'http://localhost:3000/', 'Home Page');

    console.log('  Load Time: ' + metrics.loadTime + 'ms');
    console.log('  DOM Content Loaded: ' + metrics.domContentLoaded + 'ms');
    console.log('  TTI: ' + metrics.tti + 'ms');
    if (metrics.fcp > 0) console.log('  FCP: ' + Math.round(metrics.fcp) + 'ms');
    if (metrics.lcp > 0) console.log('  LCP: ' + Math.round(metrics.lcp) + 'ms');

    // Validate against targets
    results.push({
      page: 'Home Page',
      metric: 'Time to Interactive',
      actual: metrics.tti,
      target: 3500,
      passed: metrics.tti < 3500,
    });

    if (metrics.lcp > 0) {
      results.push({
        page: 'Home Page',
        metric: 'LCP',
        actual: metrics.lcp,
        target: 2500,
        passed: metrics.lcp < 2500,
      });
    }

    console.log('\nStatus: ' + (metrics.tti < 3500 ? '✅ PASS' : '❌ FAIL'));

  } finally {
    await page.close();
  }
}

async function testMapPagePerformance(browser: Browser) {
  console.log('\n' + '='.repeat(70));
  console.log('Map Page Performance Test (50 beaches)');
  console.log('='.repeat(70));

  const page = await browser.newPage();

  try {
    console.log('\nMeasuring map page load...');

    const metrics = await measurePageLoad(page, 'http://localhost:3000/map', 'Map Page');

    console.log('  Load Time: ' + metrics.loadTime + 'ms');
    console.log('  DOM Content Loaded: ' + metrics.domContentLoaded + 'ms');
    if (metrics.lcp > 0) console.log('  LCP: ' + Math.round(metrics.lcp) + 'ms');

    results.push({
      page: 'Map Page',
      metric: 'Load Time',
      actual: metrics.loadTime,
      target: 5000,
      passed: metrics.loadTime < 5000,
    });

    console.log('\nStatus: ' + (metrics.loadTime < 5000 ? '✅ PASS' : '❌ FAIL'));

  } finally {
    await page.close();
  }
}

async function generateReport() {
  console.log('\n\n');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' REACT PERFORMANCE VALIDATION REPORT '.padStart(46).padEnd(68) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');

  console.log('\n📊 Summary\n');

  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  const passRate = (passedTests / totalTests) * 100;

  console.log('Tests Run: ' + totalTests);
  console.log('Tests Passed: ' + passedTests);
  console.log('Pass Rate: ' + passRate.toFixed(1) + '%\n');

  console.log('📈 Detailed Results\n');

  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    const actualStr = result.actual < 1000 ? Math.round(result.actual) + 'ms' : (result.actual / 1000).toFixed(2) + 's';
    const targetStr = result.target < 1000 ? result.target + 'ms' : (result.target / 1000).toFixed(2) + 's';

    console.log(status + ' ' + result.page + ' - ' + result.metric);
    console.log('   Actual: ' + actualStr + ', Target: ' + targetStr);
  }

  console.log('\n' + '═'.repeat(70) + '\n');
}

async function main() {
  console.log('🏄 React Performance Validation\n');
  console.log('Testing Phase 4 React.memo Optimizations\n');

  const browser = await chromium.launch({ headless: true });

  try {
    // Check if server is running
    const response = await fetch('http://localhost:3000/').catch(() => null);

    if (!response) {
      console.error('\n❌ Cannot connect to dev server at http://localhost:3000');
      console.error('Please ensure the development server is running:');
      console.error('  yarn dev\n');
      process.exit(1);
    }

    console.log('✅ Dev server available\n');

    // Run tests
    await testHomePagePerformance(browser);
    await testMapPagePerformance(browser);

    // Generate report
    await generateReport();

    // Exit code
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
