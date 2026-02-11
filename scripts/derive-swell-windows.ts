#!/usr/bin/env node
/**
 * Swell Window Derivation Script
 *
 * Derives correct swell windows from terrain `swell_access_factors` data
 * for all beaches, reports mismatches against current database values,
 * and optionally generates migration SQL.
 *
 * Usage:
 *   npx tsx scripts/derive-swell-windows.ts                        # Dry-run report (default)
 *   npx tsx scripts/derive-swell-windows.ts --output=sql           # Generate migration SQL
 *   npx tsx scripts/derive-swell-windows.ts --output=json          # JSON output
 *   npx tsx scripts/derive-swell-windows.ts --threshold=0.20       # Custom threshold
 *   npx tsx scripts/derive-swell-windows.ts --state=CA             # Filter by state
 *   npx tsx scripts/derive-swell-windows.ts --region=california    # Filter by region
 *   npx tsx scripts/derive-swell-windows.ts --beach-id=UUID        # Single beach
 *   npx tsx scripts/derive-swell-windows.ts --only-mismatches      # Only show mismatches
 *
 * Environment Variables Required:
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access
 *
 * Algorithm:
 *   1. For each beach with swell_access_factors, mark bins >= threshold as active
 *   2. Find contiguous runs of active bins (handling 0/360 wrap-around)
 *   3. Pick the longest run as the primary swell window
 *   4. Convert bin indices to degrees (min, max, center, halfwidth)
 *   5. Compare derived window against current database values
 *   6. Report mismatches and optionally generate migration SQL
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables from .env.local
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// --- Constants ---

const NUM_BINS = 72
const DEGREES_PER_BIN = 5
const DEFAULT_THRESHOLD = 0.15
const MISMATCH_TOLERANCE_DEG = 5
const NARROW_WINDOW_BINS = 4 // <= 15 degrees (bins with < 4 bins = 0-3 bins)

// --- Inline angle utilities (self-contained, no path alias imports) ---

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function angleDifference(deg1: number, deg2: number): number {
  const diff = Math.abs(normalizeAngle(deg1) - normalizeAngle(deg2))
  return diff > 180 ? 360 - diff : diff
}

function binToDegrees(bin: number): number {
  return bin * DEGREES_PER_BIN
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

// --- Output format validation ---

const VALID_OUTPUT_FORMATS = ['text', 'sql', 'json'] as const
type OutputFormat = typeof VALID_OUTPUT_FORMATS[number]

function validateOutputFormat(val: string): OutputFormat {
  if (!(VALID_OUTPUT_FORMATS as readonly string[]).includes(val)) {
    console.error(`Invalid output format: ${val}. Must be ${VALID_OUTPUT_FORMATS.join(', ')}.`)
    process.exit(1)
  }
  return val as OutputFormat
}

// --- Types ---

interface CLIArgs {
  dryRun: boolean
  threshold: number
  state?: string
  region?: string
  beachId?: string
  output: OutputFormat
  onlyMismatches: boolean
}

interface BeachRow {
  id: string
  name: string
  city: string
  state: string
  region: string | null
  swell_window_min_deg: number | null
  swell_window_max_deg: number | null
  swell_window_center_deg: number | null
  swell_window_halfwidth_deg: number | null
  swell_access_factors: number[] | null
  terrain_enabled: boolean | null
}

interface DerivedWindow {
  min: number
  max: number
  center: number
  halfwidth: number
}

interface ContiguousRun {
  startBin: number
  endBin: number
  length: number
  wrapsAround: boolean
}

interface BeachAnalysis {
  id: string
  name: string
  city: string
  state: string
  current: {
    min: number | null
    max: number | null
    center: number | null
    halfwidth: number | null
  }
  derived: DerivedWindow
  activeBins: number[]
  longestRun: ContiguousRun
  secondaryRuns: ContiguousRun[]
  wrapsAround: boolean
  isMismatch: boolean
  isAllDirections: boolean
  isFullyBlocked: boolean
  isNarrow: boolean
}

// --- Argument Parsing ---

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {
    dryRun: true,
    threshold: DEFAULT_THRESHOLD,
    output: 'text',
    onlyMismatches: false,
  }

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--no-dry-run') {
      args.dryRun = false
    } else if (arg.startsWith('--threshold=')) {
      args.threshold = parseFloat(arg.split('=')[1])
    } else if (arg === '--threshold') {
      args.threshold = parseFloat(argv[++i])
    } else if (arg.startsWith('--state=')) {
      args.state = arg.split('=')[1]
    } else if (arg === '--state') {
      args.state = argv[++i]
    } else if (arg.startsWith('--region=')) {
      args.region = arg.split('=')[1]
    } else if (arg === '--region') {
      args.region = argv[++i]
    } else if (arg.startsWith('--beach-id=')) {
      args.beachId = arg.split('=')[1]
    } else if (arg === '--beach-id') {
      args.beachId = argv[++i]
    } else if (arg.startsWith('--output=')) {
      args.output = validateOutputFormat(arg.split('=')[1])
    } else if (arg === '--output') {
      args.output = validateOutputFormat(argv[++i])
    } else if (arg === '--only-mismatches') {
      args.onlyMismatches = true
    } else {
      console.error(`Unknown argument: ${arg}`)
      console.error('')
      console.error('Usage: npx tsx scripts/derive-swell-windows.ts [options]')
      console.error('')
      console.error('Options:')
      console.error('  --dry-run              Report only, no SQL output (default: true)')
      console.error('  --threshold=0.15       Factor threshold for "active" bin (default: 0.15)')
      console.error('  --state=CA             Filter beaches by state')
      console.error('  --region=california    Filter beaches by region (ilike)')
      console.error('  --beach-id=UUID        Analyze single beach')
      console.error('  --output=sql|json|text Output format (default: text report)')
      console.error('  --only-mismatches      Only show beaches where current != derived')
      process.exit(1)
    }
  }

  return args
}

// --- Environment Validation ---

function validateEnvironment(): boolean {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables:')
    if (!SUPABASE_URL) console.error('   - NEXT_PUBLIC_SUPABASE_URL')
    if (!SUPABASE_SERVICE_ROLE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY')
    console.error('\nPlease check your .env.local file.')
    return false
  }
  return true
}

// --- Database ---

async function loadBeaches(
  supabase: SupabaseClient,
  args: CLIArgs
): Promise<BeachRow[]> {
  let query = supabase
    .from('beaches')
    .select(
      'id, name, city, state, region, swell_window_min_deg, swell_window_max_deg, swell_window_center_deg, swell_window_halfwidth_deg, swell_access_factors, terrain_enabled'
    )
    .not('swell_access_factors', 'is', null)
    .order('state')
    .order('city')
    .order('name')

  if (args.state) {
    query = query.ilike('state', args.state)
  }
  if (args.region) {
    query = query.ilike('region', `%${args.region}%`)
  }
  if (args.beachId) {
    query = query.eq('id', args.beachId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to load beaches: ${error.message}`)
  }

  return (data ?? []) as BeachRow[]
}

// --- Core Algorithm ---

/**
 * Find all contiguous runs of active bins in the linear 0..71 array.
 * Does NOT handle circular wrap-around -- that's done by the caller.
 */
