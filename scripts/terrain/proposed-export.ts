import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import type {
  AnalysisSummary,
  BeachAnalysisResult,
  TerrainAnalysisArgs,
  TerrainProposedExportFilters,
  TerrainProposedExport,
  TerrainProposedExportBeach,
} from './types'
import type { TerrainAnalysisParams } from '../../types/terrain'

const TERRAIN_PROPOSED_SCHEMA_VERSION = 1
const MAX_GENERATED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000

type CompleteSuccessfulTerrainResult = BeachAnalysisResult & {
  success: true
  wind_exposure_factors: number[]
  swell_access_factors: number[]
  terrain_params: TerrainAnalysisParams
  terrain_params_hash: string
}

interface TerrainProposedExportValidationResult {
  ok: boolean
  findings: string[]
}

const PHASE0_APPROVAL_POLICY = {
  status: 'phase0_required',
  production_write_allowed: false,
  requires_phase0_approval: true,
  required_gate: '0-72h',
  required_metric: 'face_height_mae',
  required_validator: 'forecast-accuracy-report-validate --approval',
  min_gate_samples: 75,
  min_slice_samples: 25,
  max_report_age_hours: 24,
} as const

export function buildTerrainProposedExport({
  results,
  summary,
  terrainMethod,
  args,
  generatedAt = new Date(),
}: {
  results: BeachAnalysisResult[]
  summary: AnalysisSummary
  terrainMethod: string
  args: TerrainAnalysisArgs
  generatedAt?: Date
}): TerrainProposedExport {
  return {
    artifact_schema_version: TERRAIN_PROPOSED_SCHEMA_VERSION,
    generated_at: generatedAt.toISOString(),
    terrain_method: terrainMethod,
    approval_policy: { ...PHASE0_APPROVAL_POLICY },
    filters: buildExportFilters(args),
    summary,
    beaches: results
      .filter((result) => isCompleteSuccessfulResult(result))
      .map((result) => ({
        id: result.beach_id,
        name: result.beach_name,
        wind_exposure_factors: result.wind_exposure_factors,
        swell_access_factors: result.swell_access_factors,
        terrain_method: terrainMethod,
        terrain_params: result.terrain_params,
        terrain_params_hash: result.terrain_params_hash,
        terrain_status: result.terrain_status ?? 'ok',
      })),
    failures: results
      .filter((result) => !result.success)
      .map((result) => ({
        id: result.beach_id,
        name: result.beach_name,
        error: result.error ?? 'unknown error',
      })),
  }
}

export function loadTerrainProposedExport(path: string): TerrainProposedExport {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as TerrainProposedExport
}

export function writeTerrainProposedExport(
  outputJsonPath: string,
  proposedExport: TerrainProposedExport
): string {
  const resolvedPath = resolve(outputJsonPath)
  mkdirSync(dirname(resolvedPath), { recursive: true })
  writeFileSync(resolvedPath, `${JSON.stringify(proposedExport, null, 2)}\n`)
  return resolvedPath
}

export function validateTerrainProposedExportArtifact(
  proposedExport: TerrainProposedExport,
  {
    now = new Date(),
    maxArtifactAgeHours = null,
  }: {
    now?: Date
    maxArtifactAgeHours?: number | null
  } = {}
): TerrainProposedExportValidationResult {
  const findings: string[] = []

  if (proposedExport.artifact_schema_version !== TERRAIN_PROPOSED_SCHEMA_VERSION) {
    findings.push(
      `Terrain proposed artifact must declare artifact_schema_version ${TERRAIN_PROPOSED_SCHEMA_VERSION}.`
    )
  }
  validateGeneratedAt(
    proposedExport.generated_at,
    now,
    maxArtifactAgeHours,
    findings
  )
  validateTerrainMethod(proposedExport, findings)
  validateApprovalPolicy(proposedExport, findings)
  validateFilters(proposedExport, findings)
  validateSummary(proposedExport, findings)
  validateBeachRows(proposedExport, findings)
  validateFailureRows(proposedExport, findings)

  return {
    ok: findings.length === 0,
    findings,
  }
}

export function buildTerrainProposedSubsetExport(
  proposedExport: TerrainProposedExport,
  beachIds: string[]
): TerrainProposedExport {
  const selectedIds = new Set(beachIds)
  const beaches = proposedExport.beaches.filter((beach) =>
    selectedIds.has(beach.id)
  )

  return {
    ...proposedExport,
    filters: buildSubsetFilters(proposedExport.filters, beaches),
    summary: buildSubsetSummary(proposedExport.summary, beaches),
    beaches,
    failures: [],
  }
}

