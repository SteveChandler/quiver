import { readFileSync } from 'node:fs'

import {
  validateForecastAccuracyReport,
  type ForecastAccuracyReport,
} from '../forecast-accuracy-report-validate'
import {
  loadTerrainProposedExport,
  validateTerrainProposedExportArtifact,
} from './proposed-export'
import type { BeachAnalysisResult, TerrainAnalysisArgs } from './types'

const DEFAULT_MAX_APPROVAL_REPORT_AGE_HOURS = 24
const DEFAULT_MIN_APPROVAL_GATE_SAMPLES = 75
const DEFAULT_MIN_APPROVAL_SLICE_SAMPLES = 25
export const TERRAIN_WRITE_HUMAN_APPROVAL_TOKEN =
  '2026-06-19-phase2-terrain-write-approved'
const TERRAIN_FACTOR_BIN_COUNT = 72

interface ProposedScopeInput {
  predictions?: Array<{ beach_id?: string | null }>
  beaches?: Array<{ id?: string | null }>
  [key: string]: unknown
}

interface ApprovedTerrainBeachConfig {
  id: string
  wind_exposure_factors?: unknown
  swell_access_factors?: unknown
  terrain_method?: unknown
  terrain_params_hash?: unknown
  terrain_status?: unknown
}

export function assertTerrainWriteApproved(
  args: TerrainAnalysisArgs,
  now: Date = new Date()
): void {
  if (args.dryRun) {
    return
  }

  const requestedBeachIds = getRequestedBeachIds(args)
  assertNoDuplicateValues({
    values: getRawRequestedBeachIds(args),
    label: 'Requested terrain write scope',
  })
  if (requestedBeachIds.length === 0) {
    throw new Error(
      'Terrain writes require exact --beach-id or --beach-ids scope plus approval artifacts.'
    )
  }
  if (args.missingOnly !== true) {
    throw new Error('Terrain writes require --missing-only.')
  }
  if (args.force) {
    throw new Error('Terrain writes cannot use --force with approval artifacts.')
  }
  if (!args.approvalReportJsonPath) {
    throw new Error('Terrain writes require --approval-report-json.')
  }
  if (!args.approvalProposedJsonPath) {
    throw new Error('Terrain writes require --approval-proposed-json.')
  }

  const proposedArtifact = loadTerrainProposedExport(args.approvalProposedJsonPath)
  const proposedArtifactValidation = validateTerrainProposedExportArtifact(
    proposedArtifact,
    {
      maxArtifactAgeHours:
        args.maxApprovalReportAgeHours ??
        proposedArtifact.approval_policy?.max_report_age_hours ??
        DEFAULT_MAX_APPROVAL_REPORT_AGE_HOURS,
      now,
    }
  )
  if (!proposedArtifactValidation.ok) {
    throw new Error(
      `Terrain write proposed artifact validation failed: ${proposedArtifactValidation.findings.join('; ')}`
    )
  }

  const proposedBeachIds = extractProposedBeachIds(
    proposedArtifact as unknown as ProposedScopeInput
  )
  assertSameSet({
    actual: proposedBeachIds,
    expected: requestedBeachIds,
    label: 'Approval proposed JSON beach scope',
  })

  const approvedBeachConfigs = loadApprovedTerrainBeachConfigs(
    args.approvalProposedJsonPath
  )
  assertNoDuplicateValues({
    values: approvedBeachConfigs.map((beach) => beach.id),
    label: 'Approval proposed JSON terrain config scope',
  })
  assertSameSet({
    actual: approvedBeachConfigs.map((beach) => beach.id),
    expected: requestedBeachIds,
    label: 'Approval proposed JSON terrain config scope',
  })
  for (const approvedBeach of approvedBeachConfigs) {
    assertApprovedTerrainBeachConfigComplete(approvedBeach)
  }

  const report = loadJson<ForecastAccuracyReport>(args.approvalReportJsonPath)
  const result = validateForecastAccuracyReport(report, {
    approval: true,
    requireProposedGate: true,
    requireNonRegressingGate: true,
    requireSlices: true,
    requireBeachSlices: true,
    requireNoRegressedSlices: true,
    requireNoUnmeasuredSlices: true,
    minGateSamples:
      args.minApprovalGateSamples ?? DEFAULT_MIN_APPROVAL_GATE_SAMPLES,
    minSliceSamples:
      args.minApprovalSliceSamples ?? DEFAULT_MIN_APPROVAL_SLICE_SAMPLES,
    maxRowsWithoutProposedValue: 0,
    expectScopeBeachCount: requestedBeachIds.length,
    expectProposedJsonPath: args.approvalProposedJsonPath,
    requireProposedJson: true,
    requireScopeMatchesProposedJson: true,
    maxReportAgeHours:
      args.maxApprovalReportAgeHours ?? DEFAULT_MAX_APPROVAL_REPORT_AGE_HOURS,
    now,
  })

  if (!result.ok) {
    throw new Error(
      `Terrain write approval failed: ${result.findings.join('; ')}`
    )
  }

  if (args.humanApprovalToken !== TERRAIN_WRITE_HUMAN_APPROVAL_TOKEN) {
    throw new Error(
      `Terrain writes require --human-approval-token=${TERRAIN_WRITE_HUMAN_APPROVAL_TOKEN} after explicit human approval.`
    )
  }
}