function findLinearRuns(activeBins: boolean[]): Array<{ start: number; end: number }> {
  const runs: Array<{ start: number; end: number }> = []
  let runStart: number | null = null

  for (let i = 0; i < activeBins.length; i++) {
    if (activeBins[i]) {
      if (runStart === null) runStart = i
    } else {
      if (runStart !== null) {
        runs.push({ start: runStart, end: i - 1 })
        runStart = null
      }
    }
  }
  if (runStart !== null) {
    runs.push({ start: runStart, end: activeBins.length - 1 })
  }

  return runs
}

/**
 * Merge first and last linear runs when they form a single wrap-around window.
 */
function mergeWrapAroundRuns(
  firstRun: { start: number; end: number },
  lastRun: { start: number; end: number }
): ContiguousRun {
  return {
    startBin: lastRun.start,
    endBin: firstRun.end,
    length: (NUM_BINS - lastRun.start) + (firstRun.end + 1),
    wrapsAround: true,
  }
}

/**
 * Find all contiguous runs of active bins, handling circular wrap-around.
 *
 * Strategy:
 *   1. Find all contiguous runs in the linear 0..71 array.
 *   2. If both bin 0 and bin 71 are active, merge the first and last runs
 *      (they form one contiguous window that wraps around 360/0).
 *   3. Return all runs sorted by length descending.
 */