function validateGeneratedAt(
  generatedAtValue: unknown,
  now: Date,
  maxArtifactAgeHours: number | null,
  findings: string[]
): void {
  if (typeof generatedAtValue !== 'string') {
    findings.push('Terrain proposed artifact has missing generated_at.')
    return
  }

  const generatedAt = new Date(generatedAtValue)
  if (Number.isNaN(generatedAt.getTime())) {
    findings.push('Terrain proposed artifact has invalid generated_at.')
    return
  }

  const ageMs = now.getTime() - generatedAt.getTime()
  if (ageMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
    findings.push('Terrain proposed artifact generated_at is in the future.')
    return
  }

  if (
    maxArtifactAgeHours != null &&
    ageMs > maxArtifactAgeHours * 60 * 60 * 1000
  ) {
    findings.push(
      `Terrain proposed artifact age ${formatHours(ageMs)}h exceeds ${maxArtifactAgeHours}h.`
    )
  }
}

function validateTerrainMethod(
  proposedExport: TerrainProposedExport,
  findings: string[]
): void {
  if (
    typeof proposedExport.terrain_method !== 'string' ||
    !proposedExport.terrain_method.trim()
  ) {
    findings.push('Terrain proposed artifact terrain_method is missing.')
  }
}

function validateApprovalPolicy(
  proposedExport: TerrainProposedExport,
  findings: string[]
): void {
  const policyValue: unknown = proposedExport.approval_policy
  if (!isRecord(policyValue)) {
    findings.push('Terrain proposed artifact must include approval_policy.')
    return
  }

  for (const [key, expectedValue] of Object.entries(PHASE0_APPROVAL_POLICY)) {
    if (
      key === 'min_gate_samples' ||
      key === 'min_slice_samples' ||
      key === 'max_report_age_hours'
    ) {
      continue
    }
    if (policyValue[key] !== expectedValue) {
      findings.push(
        `Terrain proposed artifact approval_policy.${key} must be ${String(expectedValue)}.`
      )
    }
  }

  validatePolicyFloor(
    policyValue.min_gate_samples,
    PHASE0_APPROVAL_POLICY.min_gate_samples,
    'min_gate_samples',
    findings
  )
  validatePolicyFloor(
    policyValue.min_slice_samples,
    PHASE0_APPROVAL_POLICY.min_slice_samples,
    'min_slice_samples',
    findings
  )
  validatePolicyMaxAge(
    policyValue.max_report_age_hours,
    PHASE0_APPROVAL_POLICY.max_report_age_hours,
    findings
  )
}

function validatePolicyFloor(
  value: unknown,
  minimum: number,
  fieldName: 'min_gate_samples' | 'min_slice_samples',
  findings: string[]
): void {
  if (!Number.isInteger(value) || Number(value) < minimum) {
    findings.push(
      `Terrain proposed artifact approval_policy.${fieldName} must be at least ${minimum}.`
    )
  }
}

function validatePolicyMaxAge(
  value: unknown,
  maximum: number,
  findings: string[]
): void {
  if (!Number.isInteger(value) || Number(value) <= 0 || Number(value) > maximum) {
    findings.push(
      `Terrain proposed artifact approval_policy.max_report_age_hours must be between 1 and ${maximum}.`
    )
  }
}

function validateFilters(
  proposedExport: TerrainProposedExport,
  findings: string[]
): void {
  const filters = proposedExport.filters
  if (!isRecord(filters)) {
    findings.push('Terrain proposed artifact must include filters.')
    return
  }

  if (filters.beachId !== undefined && !isNonEmptyString(filters.beachId)) {
    findings.push('Terrain proposed artifact filters.beachId is invalid.')
  }
  if (filters.beachIds !== undefined) {
    if (!Array.isArray(filters.beachIds)) {
      findings.push('Terrain proposed artifact filters.beachIds must be an array.')
    } else {
      const duplicateIds = findDuplicateStrings(filters.beachIds)
      if (duplicateIds.length > 0) {
        findings.push(
          `Terrain proposed artifact filters.beachIds has duplicate value(s): ${duplicateIds.join(', ')}.`
        )
      }
      for (const beachId of filters.beachIds) {
        if (!isNonEmptyString(beachId)) {
          findings.push('Terrain proposed artifact filters.beachIds contains an invalid id.')
          break
        }
      }
    }
  }
  if (filters.region !== undefined && !isNonEmptyString(filters.region)) {
    findings.push('Terrain proposed artifact filters.region is invalid.')
  }
  for (const key of ['missingOnly', 'force'] as const) {
    if (filters[key] !== undefined && typeof filters[key] !== 'boolean') {
      findings.push(`Terrain proposed artifact filters.${key} is invalid.`)
    }
  }
  for (const key of ['limit', 'offset'] as const) {
    if (filters[key] !== undefined && !isNonNegativeInteger(filters[key])) {
      findings.push(`Terrain proposed artifact filters.${key} is invalid.`)
    }
  }
}

