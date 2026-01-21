/**
 * Real DEM Loader using AWS Terrain Tiles
 *
 * Fetches elevation data from AWS-hosted Terrarium tiles (free, no API key).
 * Terrarium format: elevation = (red * 256 + green + blue / 256) - 32768
 *
 * Tile URL pattern: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
 */

import { toUTM, pointAtDistanceAndBearing, fromUTM } from './projection'
import type { TerrainAnalysisParams } from '../../types/terrain'
import type { DEMTile } from './dem-loader'

// AWS Terrain Tiles base URL
const TERRAIN_TILES_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'

// Zoom level for terrain tiles (12 gives ~38m resolution at equator)
const TILE_ZOOM = 12
const TILE_SIZE = 256

// In-memory cache for tiles
const tileCache = new Map<string, Uint8Array>()

/**
 * Convert lat/lon to tile coordinates at given zoom level
 */
function latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lon + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n)
  return { x, y }
}

/**
 * Convert tile coordinates to lat/lon bounds
 */
function tileBounds(tileX: number, tileY: number, zoom: number): {
  north: number
  south: number
  east: number
  west: number
} {
  const n = Math.pow(2, zoom)
  const west = (tileX / n) * 360 - 180
  const east = ((tileX + 1) / n) * 360 - 180
  const north = (Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / n))) * 180) / Math.PI
  const south = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + 1)) / n))) * 180) / Math.PI
  return { north, south, east, west }
}

/**
 * Fetch a terrain tile PNG and return raw pixel data
 */
