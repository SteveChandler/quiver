/**
 * CO-OPS station mappings for major surf locations
 *
 * Maps beach names to their nearest CO-OPS tide station IDs.
 * Station lookup: https://tidesandcurrents.noaa.gov/stations.html
 */

export const COOPS_STATIONS: Record<string, string> = {
  // ==================== WEST COAST ====================

  // San Diego County, CA
  "la-jolla": "9410230",
  "san-diego": "9410170",
  "imperial-beach": "9410170",
  oceanside: "9410230",
  carlsbad: "9410230",
  encinitas: "9410230",
  "del-mar": "9410230",
  "solana-beach": "9410230",
  cardiff: "9410230",
  leucadia: "9410230",
  swamis: "9410230",
  moonlight: "9410230",
  "stone-steps": "9410230",
  grandview: "9410230",
  blacks: "9410230", // DB slug
  "blacks-beach": "9410230", // legacy alias
  windansea: "9410230",
  tourmaline: "9410230",
  "crystal-pier": "9410230",
  "pacific-beach": "9410230",
  "mission-beach": "9410230",
  "ocean-beach": "9410170",
  "sunset-cliffs-garbage": "9410170", // DB slug
  "sunset-cliffs": "9410170", // legacy alias
  coronado: "9410170",
  "silver-strand-state-beach": "9410170", // DB slug
  "silver-strand": "9410170", // legacy alias

  // Orange County, CA
  "huntington-beach": "9410580", // Newport Beach station
  "newport-beach": "9410580",
  "laguna-beach": "9410580",
  "dana-point": "9410580",
  "san-clemente": "9410580",
  trestles: "9410580",

  // Los Angeles County, CA
  "santa-monica": "9410840", // Santa Monica station
  malibu: "9410840",
  "el-porto": "9410840",
  manhattan: "9410840",
  hermosa: "9410840",
  redondo: "9410840",
  "palos-verdes": "9410840",

  // Santa Barbara / Ventura County, CA
  "santa-barbara": "9411340", // Santa Barbara station
  ventura: "9411270", // Ventura station
  rincon: "9411340",

  // Central California
  "santa-cruz": "9413450", // Monterey station
  monterey: "9413450",
  "pismo-beach": "9412110", // Port San Luis station
  "morro-bay": "9412110",

  // Northern California
  "san-francisco": "9414290", // San Francisco station
  pacifica: "9414290",
  "half-moon-bay": "9414290",
  "ocean-beach-sf": "9414290",
  "moonstone-beach-/-little-river": "9419059",
  "houda-point-/-camel-rock": "9419059",
  "trinidad-state-beach": "9419059",
  "samoa-dunes-surf-area": "9418767",
  "college-cove": "9419059",
  "clam-beach": "9419059",

  // ==================== PACIFIC NORTHWEST ====================

  // Oregon
  astoria: "9439040", // Astoria station
  "cannon-beach": "9439040",
  seaside: "9439040",
  "pacific-city": "9435380", // South Beach station
  lincoln: "9435380",
  newport: "9435380",
  florence: "9432780", // Charleston, OR station
  coos: "9432780",
  "charleston-or": "9432780", // Charleston, Oregon
  brookings: "9430104", // Crescent City, CA (closest to southern OR)
  "gold-beach": "9430104",
  bandon: "9432780",

  // Washington
  westport: "9441102", // Westport station
  "long-beach": "9440910", // Toke Point station
  "ocean-shores": "9441102",
  "la-push": "9442396", // Neah Bay station

  // ==================== HAWAII ====================

  // Oahu
  pipeline: "1612340", // Honolulu station
  "north-shore": "1612340",
  waikiki: "1612340",
  "diamond-head": "1612340",
  "sandy-beach": "1612340",
  "waimea-bay": "1612340",
  sunset: "1612340",
  haleiwa: "1612340",

  // Maui
  lahaina: "1615680", // Kahului station
  hookipa: "1615680",
  honolua: "1615680",

  // Big Island
  kona: "1617433", // Kawaihae station
  hilo: "1617760", // Hilo station
  waikoloa: "1617433",

  // Kauai
  hanalei: "1611400", // Nawiliwili station
  poipu: "1611400",

  // ==================== EAST COAST ====================

  // New York
  rockaway: "8531680", // Sandy Hook, NJ (closest to Rockaway)
  "long-beach-ny": "8531680",
  montauk: "8510560", // Montauk station
  "fire-island": "8531680",

  // New Jersey
  "sandy-hook": "8531680", // Sandy Hook station
  "asbury-park": "8534720", // Atlantic City station
  belmar: "8534720",
  manasquan: "8534720",
  "seaside-heights": "8534720",
  "long-beach-island": "8534720",
  "ocean-city-nj": "8534720",
  "cape-may": "8536110", // Cape May station

  // Delaware / Maryland
  rehoboth: "8557380", // Lewes station
  "ocean-city-md": "8570283", // Ocean City Inlet station
  assateague: "8570283",

  // Virginia
  "assateague-beach-(virginia)": "8630413",
  "north-end": "8639208",
  "virginia-beach": "8639208",
  "virginia-beach-pier": "8639208",
  "1st-street-jetty": "8639208",
  "croatan-jetty": "8639208",
  "croatan-beach": "8639208",
  "camp-pendleton": "8639208",
  sandbridge: "8639428",
  "sandbridge-beach": "8639428",
  "s-turn": "8639428",
  "little-island-fishing-pier": "8639428",

  // North Carolina - Outer Banks
  "cape-hatteras": "8652587", // Oregon Inlet station
  "kill-devil-hills": "8651370", // Duck station
  "nags-head": "8651370",
  buxton: "8652587",
  rodanthe: "8652587",

  // North Carolina - South
  "wrightsville-beach": "8658120", // Wrightsville Beach station
  "carolina-beach": "8658163", // Wilmington station
  topsail: "8658163",

  // South Carolina
  "myrtle-beach": "8661070", // Springmaid Pier station
  "folly-beach": "8665530", // Charleston, SC station
  "charleston-sc": "8665530", // Charleston, South Carolina
  "hilton-head": "8670870", // Fort Pulaski station

  // Georgia
  "tybee-island": "8670870", // Fort Pulaski station
  jekyll: "8677344", // Kings Bay station

  // Florida - Atlantic
  "jacksonville-beach": "8720218", // Mayport station
  "st-augustine": "8720587", // St. Augustine Beach station
  "flagler-beach": "8721604", // Ponce Inlet station
  "new-smyrna": "8721604",
  "cocoa-beach": "8721604",
  "sebastian-inlet": "8722670", // Lake Worth Pier station
  jupiter: "8722670",
  "palm-beach": "8722670",
  deerfield: "8723214", // Virginia Key station
  pompano: "8723214",
  "fort-lauderdale": "8723214",
  "miami-beach": "8723214",

  // Florida - Gulf Coast
  "st-pete-beach": "8726520", // St. Petersburg station
  clearwater: "8726520",
  "indian-rocks": "8726520",
  "cocoa-beach-gulf": "8726520",
  naples: "8725110", // Naples station
  "marco-island": "8725110",

  // Florida Keys
  "key-west": "8724580", // Key West station

  // ==================== GULF COAST ====================

  // Texas
  galveston: "8771450", // Galveston Pier 21 station
  "south-padre": "8779770", // Port Isabel station
  "port-aransas": "8775241", // Aransas Pass station

  // ==================== NEW ENGLAND ====================

  // Rhode Island
  "rhode-island": "8452660", // Newport, RI station
  narragansett: "8452660",
  "newport-ri": "8452660",
  "block-island": "8452660",

  // Massachusetts
  "cape-cod": "8447930", // Woods Hole station
  nantucket: "8449130", // Nantucket Island station
  "marthas-vineyard": "8447930",
  hull: "8443970", // Boston station
  gloucester: "8443970",

  // New Hampshire / Maine
  "hampton-beach": "8423898", // Fort Point station
  "york-beach": "8418150", // Portland station
  "old-orchard": "8418150",
  "higgins-beach": "8418150",
  portland: "8418150",

  // ==================== CARIBBEAN ====================

  // Puerto Rico
  "rincon-pr": "9759394", // Mayaguez station
  aguadilla: "9759394",
  "san-juan": "9755371", // San Juan station
  "tres-palmas": "9759394", // Mayaguez station
  "the-point-at-sandy": "9759394", // Mayaguez station
  "surfer's-beach": "9759394", // Mayaguez station

  // ==================== GULF COAST (additional) ====================

  // Texas - additional beaches
  "surfside-beach": "8771450", // Galveston Pier 21 station
};