function validateSummary(
  proposedExport: TerrainProposedExport,
  findings: string[]
): void {
  const summary = proposedExport.summary
  if (!isRecord(summary)) {
    findings.push('Terrain proposed artifact must include summary.')
    return
  }

  for (const key of [
    'total_beaches',
    'successful',
    'failed',
    'skipped',
    'total_time_ms',
  ] as const) {
    if (!isNonNegativeInteger(summary[key])) {
      findings.push(`Terrain proposed artifact summary.${key} must be a nonnegative integer.`)
    }
  }
  if (!isNonNegativeFiniteNumber(summary.avg_time_per_beach_ms)) {
    findings.push(
      'Terrain proposed artifact summary.avg_time_per_beach_ms must be a nonnegative number.'
    )
  }
  if (
    typeof summary.total_beaches === 'number' &&
    typeof summary.successful === 'number' &&
    typeof summary.failed === 'number' &&
    summary.total_beaches !== summary.successful + summary.failed
  ) {
    findings.push(
      'Terrain proposed artifact summary.total_beaches must equal successful + failed.'
    )
  }
  if (
    Array.isArray(proposedExport.beaches) &&
    typeof summary.successful === 'number' &&
    proposedExport.beaches.length > summary.successful
  ) {
    findings.push(
      'Terrain proposed artifact beaches.length cannot exceed summary.successful.'
    )
  }
  if (
    Array.isArray(proposedExport.failures) &&
    typeof summary.failed === 'number' &&
    proposedExport.failures.length !== summary.failed
  ) {
    findings.push(
      'Terrain proposed artifact failures.length must match summary.failed.'
    )
  }
}

function validateBeachRows(
  proposedExport: TerrainProposedExport,
  findings: string[]
): void {
  if (!Array.isArray(proposedExport.beaches)) {
    findings.push('Terrain proposed artifact beaches must be an array.')
    return
  }

  const ids = new Set<string>()
  for (const beach of proposedExport.beaches) {
    if (!isRecord(beach)) {
      findings.push('Terrain proposed artifact beaches must contain objects.')
      continue
    }
    const id = typeof beach.id === 'string' ? beach.id : ''
    if (!id) {
      findings.push('Terrain proposed beach is missing id.')
      continue
    }
    if (ids.has(id)) {
      findings.push(`Duplicate terrain proposed beach id: ${id}.`)
    }
    ids.add(id)

    if (!isNonEmptyString(beach.name)) {
      findings.push(`Terrain proposed beach ${id} is missing name.`)
    }
    validateTerrainFactorArray(beach.wind_exposure_factors, id, 'wind_exposure_factors', findings)
    validateTerrainFactorArray(beach.swell_access_factors, id, 'swell_access_factors', findings)

    if (beach.terrain_method !== proposedExport.terrain_method) {
      findings.push(
        `Terrain proposed beach ${id} terrain_method must match artifact terrain_method.`
      )
    }
    if (!isRecord(beach.terrain_params)) {
      findings.push(`Terrain proposed beach ${id} is missing terrain_params.`)
    }
    if (!isNonEmptyString(beach.terrain_params_hash)) {
      findings.push(`Terrain proposed beach ${id} is missing terrain_params_hash.`)
    }
    if (!isTerrainBeachStatus(beach.terrain_status)) {
      findings.push(`Terrain proposed beach ${id} terrain_status is invalid.`)
    }
  }
}

function validateTerrainFactorArray(
  value: unknown,
  beachId: string,
  fieldName: 'wind_exposure_factors' | 'swell_access_factors',
  findings: string[]
): void {
  if (!Array.isArray(value)) {
    findings.push(`Terrain proposed beach ${beachId} must include ${fieldName}.`)
    return
  }
  if (value.length !== 72) {
    findings.push(
      `Terrain proposed beach ${beachId} ${fieldName} must have 72 values.`
    )
    return
  }
  for (const [index, factor] of value.entries()) {
    if (
      typeof factor !== 'number' ||
      !Number.isFinite(factor) ||
      factor < 0 ||
      factor > 1
    ) {
      findings.push(
        `Terrain proposed beach ${beachId} ${fieldName} has invalid value at index ${index}.`
      )
      return
    }
  }
}