export function assertTerrainResultsMatchApproval(
  args: TerrainAnalysisArgs,
  results: BeachAnalysisResult[],
  terrainMethod: string
): void {
  if (args.dryRun) {
    return
  }
  if (!args.approvalProposedJsonPath) {
    throw new Error('Terrain writes require --approval-proposed-json.')
  }

  const requestedBeachIds = getRequestedBeachIds(args)
  assertNoDuplicateValues({
    values: getRawRequestedBeachIds(args),
    label: 'Requested terrain write scope',
  })
  assertSameSet({
    actual: results.map((result) => result.beach_id),
    expected: requestedBeachIds,
    label: 'Computed terrain result scope',
  })

  const approvedBeachConfigs = loadApprovedTerrainBeachConfigs(
    args.approvalProposedJsonPath
  )
  assertNoDuplicateValues({
    values: approvedBeachConfigs.map((beach) => beach.id),
    label: 'Approval proposed JSON terrain config scope',
  })
  assertSameSet({
    actual: approvedBeachConfigs.map((beach) => beach.id),
    expected: requestedBeachIds,
    label: 'Approval proposed JSON terrain config scope',
  })

  const resultsByBeachId = new Map(
    results.map((result) => [result.beach_id, result])
  )
  for (const approvedBeach of approvedBeachConfigs) {
    const result = resultsByBeachId.get(approvedBeach.id)
    if (!result) {
      throw new Error(
        `Approved terrain write is missing computed result for ${approvedBeach.id}.`
      )
    }
    if (!result.success) {
      throw new Error(
        `Approved terrain write computed failed result for ${approvedBeach.id}; refusing to write failure status from approved factor artifact.`
      )
    }

    assertTerrainBeachMatchesApprovedConfig({
      approvedBeach,
      result,
      terrainMethod,
    })
  }
}

export function getRequestedBeachIds(args: TerrainAnalysisArgs): string[] {
  return normalizeUniqueStrings(getRawRequestedBeachIds(args))
}

function getRawRequestedBeachIds(args: TerrainAnalysisArgs): string[] {
  return [
    ...(args.beachId ? [args.beachId] : []),
    ...(args.beachIds ?? []),
  ].filter(Boolean)
}

function extractProposedBeachIds(input: ProposedScopeInput): string[] {
  const ids: string[] = []

  if (Array.isArray(input.predictions)) {
    for (const prediction of input.predictions) {
      if (prediction.beach_id) {
        ids.push(prediction.beach_id)
      }
    }
  }

  if (Array.isArray(input.beaches)) {
    for (const beach of input.beaches) {
      if (beach.id) {
        ids.push(beach.id)
      }
    }
  }

  return normalizeUniqueStrings(ids)
}

function loadApprovedTerrainBeachConfigs(
  path: string
): ApprovedTerrainBeachConfig[] {
  const input = loadJson<ProposedScopeInput & { beaches?: unknown }>(path)
  if (!Array.isArray(input.beaches)) {
    throw new Error(
      'Approval proposed JSON must include terrain beach configs for exact write binding.'
    )
  }

  if (input.beaches.length === 0) {
    throw new Error(
      'Approval proposed JSON must include terrain beach configs for exact write binding.'
    )
  }

  return input.beaches.map((beach, index) => {
    if (!isRecord(beach) || typeof beach.id !== 'string') {
      throw new Error(
        `Approval proposed JSON terrain config at index ${index} must include a beach id.`
      )
    }
    return beach as ApprovedTerrainBeachConfig
  })
}

function assertApprovedTerrainBeachConfigComplete(
  approvedBeach: ApprovedTerrainBeachConfig
): void {
  assertApprovedNumberArray({
    label: 'wind_exposure_factors',
    beachId: approvedBeach.id,
    value: approvedBeach.wind_exposure_factors,
  })
  assertApprovedNumberArray({
    label: 'swell_access_factors',
    beachId: approvedBeach.id,
    value: approvedBeach.swell_access_factors,
  })

  if (typeof approvedBeach.terrain_method !== 'string') {
    throw new Error(
      `Approval proposed JSON terrain config for ${approvedBeach.id} must include terrain_method.`
    )
  }
  if (
    typeof approvedBeach.terrain_params_hash !== 'string' ||
    approvedBeach.terrain_params_hash.length === 0
  ) {
    throw new Error(
      `Approval proposed JSON terrain config for ${approvedBeach.id} ` +
        'must include terrain_params_hash.'
    )
  }
  if (typeof approvedBeach.terrain_status !== 'string') {
    throw new Error(
      `Approval proposed JSON terrain config for ${approvedBeach.id} must include terrain_status.`
    )
  }
}