function findContiguousRuns(activeBins: boolean[]): ContiguousRun[] {
  if (activeBins.length !== NUM_BINS) {
    throw new Error(`Expected ${NUM_BINS} bins, got ${activeBins.length}`)
  }

  const linearRuns = findLinearRuns(activeBins)

  if (linearRuns.length === 0) {
    return []
  }

  // Edge case: single run covers ALL bins (0..71)
  if (
    linearRuns.length === 1 &&
    linearRuns[0].start === 0 &&
    linearRuns[0].end === NUM_BINS - 1
  ) {
    return [
      {
        startBin: 0,
        endBin: NUM_BINS - 1,
        length: NUM_BINS,
        wrapsAround: false,
      },
    ]
  }

  let runs: ContiguousRun[] = []
  const shouldMerge =
    linearRuns.length >= 2 &&
    activeBins[0] &&
    activeBins[NUM_BINS - 1]

  if (shouldMerge) {
    const lastRun = linearRuns[linearRuns.length - 1]
    const firstRun = linearRuns[0]

    runs.push(mergeWrapAroundRuns(firstRun, lastRun))

    // Add all middle runs (not first, not last)
    for (let i = 1; i < linearRuns.length - 1; i++) {
      const run = linearRuns[i]
      runs.push({
        startBin: run.start,
        endBin: run.end,
        length: run.end - run.start + 1,
        wrapsAround: false,
      })
    }
  } else {
    for (const run of linearRuns) {
      runs.push({
        startBin: run.start,
        endBin: run.end,
        length: run.end - run.start + 1,
        wrapsAround: false,
      })
    }
  }

  // Sort by length descending
  runs.sort((a, b) => b.length - a.length)

  return runs
}

/**
 * Derive swell window from swell_access_factors array.
 */
function deriveSwellWindow(
  factors: number[],
  threshold: number
): {
  derived: DerivedWindow
  activeBins: number[]
  longestRun: ContiguousRun
  secondaryRuns: ContiguousRun[]
  isAllDirections: boolean
  isFullyBlocked: boolean
  isNarrow: boolean
} {
  // Step 1: Mark active bins
  const active = factors.map((f) => f >= threshold)
  const activeBinIndices = active
    .map((v, i) => (v ? i : -1))
    .filter((i) => i >= 0)

  // Step 2: Find contiguous runs
  const runs = findContiguousRuns(active)

  // Edge case: no active bins
  if (runs.length === 0 || activeBinIndices.length === 0) {
    return {
      derived: { min: 0, max: 0, center: 0, halfwidth: 0 },
      activeBins: [],
      longestRun: { startBin: 0, endBin: 0, length: 0, wrapsAround: false },
      secondaryRuns: [],
      isAllDirections: false,
      isFullyBlocked: true,
      isNarrow: false,
    }
  }

  const longestRun = runs[0]
  const secondaryRuns = runs.slice(1)

  // Edge case: all bins active
  const isAllDirections = longestRun.length >= NUM_BINS

  // Edge case: very narrow window
  const isNarrow = longestRun.length < NARROW_WINDOW_BINS

  // Step 3: Convert to degrees
  const minDeg = binToDegrees(longestRun.startBin)
  const maxDeg = binToDegrees(longestRun.endBin)

  // Step 4: Compute center and halfwidth using the same logic as spot-profile
  let span = normalizeAngle(maxDeg - minDeg)
  if (span === 0 && maxDeg !== minDeg) {
    span = 360
  }
  // Special case: all directions
  if (isAllDirections) {
    span = (NUM_BINS - 1) * DEGREES_PER_BIN // 0 to 355 covers all 72 bins
  }
  const centerDeg = normalizeAngle(minDeg + span / 2)
  const halfwidthDeg = span / 2

  return {
    derived: {
      min: minDeg,
      max: maxDeg,
      center: centerDeg,
      halfwidth: halfwidthDeg,
    },
    activeBins: activeBinIndices,
    longestRun,
    secondaryRuns,
    isAllDirections,
    isFullyBlocked: false,
    isNarrow,
  }
}

/**
 * Check if a beach's current window mismatches the derived window.
 */
