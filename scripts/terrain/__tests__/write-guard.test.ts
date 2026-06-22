import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  assertTerrainResultsMatchApproval,
  assertTerrainWriteApproved,
  TERRAIN_WRITE_HUMAN_APPROVAL_TOKEN,
} from '../write-guard'
import type { BeachAnalysisResult } from '../types'
import type { TerrainAnalysisArgs } from '../types'

const NOW = new Date('2026-06-19T12:00:00.000Z')

describe('terrain write guard', () => {
  it('allows dry runs without approval artifacts', () => {
    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: true,
          force: false,
          missingOnly: true,
        },
        NOW
      )
    ).not.toThrow()
  })

  it('blocks non-dry-run writes without exact beach scope', () => {
    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          region: 'Monterey Bay',
        },
        NOW
      )
    ).toThrow(
      'Terrain writes require exact --beach-id or --beach-ids scope plus approval artifacts.'
    )
  })

  it('blocks exact writes without approval artifacts', () => {
    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
        },
        NOW
      )
    ).toThrow('Terrain writes require --approval-report-json.')
  })

  it('blocks writes when exact requested scope contains duplicate beach ids', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachId: 'beach-1',
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
        },
        NOW
      )
    ).toThrow('Requested terrain write scope has duplicate beach id(s): beach-1.')
  })

  it('blocks valid artifact-backed writes without the explicit human approval token', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
        },
        NOW
      )
    ).toThrow(
      `Terrain writes require --human-approval-token=${TERRAIN_WRITE_HUMAN_APPROVAL_TOKEN} after explicit human approval.`
    )
  })

  it('allows exact writes with a valid non-regressing approval report and human approval token', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
          humanApprovalToken: TERRAIN_WRITE_HUMAN_APPROVAL_TOKEN,
        },
        NOW
      )
    ).not.toThrow()
  })

  it('blocks writes when the proposed artifact lacks a supported schema version', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
      proposedArtifactOverrides: {
        artifact_schema_version: 0,
      },
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
        },
        NOW
      )
    ).toThrow(
      'Terrain write proposed artifact validation failed: Terrain proposed artifact must declare artifact_schema_version 1.'
    )
  })

  it('blocks writes when the approval report lacks a schema version', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
      reportSchemaVersion: null,
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
        },
        NOW
      )
    ).toThrow('Approval report must declare report_schema_version 1.')
  })

  it('blocks approved writes that are not missing-only gap fills', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
        },
        NOW
      )
    ).toThrow('Terrain writes require --missing-only.')
  })

  it('blocks approved writes that force recomputation of existing terrain rows', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: true,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
        },
        NOW
      )
    ).toThrow('Terrain writes cannot use --force with approval artifacts.')
  })

  it('blocks writes when proposed approval scope differs from requested ids', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-2'],
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
        },
        NOW
      )
    ).toThrow(
      'Approval proposed JSON beach scope must exactly match requested write scope.'
    )
  })

  it('blocks writes when the approval report does not pass the Phase 0 gate', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
      deltaMaeM: 0.1,
      verdict: 'regressed',
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
        },
        NOW
      )
    ).toThrow('Terrain write approval failed:')
  })

  it('blocks writes when the approval report lacks horizon-bucket provenance', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
      horizonBucketProvenanceCount: 0,
      missingHorizonBucketProvenanceCount: 75,
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
        },
        NOW
      )
    ).toThrow('Matched 0-72h rows without horizon-bucket provenance 75 exceeds 0.')
  })

  it('blocks writes when the proposed artifact approval policy is stricter than the command', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
      approvalPolicy: {
        min_gate_samples: 100,
        min_slice_samples: 50,
        max_report_age_hours: 12,
      },
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
          minApprovalGateSamples: 75,
          minApprovalSliceSamples: 25,
          maxApprovalReportAgeHours: 24,
        },
        NOW
      )
    ).toThrow(
      'Approval --min-gate-samples 75 is weaker than proposed JSON approval_policy.min_gate_samples 100.'
    )
  })

  it('allows computed terrain results that match the approved proposed artifact', () => {
    const { proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
      includeTerrainConfigs: true,
    })

    expect(() =>
      assertTerrainResultsMatchApproval(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalProposedJsonPath: proposedPath,
        },
        [buildSuccessfulTerrainResult('beach-1')],
        'dem_horizon_v1'
      )
    ).not.toThrow()
  })

  it('blocks terrain writes when computed factors differ from the approved artifact', () => {
    const { proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
      includeTerrainConfigs: true,
    })

    expect(() =>
      assertTerrainResultsMatchApproval(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalProposedJsonPath: proposedPath,
        },
        [
          {
            ...buildSuccessfulTerrainResult('beach-1'),
            swell_access_factors: factors(0.8).map((value, index) =>
              index === 1 ? 0.6 : value
            ),
          },
        ],
        'dem_horizon_v1'
      )
    ).toThrow(
      'Computed swell_access_factors differs from approved artifact for beach-1 at index 1.'
    )
  })

  it('blocks terrain writes when computed results include an unapproved beach', () => {
    const { proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
      includeTerrainConfigs: true,
    })

    expect(() =>
      assertTerrainResultsMatchApproval(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalProposedJsonPath: proposedPath,
        },
        [
          buildSuccessfulTerrainResult('beach-1'),
          buildSuccessfulTerrainResult('beach-2'),
        ],
        'dem_horizon_v1'
      )
    ).toThrow(
      'Computed terrain result scope must exactly match requested write scope. Missing: none. Extra: beach-2.'
    )
  })

  it('blocks terrain writes when approved terrain configs duplicate a beach id', () => {
    const { proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1', 'beach-1'],
      includeTerrainConfigs: true,
    })

    expect(() =>
      assertTerrainResultsMatchApproval(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalProposedJsonPath: proposedPath,
        },
        [buildSuccessfulTerrainResult('beach-1')],
        'dem_horizon_v1'
      )
    ).toThrow(
      'Approval proposed JSON terrain config scope has duplicate beach id(s): beach-1.'
    )
  })

  it('blocks approved writes before compute when terrain configs are incomplete', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
      includeTerrainConfigs: false,
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
        },
        NOW
      )
    ).toThrow(
      'Terrain proposed beach beach-1 must include wind_exposure_factors.'
    )
  })

  it('blocks approved writes before compute when terrain factors are malformed', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
      approvedConfigOverrides: {
        wind_exposure_factors: factors(0.9).map((value, index) =>
          index === 5 ? 1.1 : value
        ),
      },
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
        },
        NOW
      )
    ).toThrow(
      'Terrain proposed beach beach-1 wind_exposure_factors has invalid value at index 5.'
    )
  })

  it('blocks approved writes before compute when proposed terrain status is failed', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
      approvedConfigOverrides: {
        terrain_status: 'failed',
      },
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
        },
        NOW
      )
    ).toThrow('Terrain proposed beach beach-1 terrain_status is invalid.')
  })

  it('blocks terrain writes when recomputation fails for an approved beach', () => {
    const { proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
      includeTerrainConfigs: true,
    })

    expect(() =>
      assertTerrainResultsMatchApproval(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalProposedJsonPath: proposedPath,
        },
        [
          {
            beach_id: 'beach-1',
            beach_name: 'Beach beach-1',
            success: false,
            error: 'DEM unavailable',
          },
        ],
        'dem_horizon_v1'
      )
    ).toThrow(
      'Approved terrain write computed failed result for beach-1; refusing to write failure status from approved factor artifact.'
    )
  })

  it('blocks terrain writes when the approved proposed artifact lacks terrain configs', () => {
    const { reportPath, proposedPath } = writeApprovalArtifacts({
      beachIds: ['beach-1'],
      includeTerrainConfigs: false,
    })

    expect(() =>
      assertTerrainWriteApproved(
        {
          dryRun: false,
          force: false,
          missingOnly: true,
          beachIds: ['beach-1'],
          approvalReportJsonPath: reportPath,
          approvalProposedJsonPath: proposedPath,
        },
        NOW
      )
    ).toThrow(
      'Terrain proposed beach beach-1 must include wind_exposure_factors.'
    )
  })
})