async function fetchTile(tileX: number, tileY: number, zoom: number): Promise<Uint8Array | null> {
  const cacheKey = `${zoom}/${tileX}/${tileY}`

  // Check cache
  if (tileCache.has(cacheKey)) {
    return tileCache.get(cacheKey)!
  }

  const url = `${TERRAIN_TILES_URL}/${zoom}/${tileX}/${tileY}.png`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`[DEM] Failed to fetch tile ${cacheKey}: ${response.status}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const pngData = new Uint8Array(arrayBuffer)

    // Parse PNG to get raw RGBA pixels
    const pixels = decodePNG(pngData)
    if (pixels) {
      tileCache.set(cacheKey, pixels)
    }

    return pixels
  } catch (error) {
    console.warn(`[DEM] Error fetching tile ${cacheKey}:`, error)
    return null
  }
}

/**
 * Simple PNG decoder for Terrarium tiles
 * Returns RGBA pixel data as Uint8Array
 */
function decodePNG(pngData: Uint8Array): Uint8Array | null {
  // PNG signature check
  if (
    pngData[0] !== 0x89 ||
    pngData[1] !== 0x50 ||
    pngData[2] !== 0x4E ||
    pngData[3] !== 0x47
  ) {
    console.warn('[DEM] Invalid PNG signature')
    return null
  }

  // For simplicity, we'll use a basic approach:
  // Extract IDAT chunks and decompress using pako (if available) or native DecompressionStream
  // This is a simplified decoder that works for the Terrarium tiles

  try {
    // Find IHDR chunk to get dimensions
    let offset = 8 // Skip PNG signature
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

      offset += 12 + length // 4 length + 4 type + data + 4 CRC
    }

    if (width !== TILE_SIZE || height !== TILE_SIZE) {
      console.warn(`[DEM] Unexpected tile dimensions: ${width}x${height}`)
    }

    // Concatenate IDAT chunks
    const totalLength = idatChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const compressedData = new Uint8Array(totalLength)
    let pos = 0
    for (const chunk of idatChunks) {
      compressedData.set(chunk, pos)
      pos += chunk.length
    }

    // Decompress using native zlib (Node.js)
    const zlib = require('zlib')
    const decompressed = zlib.inflateSync(Buffer.from(compressedData))

    // Unfilter PNG rows (simplified - assumes filter type 0 or handles basic filters)
    const bytesPerPixel = 3 // RGB
    const scanlineWidth = width * bytesPerPixel + 1 // +1 for filter byte
    const pixels = new Uint8Array(width * height * 4) // RGBA output

    for (let y = 0; y < height; y++) {
      const filterType = decompressed[y * scanlineWidth]
      const rowStart = y * scanlineWidth + 1
      const outRowStart = y * width * 4

      for (let x = 0; x < width; x++) {
        let r = decompressed[rowStart + x * bytesPerPixel]
        let g = decompressed[rowStart + x * bytesPerPixel + 1]
        let b = decompressed[rowStart + x * bytesPerPixel + 2]

        // Apply PNG filter
        if (filterType === 1 && x > 0) {
          // Sub filter
          r = (r + pixels[outRowStart + (x - 1) * 4]) & 0xff
          g = (g + pixels[outRowStart + (x - 1) * 4 + 1]) & 0xff
          b = (b + pixels[outRowStart + (x - 1) * 4 + 2]) & 0xff
        } else if (filterType === 2 && y > 0) {
          // Up filter
          const prevRowStart = (y - 1) * width * 4
          r = (r + pixels[prevRowStart + x * 4]) & 0xff
          g = (g + pixels[prevRowStart + x * 4 + 1]) & 0xff
          b = (b + pixels[prevRowStart + x * 4 + 2]) & 0xff
        } else if (filterType === 3) {
          // Average filter
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
          // Paeth filter
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
        pixels[outRowStart + x * 4 + 3] = 255 // Alpha
      }
    }

    return pixels
  } catch (error) {
    console.warn('[DEM] PNG decode error:', error)
    return null
  }
}

/**
 * Paeth predictor for PNG filtering
 */
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
 * Get elevation from Terrarium-encoded RGB values
 * Formula: elevation = (red * 256 + green + blue / 256) - 32768
 */
function terrariumToElevation(r: number, g: number, b: number): number {
  return (r * 256 + g + b / 256) - 32768
}

/**
 * Elevation data structure for a region
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
  resolution: number // meters per pixel (approximate)
}

/**
 * Load elevation data for a region
 */
async function loadElevationGrid(
  centerLat: number,
  centerLon: number,
  radiusM: number
): Promise<ElevationGrid | null> {
  // Calculate rough lat/lon bounds (approximate for small areas)
  const latDelta = radiusM / 111320 // ~111km per degree latitude
  const lonDelta = radiusM / (111320 * Math.cos((centerLat * Math.PI) / 180))

  const north = centerLat + latDelta
  const south = centerLat - latDelta
  const east = centerLon + lonDelta
  const west = centerLon - lonDelta

  // Get tiles needed to cover this area
  const nwTile = latLonToTile(north, west, TILE_ZOOM)
  const seTile = latLonToTile(south, east, TILE_ZOOM)

  const minTileX = Math.min(nwTile.x, seTile.x)
  const maxTileX = Math.max(nwTile.x, seTile.x)
  const minTileY = Math.min(nwTile.y, seTile.y)
  const maxTileY = Math.max(nwTile.y, seTile.y)

  const tilesX = maxTileX - minTileX + 1
  const tilesY = maxTileY - minTileY + 1

  // Fetch all needed tiles
  const tiles: (Uint8Array | null)[][] = []
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    const row: (Uint8Array | null)[] = []
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      row.push(await fetchTile(tx, ty, TILE_ZOOM))
    }
    tiles.push(row)
  }

  // Calculate combined bounds
  const nwBounds = tileBounds(minTileX, minTileY, TILE_ZOOM)
  const seBounds = tileBounds(maxTileX, maxTileY, TILE_ZOOM)

  const gridWidth = tilesX * TILE_SIZE
  const gridHeight = tilesY * TILE_SIZE

  // Create combined elevation grid
  const data = new Float32Array(gridWidth * gridHeight)
  data.fill(-9999) // No-data value

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

  // Calculate approximate resolution in meters
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
  }
}

/**
 * Get elevation at a lat/lon point from the grid
 */
function getElevationFromGrid(
  grid: ElevationGrid,
  lat: number,
  lon: number
): number | null {
  // Check bounds
  if (
    lat > grid.bounds.north ||
    lat < grid.bounds.south ||
    lon > grid.bounds.east ||
    lon < grid.bounds.west
  ) {
    return null
  }

  // Calculate pixel position
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

/**
 * Load DEM tile for terrain analysis
 *
 * @param latitude Beach latitude (WGS84)
 * @param longitude Beach longitude (WGS84)
 * @param params Analysis parameters
 * @returns DEM tile in UTM coordinates with elevation lookup
 */
export async function loadRealDEMTile(
  latitude: number,
  longitude: number,
  params: TerrainAnalysisParams
): Promise<DEMTile & { elevationGrid: ElevationGrid | null; beachUTM: { x: number; y: number; zone: number; hemisphere: 'N' | 'S' } }> {
  console.log(`[DEM] Loading real elevation data for (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`)

  // Convert beach location to UTM
  const beachUTM = toUTM(latitude, longitude)

  // Load elevation grid
  const elevationGrid = await loadElevationGrid(latitude, longitude, params.max_radius_m)

  if (!elevationGrid) {
    console.warn('[DEM] Failed to load elevation grid, using flat terrain fallback')
  } else {
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
    data: [], // Not used - we use elevationGrid instead
    elevationGrid,
    beachUTM: {
      x: beachUTM.x,
      y: beachUTM.y,
      zone: beachUTM.zone,
      hemisphere: beachUTM.hemisphere,
    },
  }
}

/**
 * Get elevation at UTM coordinates using real data
 */
export function getRealElevation(
  tile: DEMTile & { elevationGrid: ElevationGrid | null; beachUTM: { x: number; y: number; zone: number; hemisphere: 'N' | 'S' } },
  utmX: number,
  utmY: number
): number | null {
  if (!tile.elevationGrid) {
    return 0 // Fallback to flat terrain
  }

  // Convert UTM back to lat/lon
  const [lon, lat] = fromUTM(utmX, utmY, tile.beachUTM.zone, tile.beachUTM.hemisphere)

  return getElevationFromGrid(tile.elevationGrid, lat, lon)
}

/**
 * Get beach elevation using real data
 */
export function getRealBeachElevation(
  tile: DEMTile & { elevationGrid: ElevationGrid | null; beachUTM: { x: number; y: number; zone: number; hemisphere: 'N' | 'S' } }
): number {
  const elev = getRealElevation(tile, tile.beachUTM.x, tile.beachUTM.y)

  // If beach is over water (negative elevation), assume sea level
  if (elev === null || elev < 0) {
    return 0
  }

  // Beach should be near sea level, cap at reasonable max
  return Math.min(elev, 30)
}

// Export for testing
export { loadElevationGrid, getElevationFromGrid, terrariumToElevation }
