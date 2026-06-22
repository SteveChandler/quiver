#!/usr/bin/env tsx
import {
  buildTerrainProposedSubsetExport,
  loadTerrainProposedExport,
  validateTerrainProposedExportArtifact,
  writeTerrainProposedExport,
} from './terrain/proposed-export'

interface CliOptions {
  inputJsonPath: string
  outputJsonPath: string
  beachIds: string[]
}

function parseCliArgs(argv: string[]): CliOptions {
  let inputJsonPath = ''
  let outputJsonPath = ''
  const beachIds: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--input-json') {
      inputJsonPath = readFlagValue(next, '--input-json')
      i++
      continue
    }
    if (arg.startsWith('--input-json=')) {
      inputJsonPath = readFlagValue(arg.split('=')[1], '--input-json')
      continue
    }
    if (arg === '--output-json') {
      outputJsonPath = readFlagValue(next, '--output-json')
      i++
      continue
    }
    if (arg.startsWith('--output-json=')) {
      outputJsonPath = readFlagValue(arg.split('=')[1], '--output-json')
      continue
    }
    if (arg === '--beach-id' || arg === '--beach-ids') {
      beachIds.push(...splitList(readFlagValue(next, arg)))
      i++
      continue
    }
    if (arg.startsWith('--beach-id=')) {
      beachIds.push(
        ...splitList(readFlagValue(arg.split('=')[1], '--beach-id'))
      )
      continue
    }
    if (arg.startsWith('--beach-ids=')) {
      beachIds.push(
        ...splitList(readFlagValue(arg.split('=')[1], '--beach-ids'))
      )
      continue
    }
    if (arg === '--help') {
      printUsage()
      process.exit(0)
    }
    throw new Error(`Unknown argument: ${arg}.`)
  }

  if (!inputJsonPath) {
    throw new Error('Missing --input-json')
  }
  if (!outputJsonPath) {
    throw new Error('Missing --output-json')
  }
  if (beachIds.length === 0) {
    throw new Error('Missing --beach-ids')
  }
  const duplicateBeachIds = findDuplicateStrings(beachIds)
  if (duplicateBeachIds.length > 0) {
    throw new Error(
      `Duplicate selected beach id(s): ${duplicateBeachIds.join(', ')}.`
    )
  }

  return {
    inputJsonPath,
    outputJsonPath,
    beachIds,
  }
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function readFlagValue(value: string | undefined, flagName: string): string {
  if (!value || value.startsWith('--')) {
    throw new Error(`${flagName} requires a value.`)
  }
  return value
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

function printUsage(): void {
  console.log(`Usage:
  yarn tsx scripts/terrain-filter-proposed-export.ts --input-json /tmp/full.json --output-json /tmp/subset.json --beach-ids id-1,id-2`)
}

function main(): void {
  const options = parseCliArgs(process.argv.slice(2))
  const proposedExport = loadTerrainProposedExport(options.inputJsonPath)
  const validationResult = validateTerrainProposedExportArtifact(proposedExport)
  if (!validationResult.ok) {
    throw new Error(validationResult.findings.join('\n'))
  }
  const subsetExport = buildTerrainProposedSubsetExport(
    proposedExport,
    options.beachIds
  )

  if (subsetExport.beaches.length !== options.beachIds.length) {
    const selectedIds = new Set(subsetExport.beaches.map((beach) => beach.id))
    const missingIds = options.beachIds.filter((id) => !selectedIds.has(id))
    throw new Error(`Missing selected beach ids in input export: ${missingIds.join(', ')}`)
  }

  const outputPath = writeTerrainProposedExport(
    options.outputJsonPath,
    subsetExport
  )

  console.log(
    `Wrote ${subsetExport.beaches.length} proposed beach config(s) to ${outputPath}`
  )
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

export { parseCliArgs }