function isMismatch(
  current: { min: number | null; max: number | null },
  derived: DerivedWindow
): boolean {
  // If current values are null, it's a mismatch (no window set)
  if (current.min == null || current.max == null) {
    return true
  }

  const minDiff = angleDifference(current.min, derived.min)
  const maxDiff = angleDifference(current.max, derived.max)

  return minDiff > MISMATCH_TOLERANCE_DEG || maxDiff > MISMATCH_TOLERANCE_DEG
}

/**
 * Analyze all beaches and produce results.
 */
function analyzeBeaches(beaches: BeachRow[], threshold: number): BeachAnalysis[] {
  const results: BeachAnalysis[] = []

  for (const beach of beaches) {
    const factors = beach.swell_access_factors
    if (!factors || factors.length !== NUM_BINS) {
      continue
    }

    const {
      derived,
      activeBins,
      longestRun,
      secondaryRuns,
      isAllDirections,
      isFullyBlocked,
      isNarrow,
    } = deriveSwellWindow(factors, threshold)

    const current = {
      min: beach.swell_window_min_deg,
      max: beach.swell_window_max_deg,
      center: beach.swell_window_center_deg,
      halfwidth: beach.swell_window_halfwidth_deg,
    }

    const mismatch = isFullyBlocked ? false : isMismatch(current, derived)

    results.push({
      id: beach.id,
      name: beach.name,
      city: beach.city,
      state: beach.state,
      current,
      derived,
      activeBins,
      longestRun,
      secondaryRuns,
      wrapsAround: longestRun.wrapsAround,
      isMismatch: mismatch,
      isAllDirections,
      isFullyBlocked,
      isNarrow,
    })
  }

  return results
}

// --- Output Formatters ---

function formatBinRange(run: ContiguousRun): string {
  const minDeg = binToDegrees(run.startBin)
  const maxDeg = binToDegrees(run.endBin)
  const wrap = run.wrapsAround ? ' [WRAPS]' : ''
  return `${run.startBin}-${run.endBin} (${minDeg}deg - ${maxDeg}deg)${wrap}`
}

function describeChange(
  current: { min: number | null; max: number | null },
  derived: DerivedWindow
): string {
  if (current.min == null || current.max == null) {
    return 'NEW (no previous window)'
  }

  const minDiff = angleDifference(current.min, derived.min)
  const maxDiff = angleDifference(current.max, derived.max)

  const currentSpan = normalizeAngle(current.max - current.min)
  const derivedSpan = normalizeAngle(derived.max - derived.min)
  const wider = derivedSpan > currentSpan ? 'wider' : derivedSpan < currentSpan ? 'narrower' : 'same width'

  return `min shifted ${minDiff}deg, max shifted ${maxDiff}deg (${wider})`
}

