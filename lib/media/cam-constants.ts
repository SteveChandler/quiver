/** Regex to find HLS stream URL in HDOnTap embed pages */
export const HDONTAP_HLS_RE =
  /https?:\/\/live\.hdontap\.com\/hls\/[^"'\\\s]+\.m3u8[^"'\\\s]*/;

/** Regex to find HDRelay player ID in page HTML (e.g. HDRelay.create({target:'x',id:'uuid'})) */
export const HDRELAY_PLAYER_RE = /HDRelay\.create\(\{[^}]*id\s*:\s*['"]([0-9a-fA-F-]+)['"]/;