function writeApprovalArtifacts({
  beachIds,
  deltaMaeM = -0.1,
  verdict = 'non-regressing',
  includeTerrainConfigs = true,
  approvedConfigOverrides = {},
  approvalPolicy,
  proposedArtifactOverrides = {},
  horizonBucketProvenanceCount = 75,
  missingHorizonBucketProvenanceCount = 0,
  reportSchemaVersion,
}: {
  beachIds: string[]
  deltaMaeM?: number
  verdict?: 'non-regressing' | 'regressed'
  includeTerrainConfigs?: boolean
  approvedConfigOverrides?: Record<string, unknown>
  approvalPolicy?: Partial<{
    min_gate_samples: number
    min_slice_samples: number
    max_report_age_hours: number
  }>
  proposedArtifactOverrides?: Record<string, unknown>
  horizonBucketProvenanceCount?: number
  missingHorizonBucketProvenanceCount?: number
  reportSchemaVersion?: number | null
}): { reportPath: string; proposedPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'terrain-write-guard-'))
  const proposedPath = join(dir, 'proposed.json')
  const reportPath = join(dir, 'report.json')

  writeFileSync(
    proposedPath,
    JSON.stringify({
      ...{
        artifact_schema_version: 1,
        generated_at: NOW.toISOString(),
        terrain_method: 'dem_horizon_v1',
        approval_policy: {
          status: 'phase0_required',
          production_write_allowed: false,
          requires_phase0_approval: true,
          required_gate: '0-72h',
          required_metric: 'face_height_mae',
          required_validator: 'forecast-accuracy-report-validate --approval',
          min_gate_samples: 75,
          min_slice_samples: 25,
          max_report_age_hours: 24,
          ...approvalPolicy,
        },
        filters: {
          beachIds,
          missingOnly: true,
          force: false,
        },
        summary: {
          total_beaches: beachIds.length,
          successful: beachIds.length,
          failed: 0,
          skipped: 0,
          total_time_ms: beachIds.length * 1000,
          avg_time_per_beach_ms: beachIds.length > 0 ? 1000 : 0,
        },
        beaches: beachIds.map((id) =>
          includeTerrainConfigs
            ? {
                ...buildApprovedTerrainConfig(id),
                ...approvedConfigOverrides,
              }
            : { id }
        ),
        failures: [],
      },
      ...proposedArtifactOverrides,
    })
  )
  writeFileSync(
    reportPath,
    JSON.stringify(
      buildApprovalReport({
        beachIds,
        proposedPath,
        deltaMaeM,
        verdict,
        horizonBucketProvenanceCount,
        missingHorizonBucketProvenanceCount,
        reportSchemaVersion,
      })
    )
  )

  return { reportPath, proposedPath }
}

