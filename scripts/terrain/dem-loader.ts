/**
 * Digital Elevation Model (DEM) Data Loader
 *
 * Loads elevation data from AWS Terrain Tiles (Terrarium format).
 * Uses real data by default, with mock fallback for testing.
 *
 * Environment:
 * - USE_MOCK_TERRAIN=true: Use mock flat terrain (for testing)
 * - Default: Use real AWS Terrain Tiles
 */

import type { TerrainAnalysisParams } from '../../types/terrain'
import * as projection from './projection'

// Check for mock mode
const USE_MOCK = process.env.USE_MOCK_TERRAIN === 'true'

/**
 * DEM tile data structure
 */
export interface DEMTile {
  /** Bounds of the tile in UTM coordinates */
  bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
  /** Resolution in meters */
  resolution: number
  /** UTM zone number */
  utmZone: string
  /** Elevation data as 2D array (null = no data) - not used in real implementation */
  data: (number | null)[][]
  /** Real elevation grid (only present when using real data) */
  _elevationGrid?: ElevationGrid | null
  /** Beach UTM coordinates */
  _beachUTM?: { x: number; y: number; zone: number; hemisphere: 'N' | 'S' }
}

/**
 * Elevation grid from real data
 */
interface ElevationGrid {
  data: Float32Array
  width: number
  height: number
  bounds: {
    north: number
    south: number
    east: number
    west: number
  }
  resolution: number
  coveragePct: number
}

// AWS Terrain Tiles config
const TERRAIN_TILES_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'
const TILE_ZOOM = 12
const TILE_SIZE = 256
const TILE_FETCH_TIMEOUT_MS = 10_000

// Tile cache
const tileCache = new Map<string, Uint8Array>()

export interface TerrainLoadOptions {
  log?: boolean
}

/**
 * Load DEM tile covering beach location and max radius
 */
export async function loadDEMTile(
  latitude: number,
  longitude: number,
  params: TerrainAnalysisParams,
  options: TerrainLoadOptions = {}
): Promise<DEMTile> {
  const shouldLog = options.log !== false
  if (USE_MOCK) {
    if (shouldLog) console.log(`[DEM] Loading DEM tile for (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) with radius ${params.max_radius_m}m`)
    return createMockDEMTile(latitude, longitude, params.max_radius_m)
  }

  if (shouldLog) console.log(`[DEM] Loading real elevation data for (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`)

  // Convert beach location to UTM
  const beachUTM = projection.toUTM(latitude, longitude)

  // Load elevation grid
  const elevationGrid = await loadElevationGrid(
    latitude,
    longitude,
    params.max_radius_m,
    options
  )

  if (!elevationGrid) {
    if (shouldLog) console.warn('[DEM] Failed to load elevation grid, using flat terrain fallback')
  } else if (shouldLog) {
    console.log(`[DEM] Loaded ${elevationGrid.width}x${elevationGrid.height} grid, resolution ~${elevationGrid.resolution.toFixed(1)}m`)
  }

  return {
    bounds: {
      minX: beachUTM.x - params.max_radius_m,
      maxX: beachUTM.x + params.max_radius_m,
      minY: beachUTM.y - params.max_radius_m,
      maxY: beachUTM.y + params.max_radius_m,
    },
    resolution: params.resolution_m,
    utmZone: beachUTM.zoneString,
    data: [],
    _elevationGrid: elevationGrid,
    _beachUTM: {
      x: beachUTM.x,
      y: beachUTM.y,
      zone: beachUTM.zone,
      hemisphere: beachUTM.hemisphere,
    },
  }
}

/**
 * Get elevation at a specific UTM point
 */
export function getElevation(tile: DEMTile, utmX: number, utmY: number): number | null {
  // Check bounds
  if (
    utmX < tile.bounds.minX ||
    utmX > tile.bounds.maxX ||
    utmY < tile.bounds.minY ||
    utmY > tile.bounds.maxY
  ) {
    return null
  }

  // Use real data if available
  if (tile._elevationGrid && tile._beachUTM) {
    const [lon, lat] = projection.fromUTM(utmX, utmY, tile._beachUTM.zone, tile._beachUTM.hemisphere)
    return getElevationFromGrid(tile._elevationGrid, lat, lon)
  }

  // Mock: return flat terrain
  return 0
}