function validateFailureRows(
  proposedExport: TerrainProposedExport,
  findings: string[]
): void {
  if (!Array.isArray(proposedExport.failures)) {
    findings.push('Terrain proposed artifact failures must be an array.')
    return
  }

  const proposedIds = new Set(
    Array.isArray(proposedExport.beaches)
      ? proposedExport.beaches
          .filter((beach) => isRecord(beach) && typeof beach.id === 'string')
          .map((beach) => beach.id)
      : []
  )
  const failureIds = new Set<string>()
  for (const failure of proposedExport.failures) {
    if (!isRecord(failure)) {
      findings.push('Terrain proposed artifact failures must contain objects.')
      continue
    }
    const id = typeof failure.id === 'string' ? failure.id : ''
    if (!id) {
      findings.push('Terrain proposed failure row is missing id.')
      continue
    }
    if (failureIds.has(id)) {
      findings.push(`Duplicate terrain proposed failure beach id: ${id}.`)
    }
    failureIds.add(id)
    if (proposedIds.has(id)) {
      findings.push(
        `Terrain proposed failure beach id ${id} also appears in beaches.`
      )
    }
    if (!isNonEmptyString(failure.name)) {
      findings.push(`Terrain proposed failure ${id} is missing name.`)
    }
    if (!isNonEmptyString(failure.error)) {
      findings.push(`Terrain proposed failure ${id} is missing error.`)
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isNonNegativeInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 0
}

function isNonNegativeFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isTerrainBeachStatus(value: unknown): boolean {
  return value === 'ok' || value === 'wind_only'
}

function findDuplicateStrings(values: unknown[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (typeof value !== 'string' || !value) {
      continue
    }
    if (seen.has(value)) {
      duplicates.add(value)
    } else {
      seen.add(value)
    }
  }
  return Array.from(duplicates).sort((a, b) => a.localeCompare(b))
}

function formatHours(ageMs: number): string {
  return (ageMs / (60 * 60 * 1000)).toFixed(3)
}

function buildExportFilters(
  args: TerrainAnalysisArgs
): TerrainProposedExportFilters {
  const filters: TerrainProposedExportFilters = {}

  if (args.beachId !== undefined) filters.beachId = args.beachId
  if (args.beachIds !== undefined) filters.beachIds = args.beachIds
  if (args.region !== undefined) filters.region = args.region
  if (args.missingOnly !== undefined) filters.missingOnly = args.missingOnly
  if (args.limit !== undefined) filters.limit = args.limit
  if (args.offset !== undefined) filters.offset = args.offset
  if (args.force !== undefined) filters.force = args.force

  return filters
}

function buildSubsetSummary(
  sourceSummary: AnalysisSummary,
  beaches: TerrainProposedExportBeach[]
): AnalysisSummary {
  const avgTimePerBeachMs = sourceSummary.avg_time_per_beach_ms

  return {
    total_beaches: beaches.length,
    successful: beaches.length,
    failed: 0,
    skipped: 0,
    total_time_ms: Math.round(avgTimePerBeachMs * beaches.length),
    avg_time_per_beach_ms: beaches.length > 0 ? avgTimePerBeachMs : 0,
  }
}

function buildSubsetFilters(
  sourceFilters: TerrainProposedExportFilters,
  beaches: TerrainProposedExportBeach[]
): TerrainProposedExportFilters {
  const { beachId: _beachId, beachIds: _beachIds, ...filters } = sourceFilters
  const selectedBeachIds = beaches.map((beach) => beach.id)

  if (selectedBeachIds.length === 1) {
    return {
      ...filters,
      beachId: selectedBeachIds[0],
    }
  }

  return {
    ...filters,
    beachIds: selectedBeachIds,
  }
}

function isCompleteSuccessfulResult(
  result: BeachAnalysisResult
): result is CompleteSuccessfulTerrainResult {
  return (
    result.success &&
    result.wind_exposure_factors?.length === 72 &&
    result.swell_access_factors?.length === 72 &&
    result.terrain_params != null &&
    result.terrain_params_hash != null
  )
}
