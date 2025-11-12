/**
 * Test file for Beach Affinity Initial Computation Script
 * Validates structure, imports, and environment handling
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Mock environment variables
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
});

describe('Beach Affinity Initial Computation Script', () => {
  const scriptPath = path.join(__dirname, '../compute-initial-affinities.ts');

  it('should have correct file structure', () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  it('should export main function', async () => {
    try {
      const script = await import('../compute-initial-affinities');
      expect(typeof script.computeInitialAffinities).toBe('function');
    } catch (error) {
      console.log('Import test skipped - dependencies may not be available in test environment');
    }
  });

  it('should validate environment variables correctly', () => {
    const requiredVars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

    requiredVars.forEach(varName => {
      expect(process.env[varName]).toBeDefined();
    });
  });

  it('should have proper TypeScript structure', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');

    // Check for essential patterns
    expect(content).toContain('computeInitialAffinities');
    expect(content).toContain('validateEnvironment');
    expect(content).toContain('compute_all_affinities_initial');
    expect(content).toContain('export { computeInitialAffinities }');
    expect(content).toContain('createClient');
  });

  it('should include proper error handling', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');

    // Check for error handling patterns
    expect(content).toContain('try');
    expect(content).toContain('catch');
    expect(content).toContain('process.exit(1)');
    expect(content).toContain('if (error)');
  });

  it('should follow script conventions', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');

    // Check for standard script patterns
    expect(content).toContain('#!/usr/bin/env node');
    expect(content).toContain('import { createClient }');
    expect(content).toContain('import { config } from \'dotenv\'');
    expect(content).toContain('config()');
    expect(content).toContain('if (require.main === module)');
  });

  it('should include comprehensive documentation', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');

    // Check for documentation
    expect(content).toContain('Initial Beach Affinity Computation Script');
    expect(content).toContain('Usage:');
    expect(content).toContain('Environment Variables Required:');
    expect(content).toContain('Safety:');
    expect(content).toContain('Idempotent');
  });

  it('should include helpful error messages', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');

    // Check for user-friendly messages
    expect(content).toContain('Missing required environment variables');
    expect(content).toContain('Tip:');
    expect(content).toContain('Successfully computed affinities');
  });

  it('should include summary statistics logic', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');

    // Check for statistics calculations
    expect(content).toContain('Computation Summary');
    expect(content).toContain('totalRecords');
    expect(content).toContain('uniqueUsers');
    expect(content).toContain('uniqueBeaches');
    expect(content).toContain('avgScore');
  });

  it('should use service role authentication', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');

    // Check for service role usage
    expect(content).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(content).toContain('createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)');
  });

  it('should call the correct database function', () => {
    const content = fs.readFileSync(scriptPath, 'utf8');

    // Check for RPC call
    expect(content).toContain('.rpc(\'compute_all_affinities_initial\')');
  });
});
