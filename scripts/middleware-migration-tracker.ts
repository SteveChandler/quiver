// scripts/middleware-migration-tracker.ts
/**
 * Middleware Migration Tracker
 *
 * Scans API routes and server actions to track migration progress
 * from manual error handling to middleware patterns.
 *
 * Usage: npx ts-node scripts/middleware-migration-tracker.ts
 * Or: yarn tsx scripts/middleware-migration-tracker.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface MigrationStatus {
  file: string;
  status: 'migrated' | 'partial' | 'legacy';
  patterns: string[];
  lineCount: number;
}

interface MigrationSummary {
  apiRoutes: {
    total: number;
    migrated: number;
    partial: number;
    legacy: number;
    percentage: number;
  };
  serverActions: {
    total: number;
    migrated: number;
    partial: number;
    legacy: number;
    percentage: number;
  };
}

function analyzeFile(filePath: string): MigrationStatus {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lineCount = content.split('\n').length;
  const patterns: string[] = [];

  // Check for new middleware patterns
  if (content.includes('withProtection(') || content.includes('withProtection,')) {
    patterns.push('withProtection');
  }
  if (content.includes('withAuth(') || content.includes('withAuth,')) {
    patterns.push('withAuth');
  }
  if (content.includes('withRateLimit(')) {
    patterns.push('withRateLimit');
  }
  if (content.includes('createApiHandler(')) {
    patterns.push('createApiHandler');
  }
  if (content.includes('withAuthenticatedAction(') || content.includes('makeAuthenticatedAction(')) {
    patterns.push('withAuthenticatedAction');
  }
  if (content.includes('createServerAction(')) {
    patterns.push('createServerAction');
  }
  if (content.includes('withValidation(')) {
    patterns.push('withValidation');
  }

  // Check for legacy patterns
  const hasTryCatch = /try\s*\{[\s\S]*?\}\s*catch\s*\(/.test(content);
  const hasManualSupabase = content.includes('createSupabaseServerClient()') &&
    !patterns.includes('withAuth') &&
    !patterns.includes('withProtection') &&
    !patterns.includes('withAuthenticatedAction');
  const hasManualAuth = content.includes('.auth.getUser()') &&
    !patterns.includes('withAuth') &&
    !patterns.includes('withProtection');

  if (hasTryCatch) patterns.push('try-catch');
  if (hasManualSupabase) patterns.push('manual-supabase');
  if (hasManualAuth) patterns.push('manual-auth');

  // Determine status
  const hasNewPatterns = patterns.some(p =>
    ['withProtection', 'withAuth', 'createApiHandler', 'withAuthenticatedAction', 'createServerAction', 'withValidation'].includes(p)
  );
  const hasLegacyPatterns = patterns.some(p =>
    ['try-catch', 'manual-supabase', 'manual-auth'].includes(p)
  );

  let status: 'migrated' | 'partial' | 'legacy';
  if (hasNewPatterns && !hasLegacyPatterns) {
    status = 'migrated';
  } else if (hasNewPatterns && hasLegacyPatterns) {
    status = 'partial';
  } else {
    status = 'legacy';
  }

  return {
    file: filePath,
    status,
    patterns,
    lineCount,
  };
}

async function main() {
  const projectRoot = process.cwd();

  console.log('🔍 Middleware Migration Tracker\n');
  console.log('='.repeat(60));

  // Scan API routes
  const apiRoutes = await glob('app/api/**/route.ts', { cwd: projectRoot });
  const apiResults = apiRoutes.map(file => analyzeFile(path.join(projectRoot, file)));

  const apiMigrated = apiResults.filter(r => r.status === 'migrated').length;
  const apiPartial = apiResults.filter(r => r.status === 'partial').length;
  const apiLegacy = apiResults.filter(r => r.status === 'legacy').length;
  const apiPercentage = Math.round((apiMigrated / apiResults.length) * 100);

  console.log('\n📡 API Routes Migration Status\n');
  console.log(`  Total:     ${apiResults.length}`);
  console.log(`  Migrated:  ${apiMigrated} (${apiPercentage}%)`);
  console.log(`  Partial:   ${apiPartial}`);
  console.log(`  Legacy:    ${apiLegacy}`);
  console.log(`\n  Progress: [${'█'.repeat(Math.floor(apiPercentage / 5))}${'░'.repeat(20 - Math.floor(apiPercentage / 5))}] ${apiPercentage}%`);

  // Show legacy routes
  if (apiLegacy > 0) {
    console.log('\n  Legacy routes to migrate (first 10):');
    apiResults
      .filter(r => r.status === 'legacy')
      .slice(0, 10)
      .forEach(r => console.log(`    - ${r.file.replace(projectRoot + '/', '')} (${r.lineCount} lines)`));
  }

  // Scan server actions
  const serverActions = await glob('actions/**/*.ts', { cwd: projectRoot });
  const actionResults = serverActions.map(file => analyzeFile(path.join(projectRoot, file)));

  const actionMigrated = actionResults.filter(r => r.status === 'migrated').length;
  const actionPartial = actionResults.filter(r => r.status === 'partial').length;
  const actionLegacy = actionResults.filter(r => r.status === 'legacy').length;
  const actionPercentage = actionResults.length > 0
    ? Math.round((actionMigrated / actionResults.length) * 100)
    : 0;

  console.log('\n\n⚡ Server Actions Migration Status\n');
  console.log(`  Total:     ${actionResults.length}`);
  console.log(`  Migrated:  ${actionMigrated} (${actionPercentage}%)`);
  console.log(`  Partial:   ${actionPartial}`);
  console.log(`  Legacy:    ${actionLegacy}`);
  console.log(`\n  Progress: [${'█'.repeat(Math.floor(actionPercentage / 5))}${'░'.repeat(20 - Math.floor(actionPercentage / 5))}] ${actionPercentage}%`);

  // Show legacy actions
  if (actionLegacy > 0) {
    console.log('\n  Legacy actions to migrate (first 10):');
    actionResults
      .filter(r => r.status === 'legacy')
      .slice(0, 10)
      .forEach(r => console.log(`    - ${r.file.replace(projectRoot + '/', '')} (${r.lineCount} lines)`));
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Scan complete.\n');
}

main().catch(console.error);