function outputTextReport(
  results: BeachAnalysis[],
  args: CLIArgs,
  totalQueried: number
): void {
  const mismatches = results.filter((r) => r.isMismatch && !r.isFullyBlocked)
  const matches = results.filter((r) => !r.isMismatch && !r.isFullyBlocked)
  const fullyBlocked = results.filter((r) => r.isFullyBlocked)
  const narrow = results.filter((r) => r.isNarrow && !r.isFullyBlocked)
  const allDir = results.filter((r) => r.isAllDirections)

  console.log('='.repeat(60))
  console.log('Swell Window Derivation Report')
  console.log('='.repeat(60))
  console.log('Configuration:')
  console.log(`  Threshold: ${args.threshold}`)
  if (args.state) console.log(`  State filter: ${args.state}`)
  if (args.region) console.log(`  Region filter: ${args.region}`)
  if (args.beachId) console.log(`  Beach ID: ${args.beachId}`)
  console.log(`  Beaches with terrain data: ${results.length}`)
  console.log(`  Beaches with mismatches: ${mismatches.length}`)
  console.log(`  Mismatch tolerance: ${MISMATCH_TOLERANCE_DEG}deg`)
  console.log('')

  // --- MISMATCHES ---
  if (mismatches.length > 0) {
    console.log('--- MISMATCHES ---')
    console.log('')

    mismatches.forEach((beach, idx) => {
      console.log(
        `#${idx + 1} ${beach.name} (${beach.city}, ${beach.state.toUpperCase()})`
      )
      console.log(
        `  Current:  min=${beach.current.min ?? 'null'} max=${beach.current.max ?? 'null'} center=${beach.current.center ?? 'null'} half=${beach.current.halfwidth ?? 'null'}`
      )
      console.log(
        `  Derived:  min=${beach.derived.min} max=${beach.derived.max} center=${beach.derived.center} half=${beach.derived.halfwidth}`
      )
      console.log(`  Change:   ${describeChange(beach.current, beach.derived)}`)
      console.log(`  Active bins: ${formatBinRange(beach.longestRun)}`)
      if (beach.secondaryRuns.length > 0) {
        console.log(
          `  Secondary windows: ${beach.secondaryRuns.map(formatBinRange).join(', ')}`
        )
      }
      if (beach.isNarrow) {
        console.log('  WARNING: Narrow window (<= 15deg) - possible data quality issue')
      }
      if (beach.isAllDirections) {
        console.log('  NOTE: All-directions exposure')
      }
      console.log('')
    })
  }

  // --- MATCHES ---
  if (!args.onlyMismatches && matches.length > 0) {
    console.log('--- MATCHES ---')
    console.log(`(beaches where current window matches derived within ${MISMATCH_TOLERANCE_DEG}deg)`)
    console.log('')

    matches.forEach((beach) => {
      console.log(
        `  ${beach.name} (${beach.city}, ${beach.state.toUpperCase()}) - min=${beach.derived.min} max=${beach.derived.max}`
      )
    })
    console.log('')
  }

  // --- SPECIAL FLAGS ---
  if (fullyBlocked.length > 0) {
    console.log('--- FULLY BLOCKED ---')
    console.log('(no active bins above threshold - possible data quality issue)')
    console.log('')
    fullyBlocked.forEach((beach) => {
      console.log(
        `  ${beach.name} (${beach.city}, ${beach.state.toUpperCase()})`
      )
    })
    console.log('')
  }

  if (narrow.length > 0 && !args.onlyMismatches) {
    console.log('--- NARROW WINDOWS ---')
    console.log('(<= 15deg - may indicate data issues)')
    console.log('')
    narrow.forEach((beach) => {
      console.log(
        `  ${beach.name} (${beach.city}, ${beach.state.toUpperCase()}) - ${beach.longestRun.length} bins (${beach.longestRun.length * DEGREES_PER_BIN}deg)`
      )
    })
    console.log('')
  }

  if (allDir.length > 0 && !args.onlyMismatches) {
    console.log('--- ALL-DIRECTIONS EXPOSURE ---')
    console.log('')
    allDir.forEach((beach) => {
      console.log(
        `  ${beach.name} (${beach.city}, ${beach.state.toUpperCase()})`
      )
    })
    console.log('')
  }

  // --- SUMMARY ---
  console.log('--- SUMMARY ---')
  console.log(`Total queried:       ${totalQueried} beaches`)
  console.log(`Has terrain data:    ${results.length} beaches`)
  console.log(
    `Match:               ${matches.length} beaches (${results.length > 0 ? ((matches.length / results.length) * 100).toFixed(1) : 0}%)`
  )
  console.log(
    `Mismatch:            ${mismatches.length} beaches (${results.length > 0 ? ((mismatches.length / results.length) * 100).toFixed(1) : 0}%)`
  )
  console.log(`Fully blocked:       ${fullyBlocked.length} beaches`)
  console.log(`Narrow (<= 15deg):   ${narrow.length} beaches`)
  console.log(`All-directions:      ${allDir.length} beaches`)
  console.log('')
}