function assertApprovedNumberArray({
  label,
  beachId,
  value,
}: {
  label: string
  beachId: string
  value: unknown
}): void {
  if (!Array.isArray(value)) {
    throw new Error(
      `Approval proposed JSON terrain config for ${beachId} must include ${label}.`
    )
  }
  if (value.length !== TERRAIN_FACTOR_BIN_COUNT) {
    throw new Error(
      `Approval proposed JSON ${label} must have ` +
        `${TERRAIN_FACTOR_BIN_COUNT} bins for ${beachId}. ` +
        `Found ${value.length}.`
    )
  }
  for (let index = 0; index < value.length; index++) {
    const factor = value[index]
    if (
      typeof factor !== 'number' ||
      !Number.isFinite(factor) ||
      factor < 0 ||
      factor > 1
    ) {
      throw new Error(
        `Approval proposed JSON ${label} has invalid value for ${beachId} at index ${index}.`
      )
    }
  }
}

function assertTerrainBeachMatchesApprovedConfig({
  approvedBeach,
  result,
  terrainMethod,
}: {
  approvedBeach: ApprovedTerrainBeachConfig
  result: BeachAnalysisResult
  terrainMethod: string
}): void {
  const approvedTerrainMethod = approvedBeach.terrain_method
  if (
    typeof approvedTerrainMethod === 'string' &&
    approvedTerrainMethod !== terrainMethod
  ) {
    throw new Error(
      `Computed terrain method ${terrainMethod} does not match approved method ${approvedTerrainMethod} for ${approvedBeach.id}.`
    )
  }

  if (approvedBeach.terrain_params_hash !== result.terrain_params_hash) {
    throw new Error(
      `Computed terrain params hash does not match approved artifact for ${approvedBeach.id}.`
    )
  }

  const approvedStatus =
    typeof approvedBeach.terrain_status === 'string'
      ? approvedBeach.terrain_status
      : 'ok'
  const resultStatus = result.terrain_status ?? 'ok'
  if (approvedStatus !== resultStatus) {
    throw new Error(
      `Computed terrain status ${resultStatus} does not match approved status ${approvedStatus} for ${approvedBeach.id}.`
    )
  }

  assertNumberArrayMatches({
    label: 'wind_exposure_factors',
    beachId: approvedBeach.id,
    approved: approvedBeach.wind_exposure_factors,
    computed: result.wind_exposure_factors,
  })
  assertNumberArrayMatches({
    label: 'swell_access_factors',
    beachId: approvedBeach.id,
    approved: approvedBeach.swell_access_factors,
    computed: result.swell_access_factors,
  })
}

function assertNumberArrayMatches({
  label,
  beachId,
  approved,
  computed,
}: {
  label: string
  beachId: string
  approved: unknown
  computed: number[] | undefined
}): void {
  if (!Array.isArray(approved) || !Array.isArray(computed)) {
    throw new Error(
      `Computed ${label} does not match approved artifact for ${beachId}.`
    )
  }

  if (
    approved.length !== TERRAIN_FACTOR_BIN_COUNT ||
    computed.length !== TERRAIN_FACTOR_BIN_COUNT
  ) {
    throw new Error(
      `Computed ${label} must have ${TERRAIN_FACTOR_BIN_COUNT} bins for ${beachId}. Approved length: ${approved.length}; computed length: ${computed.length}.`
    )
  }

  for (let index = 0; index < approved.length; index++) {
    if (approved[index] !== computed[index]) {
      throw new Error(
        `Computed ${label} differs from approved artifact for ${beachId} at index ${index}.`
      )
    }
  }
}

function assertSameSet({
  actual,
  expected,
  label,
}: {
  actual: string[]
  expected: string[]
  label: string
}): void {
  const missing = expected.filter((id) => !actual.includes(id))
  const extra = actual.filter((id) => !expected.includes(id))

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${label} must exactly match requested write scope. Missing: ${formatList(missing)}. Extra: ${formatList(extra)}.`
    )
  }
}

function assertNoDuplicateValues({
  values,
  label,
}: {
  values: string[]
  label: string
}): void {
  const duplicates = findDuplicateStrings(values)
  if (duplicates.length > 0) {
    throw new Error(
      `${label} has duplicate beach id(s): ${duplicates.join(', ')}.`
    )
  }
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeUniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  )
}

function findDuplicateStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (!value) {
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

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'none'
}