/**
 * Get beach elevation, handling water coordinates
 */
export function getBeachElevation(tile: DEMTile, beachUtmX: number, beachUtmY: number): number {
  const elev = getElevation(tile, beachUtmX, beachUtmY)

  // If over water (negative or null), return sea level
  if (elev === null || elev < 0) {
    return 0
  }

  // Cap at reasonable beach elevation
  return Math.min(elev, 30)
}

/**
 * Convert WGS84 lat/lon to UTM coordinates
 */
export function toUTM(latitude: number, longitude: number): { utmX: number; utmY: number; zone: string } {
  const result = projection.toUTM(latitude, longitude)
  return {
    utmX: result.x,
    utmY: result.y,
    zone: result.zoneString,
  }
}

/**
 * Calculate point at distance and bearing from origin
 */
export function pointAtDistanceAndBearing(
  originUtmX: number,
  originUtmY: number,
  distanceM: number,
  bearingDeg: number
): { utmX: number; utmY: number } {
  const result = projection.pointAtDistanceAndBearing(originUtmX, originUtmY, distanceM, bearingDeg)
  return { utmX: result.x, utmY: result.y }
}

/**
 * Create a mock DEM tile for testing
 */
export function createMockDEMTile(latitude: number, longitude: number, radiusM = 5000): DEMTile {
  const utmResult = projection.toUTM(latitude, longitude)
  return {
    bounds: {
      minX: utmResult.x - radiusM,
      maxX: utmResult.x + radiusM,
      minY: utmResult.y - radiusM,
      maxY: utmResult.y + radiusM,
    },
    resolution: 30,
    utmZone: utmResult.zoneString,
    data: [],
    _beachUTM: {
      x: utmResult.x,
      y: utmResult.y,
      zone: utmResult.zone,
      hemisphere: utmResult.hemisphere,
    },
  }
}

// ============================================================================
// Real DEM Loading Implementation
// ============================================================================

/**
 * Convert lat/lon to tile coordinates
 */
function latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lon + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n)
  return { x, y }
}

/**
 * Get lat/lon bounds for a tile
 */
function tileBounds(tileX: number, tileY: number, zoom: number) {
  const n = Math.pow(2, zoom)
  const west = (tileX / n) * 360 - 180
  const east = ((tileX + 1) / n) * 360 - 180
  const north = (Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / n))) * 180) / Math.PI
  const south = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + 1)) / n))) * 180) / Math.PI
  return { north, south, east, west }
}

/**
 * Fetch and decode a terrain tile
 */
async function fetchTile(
  tileX: number,
  tileY: number,
  zoom: number,
  options: TerrainLoadOptions
): Promise<Uint8Array | null> {
  const cacheKey = `${zoom}/${tileX}/${tileY}`
  if (tileCache.has(cacheKey)) {
    return tileCache.get(cacheKey)!
  }

  const url = `${TERRAIN_TILES_URL}/${zoom}/${tileX}/${tileY}.png`

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TILE_FETCH_TIMEOUT_MS) })
    if (!response.ok) {
      if (options.log !== false) console.warn(`[DEM] Tile fetch failed: ${url} (${response.status})`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const pixels = decodePNG(new Uint8Array(arrayBuffer), options)
    if (pixels) {
      tileCache.set(cacheKey, pixels)
    }
    return pixels
  } catch (error) {
    if (options.log !== false) console.warn(`[DEM] Tile fetch error: ${url}`, error)
    return null
  }
}

/**
 * Decode PNG to RGBA pixels
 */