function outputSQL(results: BeachAnalysis[], args: CLIArgs): void {
  // Exclude fully blocked and narrow windows from SQL output — these have terrain data quality issues
  const mismatches = results.filter((r) => r.isMismatch && !r.isFullyBlocked && !r.isNarrow)

  if (mismatches.length === 0) {
    console.log('-- No mismatches found. No migration needed.')
    return
  }

  const now = new Date().toISOString().split('T')[0]

  console.log('BEGIN;')
  console.log('')
  console.log(`-- Comprehensive swell window fix derived from terrain ray-tracing data`)
  console.log(`-- Generated by scripts/derive-swell-windows.ts on ${now}`)
  console.log(`-- Threshold: ${args.threshold}, Beaches updated: ${mismatches.length}`)
  console.log('')

  for (const beach of mismatches) {
    console.log(
      `-- Beach: ${beach.name} (${beach.city}, ${beach.state.toUpperCase()})`
    )
    console.log(`-- Active swell access bins: ${formatBinRange(beach.longestRun)}`)
    if (beach.current.min != null && beach.current.max != null) {
      console.log(
        `-- Previous: min=${beach.current.min} max=${beach.current.max} center=${beach.current.center} half=${beach.current.halfwidth}`
      )
    } else {
      console.log('-- Previous: no swell window set')
    }
    if (beach.secondaryRuns.length > 0) {
      console.log(
        `-- Secondary windows: ${beach.secondaryRuns.map(formatBinRange).join(', ')}`
      )
    }
    if (beach.isNarrow) {
      console.log('-- WARNING: Narrow window (<= 15 degrees)')
    }
    // Validate UUID format before interpolating into SQL
    if (!isValidUUID(beach.id)) {
      console.log(`-- SKIPPED: Invalid UUID format for ${beach.name}: ${beach.id}`)
      console.log('')
      continue
    }
    console.log(`UPDATE beaches SET`)
    console.log(`  swell_window_min_deg = ${beach.derived.min},`)
    console.log(`  swell_window_max_deg = ${beach.derived.max},`)
    console.log(`  swell_window_center_deg = ${beach.derived.center},`)
    console.log(`  swell_window_halfwidth_deg = ${beach.derived.halfwidth}`)
    console.log(`WHERE id = '${beach.id}';`)
    console.log('')
  }

  console.log('COMMIT;')
}

function outputJSON(results: BeachAnalysis[], args: CLIArgs): void {
  const output = results
    .filter((r) => !r.isFullyBlocked)
    .filter((r) => !args.onlyMismatches || r.isMismatch)
    .map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      state: r.state,
      current: r.current,
      derived: r.derived,
      activeBins: r.activeBins,
      longestRun: {
        startBin: r.longestRun.startBin,
        endBin: r.longestRun.endBin,
        length: r.longestRun.length,
        wrapsAround: r.longestRun.wrapsAround,
      },
      secondaryRuns: r.secondaryRuns.map((s) => ({
        startBin: s.startBin,
        endBin: s.endBin,
        length: s.length,
        wrapsAround: s.wrapsAround,
      })),
      wrapsAround: r.wrapsAround,
      isMismatch: r.isMismatch,
      isAllDirections: r.isAllDirections,
      isNarrow: r.isNarrow,
    }))

  console.log(JSON.stringify(output, null, 2))
}

// --- Main ---

async function main() {
  const args = parseArgs(process.argv)

  if (!validateEnvironment()) {
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Load beaches with terrain data
  if (args.output === 'text') {
    console.log('Loading beaches with swell_access_factors...')
    console.log('')
  }

  const beaches = await loadBeaches(supabase, args)

  // Also count total beaches for context (including those without terrain data)
  const { count: totalCount } = await supabase
    .from('beaches')
    .select('id', { count: 'exact', head: true })

  const totalQueried = totalCount ?? 0

  if (beaches.length === 0) {
    if (args.output === 'text') {
      console.log('No beaches found with swell_access_factors matching the given filters.')
    } else if (args.output === 'json') {
      console.log('[]')
    } else if (args.output === 'sql') {
      console.log('-- No beaches found. No migration needed.')
    }
    process.exit(0)
  }

  if (args.output === 'text') {
    console.log(`Loaded ${beaches.length} beaches with terrain data.`)
    console.log(`Analyzing swell windows with threshold=${args.threshold}...`)
    console.log('')
  }

  // Analyze all beaches
  const results = analyzeBeaches(beaches, args.threshold)

  // Output results in the requested format
  switch (args.output) {
    case 'text':
      outputTextReport(results, args, totalQueried)
      break
    case 'sql':
      outputSQL(results, args)
      break
    case 'json':
      outputJSON(results, args)
      break
  }
}

// Execute script
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

// Export for testing
export {
  main,
  parseArgs,
  findLinearRuns,
  mergeWrapAroundRuns,
  findContiguousRuns,
  deriveSwellWindow,
  isMismatch,
  analyzeBeaches,
  normalizeAngle,
  angleDifference,
  binToDegrees,
  isValidUUID,
  validateOutputFormat,
}
