export const WATCH_CONTRACT = {
  contractVersion: 1,
  minInWaterSeconds: 300,
  rowColumns: 6,
  maxRowsPerChunk: 300,
  maxChunkCount: 1000,
  waveHeightsFt: [1.5, 2.5, 3.5, 5, 7, 8.5],
  ratingMin: 1,
  ratingMax: 5,
  appVersionHeader: "X-Quiver-App-Version",
  failedUploadStatus: "failed",
} as const;