function decodePNG(pngData: Uint8Array, options: TerrainLoadOptions): Uint8Array | null {
  // Check PNG signature
  if (pngData[0] !== 0x89 || pngData[1] !== 0x50 || pngData[2] !== 0x4E || pngData[3] !== 0x47) {
    return null
  }

  try {
    let offset = 8
    let width = 0
    let height = 0
    const idatChunks: Uint8Array[] = []

    while (offset < pngData.length) {
      const length = (pngData[offset] << 24) | (pngData[offset + 1] << 16) | (pngData[offset + 2] << 8) | pngData[offset + 3]
      const type = String.fromCharCode(pngData[offset + 4], pngData[offset + 5], pngData[offset + 6], pngData[offset + 7])

      if (type === 'IHDR') {
        width = (pngData[offset + 8] << 24) | (pngData[offset + 9] << 16) | (pngData[offset + 10] << 8) | pngData[offset + 11]
        height = (pngData[offset + 12] << 24) | (pngData[offset + 13] << 16) | (pngData[offset + 14] << 8) | pngData[offset + 15]
      } else if (type === 'IDAT') {
        idatChunks.push(pngData.slice(offset + 8, offset + 8 + length))
      } else if (type === 'IEND') {
        break
      }

      offset += 12 + length
    }

    // Concatenate and decompress
    const totalLength = idatChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const compressedData = new Uint8Array(totalLength)
    let pos = 0
    for (const chunk of idatChunks) {
      compressedData.set(chunk, pos)
      pos += chunk.length
    }

    const zlib = require('zlib')
    const decompressed = zlib.inflateSync(Buffer.from(compressedData))

    // Unfilter PNG
    const bytesPerPixel = 3
    const scanlineWidth = width * bytesPerPixel + 1
    const pixels = new Uint8Array(width * height * 4)

    for (let y = 0; y < height; y++) {
      const filterType = decompressed[y * scanlineWidth]
      const rowStart = y * scanlineWidth + 1
      const outRowStart = y * width * 4

      for (let x = 0; x < width; x++) {
        let r = decompressed[rowStart + x * bytesPerPixel]
        let g = decompressed[rowStart + x * bytesPerPixel + 1]
        let b = decompressed[rowStart + x * bytesPerPixel + 2]

        // Apply PNG filters
        if (filterType === 1 && x > 0) {
          r = (r + pixels[outRowStart + (x - 1) * 4]) & 0xff
          g = (g + pixels[outRowStart + (x - 1) * 4 + 1]) & 0xff
          b = (b + pixels[outRowStart + (x - 1) * 4 + 2]) & 0xff
        } else if (filterType === 2 && y > 0) {
          const prevRowStart = (y - 1) * width * 4
          r = (r + pixels[prevRowStart + x * 4]) & 0xff
          g = (g + pixels[prevRowStart + x * 4 + 1]) & 0xff
          b = (b + pixels[prevRowStart + x * 4 + 2]) & 0xff
        } else if (filterType === 3) {
          const left = x > 0 ? pixels[outRowStart + (x - 1) * 4] : 0
          const leftG = x > 0 ? pixels[outRowStart + (x - 1) * 4 + 1] : 0
          const leftB = x > 0 ? pixels[outRowStart + (x - 1) * 4 + 2] : 0
          const up = y > 0 ? pixels[(y - 1) * width * 4 + x * 4] : 0
          const upG = y > 0 ? pixels[(y - 1) * width * 4 + x * 4 + 1] : 0
          const upB = y > 0 ? pixels[(y - 1) * width * 4 + x * 4 + 2] : 0
          r = (r + Math.floor((left + up) / 2)) & 0xff
          g = (g + Math.floor((leftG + upG) / 2)) & 0xff
          b = (b + Math.floor((leftB + upB) / 2)) & 0xff
        } else if (filterType === 4) {
          const a = x > 0 ? pixels[outRowStart + (x - 1) * 4] : 0
          const c = (x > 0 && y > 0) ? pixels[(y - 1) * width * 4 + (x - 1) * 4] : 0
          const bUp = y > 0 ? pixels[(y - 1) * width * 4 + x * 4] : 0
          r = (r + paethPredictor(a, bUp, c)) & 0xff
          const aG = x > 0 ? pixels[outRowStart + (x - 1) * 4 + 1] : 0
          const cG = (x > 0 && y > 0) ? pixels[(y - 1) * width * 4 + (x - 1) * 4 + 1] : 0
          const bUpG = y > 0 ? pixels[(y - 1) * width * 4 + x * 4 + 1] : 0
          g = (g + paethPredictor(aG, bUpG, cG)) & 0xff
          const aB = x > 0 ? pixels[outRowStart + (x - 1) * 4 + 2] : 0
          const cB = (x > 0 && y > 0) ? pixels[(y - 1) * width * 4 + (x - 1) * 4 + 2] : 0
          const bUpB = y > 0 ? pixels[(y - 1) * width * 4 + x * 4 + 2] : 0
          b = (b + paethPredictor(aB, bUpB, cB)) & 0xff
        }

        pixels[outRowStart + x * 4] = r
        pixels[outRowStart + x * 4 + 1] = g
        pixels[outRowStart + x * 4 + 2] = b
        pixels[outRowStart + x * 4 + 3] = 255
      }
    }

    return pixels
  } catch (error) {
    if (options.log !== false) console.warn('[DEM] PNG decode error:', error)
    return null
  }
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/**
 * Terrarium elevation encoding: (r * 256 + g + b / 256) - 32768
 */
function terrariumToElevation(r: number, g: number, b: number): number {
  return (r * 256 + g + b / 256) - 32768
}

/**
 * Load elevation grid for a region
 */
async function loadElevationGrid(
  centerLat: number,
  centerLon: number,
  radiusM: number,
  options: TerrainLoadOptions
): Promise<ElevationGrid | null> {
  const latDelta = radiusM / 111320
  const lonDelta = radiusM / (111320 * Math.cos((centerLat * Math.PI) / 180))

  const north = centerLat + latDelta
  const south = centerLat - latDelta
  const east = centerLon + lonDelta
  const west = centerLon - lonDelta

  const nwTile = latLonToTile(north, west, TILE_ZOOM)
  const seTile = latLonToTile(south, east, TILE_ZOOM)

  const minTileX = Math.min(nwTile.x, seTile.x)
  const maxTileX = Math.max(nwTile.x, seTile.x)
  const minTileY = Math.min(nwTile.y, seTile.y)
  const maxTileY = Math.max(nwTile.y, seTile.y)

  const tilesX = maxTileX - minTileX + 1
  const tilesY = maxTileY - minTileY + 1

  // Fetch tiles
  const tiles: (Uint8Array | null)[][] = []
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    const row: (Uint8Array | null)[] = []
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      row.push(await fetchTile(tx, ty, TILE_ZOOM, options))
    }
    tiles.push(row)
  }

  if (tiles.some((row) => row.some((tile) => tile === null))) {
    if (options.log !== false) console.warn('[DEM] Incomplete tile coverage')
    return null
  }

  const nwBounds = tileBounds(minTileX, minTileY, TILE_ZOOM)
  const seBounds = tileBounds(maxTileX, maxTileY, TILE_ZOOM)

  const gridWidth = tilesX * TILE_SIZE
  const gridHeight = tilesY * TILE_SIZE

  const data = new Float32Array(gridWidth * gridHeight)
  data.fill(-9999)

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const pixels = tiles[ty][tx]
      if (!pixels) continue

      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const pixelIndex = (py * TILE_SIZE + px) * 4
          const r = pixels[pixelIndex]
          const g = pixels[pixelIndex + 1]
          const b = pixels[pixelIndex + 2]

          const elevation = terrariumToElevation(r, g, b)
          const gridX = tx * TILE_SIZE + px
          const gridY = ty * TILE_SIZE + py
          data[gridY * gridWidth + gridX] = elevation
        }
      }
    }
  }

  const latRange = nwBounds.north - seBounds.south
  const resolution = (latRange * 111320) / gridHeight

  return {
    data,
    width: gridWidth,
    height: gridHeight,
    bounds: {
      north: nwBounds.north,
      south: seBounds.south,
      east: seBounds.east,
      west: nwBounds.west,
    },
    resolution,
    coveragePct: 100,
  }
}

/**
 * Get elevation from grid at lat/lon
 */
function getElevationFromGrid(grid: ElevationGrid, lat: number, lon: number): number | null {
  if (lat > grid.bounds.north || lat < grid.bounds.south || lon > grid.bounds.east || lon < grid.bounds.west) {
    return null
  }

  const latFrac = (grid.bounds.north - lat) / (grid.bounds.north - grid.bounds.south)
  const lonFrac = (lon - grid.bounds.west) / (grid.bounds.east - grid.bounds.west)

  const px = Math.floor(lonFrac * grid.width)
  const py = Math.floor(latFrac * grid.height)

  if (px < 0 || px >= grid.width || py < 0 || py >= grid.height) {
    return null
  }

  const elevation = grid.data[py * grid.width + px]
  return elevation === -9999 ? null : elevation
}