function buildApprovedTerrainConfig(id: string): Record<string, unknown> {
  return {
    id,
    name: `Beach ${id}`,
    wind_exposure_factors: factors(0.9),
    swell_access_factors: factors(0.8),
    terrain_method: 'dem_horizon_v1',
    terrain_params: { version: 1 },
    terrain_params_hash: 'params-hash',
    terrain_status: 'ok',
  }
}

function buildSuccessfulTerrainResult(id: string): BeachAnalysisResult {
  return {
    beach_id: id,
    beach_name: `Beach ${id}`,
    success: true,
    wind_exposure_factors: factors(0.9),
    swell_access_factors: factors(0.8),
    terrain_params_hash: 'params-hash',
    terrain_status: 'ok',
  }
}

function factors(value: number): number[] {
  return Array.from({ length: 72 }, () => value)
}

function buildApprovalReport({
  beachIds,
  proposedPath,
  deltaMaeM,
  verdict,
  horizonBucketProvenanceCount,
  missingHorizonBucketProvenanceCount,
  reportSchemaVersion = 1,
}: {
  beachIds: string[]
  proposedPath: string
  deltaMaeM: number
  verdict: 'non-regressing' | 'regressed'
  horizonBucketProvenanceCount: number
  missingHorizonBucketProvenanceCount: number
  reportSchemaVersion?: number | null
}): Record<string, unknown> {
  const sliceSampleCounts = distributeSampleCounts(75, beachIds.length)

  return {
    ...(reportSchemaVersion == null
      ? {}
      : { report_schema_version: reportSchemaVersion }),
    generated_at: NOW.toISOString(),
    range: {
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-19T00:00:00.000Z',
    },
    truth_source: 'buoy',
    truth_contract: {
      observed_field: 'observed_m',
      truth_quantity: 'breaking_face_height_m',
      metric: 'mae_m',
    },
    measurement_contract: {
      proposed_delta_method: 'row-paired',
      comparison_baseline: 'current_display',
      candidate_baseline: 'proposed_display',
      gate_horizon: '0-72h',
    },
    proposed_json_path: proposedPath,
    proposed_json_sha256: sha256File(proposedPath),
    approval_gates: {
      fail_on_regression: true,
      fail_on_slice_regression: true,
      fail_on_unmeasured_slices: true,
      min_gate_samples: 75,
      min_slice_samples: 25,
    },
    scope: {
      beach_count: beachIds.length,
      beach_ids: beachIds,
    },
    row_counts: {
      matched_prediction_rows: 75,
      matched_0_72h_rows: 75,
      matched_0_72h_rows_with_horizon_bucket_provenance:
        horizonBucketProvenanceCount,
      matched_0_72h_rows_without_horizon_bucket_provenance:
        missingHorizonBucketProvenanceCount,
      matched_0_72h_rows_with_replay_provenance: 75,
      matched_0_72h_rows_without_replay_provenance: 0,
      proposed_rows_compared: 75,
      rows_without_proposed_value: 0,
    },
    proposed_gate_verdict: {
      verdict,
      shouldFail: verdict === 'regressed',
      delta: {
        horizon_group: '0-72h',
        baseline: 'proposed_display',
        sample_count: 75,
        comparison_sample_count: 75,
        mae_m: 0.1,
        comparison_mae_m: 0.2,
        delta_mae_m: deltaMaeM,
      },
    },
    gate_slices: {
      group_by: 'beach',
      items: beachIds.map((id, index) => ({
        groupKey: id,
        group: `Beach ${id}`,
        proposedCount: sliceSampleCounts[index],
        currentCount: sliceSampleCounts[index],
        proposedMaeM: 0.1,
        currentMaeM: 0.2,
        deltaMaeM,
        verdict,
      })),
      verdict: {
        regressedSlices:
          verdict === 'regressed'
            ? beachIds.map((id, index) => ({
                groupKey: id,
                group: `Beach ${id}`,
                proposedCount: sliceSampleCounts[index],
                currentCount: sliceSampleCounts[index],
                proposedMaeM: 0.3,
                currentMaeM: 0.2,
                deltaMaeM,
                verdict,
              }))
            : [],
        shouldFail: verdict === 'regressed',
      },
      coverage: {
        unmeasuredGroups: [],
        shouldFail: false,
      },
    },
  }
}

function distributeSampleCounts(total: number, sliceCount: number): number[] {
  if (sliceCount <= 0) {
    return []
  }
  const baseCount = Math.floor(total / sliceCount)
  const remainder = total % sliceCount
  return Array.from(
    { length: sliceCount },
    (_, index) => baseCount + (index < remainder ? 1 : 0)
  )
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}
