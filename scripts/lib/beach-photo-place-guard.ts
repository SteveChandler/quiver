/**
 * Openverse keyword search attached a Venice Beach street photo to Blacks
 * Beach: the "Blacks Beach" query matched "Black and white ... photography"
 * titles. This rejects a photo whose title names a place other than the target.
 *
 * A named catalog beach or city passes when it is in the target's city or
 * within NEARBY_KM of it (catalog cities are uneven: Monastery Beach sits inside
 * Carmel River State Beach under another city); a named region passes only
 * when it is the target's region. A title placed in another state fails. An
 * unknown "X Beach" fails when the title never names the target, its city or
 * its region.
 */

export interface PlaceCatalogEntry {
  name: string;
  city?: string | null;
  state?: string | null;
  region?: string | null;
  lat?: number | null;
  lon?: number | null;
}

type PlaceKind = "beach" | "city" | "region";

interface Place {
  kind: PlaceKind;
  city: string;
  region: string;
  state: string | null;
  lat: number | null;
  lon: number | null;
}

const NEARBY_KM = 15;

const STATE_CODES: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI",
  Wyoming: "WY", "Puerto Rico": "PR", "Baja California": "BC",
  "Baja California Sur": "BCS",
};

const POSTAL_CODES = new Set(
  Object.values(STATE_CODES).filter((code) => code.length === 2),
);

const STATE_NAME_PATTERN = new RegExp(
  `\\b(${Object.keys(STATE_CODES)
    .sort((a, b) => b.length - a.length)
    .join("|")})\\b`,
  "g",
);

const POSTAL_PATTERN = /,\s*([A-Z]{2})\b/g;

// Capitalised words directly before "Beach": "Lhok Nga Beach", "Venice Beach".
const NAMED_BEACH_PATTERN =
  /((?:\p{Lu}[\p{L}'’.-]*\s+){1,3})(?:[Ss]tate\s+)?[Bb]each\b/gu;

// Words that describe a coast rather than name a place.
const GENERIC_WORDS = new Set([
  "the", "of", "beach", "beaches", "state", "park", "pier", "point", "cove",
  "bay", "inlet", "jetty", "jetties", "reef", "shore", "shores", "coast",
  "harbor", "island", "isle", "county", "north", "south", "east", "west",
  "central", "end", "first", "second", "main", "street", "big", "little",
  "ocean", "pacific", "atlantic", "blue", "white", "black", "red", "green",
  "gold", "golden", "silver", "gray", "grey",
]);

// Single-word catalog cities that are also ordinary words or first names.
const COMMON_WORDS = new Set(["seaside", "marina", "shirley", "florence"]);

const STATE_NAMES = Object.keys(STATE_CODES).map(normalize);
const STATE_TOKENS = new Set(STATE_NAMES.flatMap((name) => name.split(" ")));

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ʻ’'`]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stateCode(state: string | null | undefined): string | null {
  if (!state) return null;
  const trimmed = state.trim();
  if (POSTAL_CODES.has(trimmed.toUpperCase())) return trimmed.toUpperCase();
  return STATE_CODES[trimmed] ?? null;
}

// "Oceano / Grover Beach" also answers to "Oceano" and "Grover Beach".
function variants(value: string | null | undefined): string[] {
  if (!value) return [];
  const parts = value.split(/\s*(?:[()/,]|–|—)\s*/);
  return [...new Set([value, ...parts].map(normalize).filter(Boolean))];
}

function isNamingPhrase(phrase: string, kind: PlaceKind): boolean {
  const tokens = phrase.split(" ");
  if (tokens.every((token) => GENERIC_WORDS.has(token))) return false;
  // State-level mentions are the state rule's job: "Maine Coast" is a region,
  // and "Carolina" is a Puerto Rico city as well as half a state.
  if (kind === "region" && STATE_NAMES.some((name) => containsPhrase(phrase, name))) {
    return false;
  }
  if (tokens.length > 1) return true;
  const [word] = tokens;
  return (
    kind !== "beach" &&
    word.length >= 5 &&
    !COMMON_WORDS.has(word) &&
    !STATE_TOKENS.has(word)
  );
}

function buildGazetteer(
  catalog: readonly PlaceCatalogEntry[],
): Map<string, Place[]> {
  const gazetteer = new Map<string, Place[]>();
  for (const entry of catalog) {
    const place = {
      city: normalize(entry.city ?? ""),
      region: normalize(entry.region ?? ""),
      state: stateCode(entry.state),
      lat: entry.lat ?? null,
      lon: entry.lon ?? null,
    };
    const named: Array<[PlaceKind, string | null | undefined]> = [
      ["beach", entry.name],
      ["city", entry.city],
      ["region", entry.region],
    ];
    for (const [kind, value] of named) {
      for (const phrase of variants(value)) {
        if (!isNamingPhrase(phrase, kind)) continue;
        const places = gazetteer.get(phrase) ?? [];
        places.push({ kind, ...place });
        gazetteer.set(phrase, places);
      }
    }
  }
  return gazetteer;
}

function containsPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

function distanceKm(
  a: { lat?: number | null; lon?: number | null },
  b: { lat?: number | null; lon?: number | null },
): number | null {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function findPhotoPlaceConflict(
  title: string | null | undefined,
  target: PlaceCatalogEntry,
  catalog: readonly PlaceCatalogEntry[] = [],
): string | null {
  if (!title?.trim()) return null;

  const targetCity = normalize(target.city ?? "");
  const targetRegion = normalize(target.region ?? "");
  const targetState = stateCode(target.state);
  const ownNames = [...variants(target.name), ...variants(target.city)];
  const isHome = (place: Place): boolean => {
    if (targetState && place.state && place.state !== targetState) return false;
    if (place.kind === "region") {
      return Boolean(targetRegion) && place.region === targetRegion;
    }
    if (targetCity && place.city === targetCity) return true;
    const km = distanceKm(target, place);
    return km != null && km <= NEARBY_KM;
  };

  // Longest first, masking each match, so "Del Mar" inside "Corona del Mar"
  // is read once, as Corona del Mar.
  const gazetteer = buildGazetteer(catalog);
  const phrases = [...gazetteer.keys()].sort((a, b) => b.length - a.length);
  const matched = new Set<string>();
  let text = ` ${normalize(title)} `;
  for (const phrase of phrases) {
    const needle = ` ${phrase} `;
    if (!text.includes(needle)) continue;
    text = text.split(needle).join(" | ");
    matched.add(phrase);
    if (ownNames.some((own) => containsPhrase(own, phrase))) continue;
    if (gazetteer.get(phrase)?.some(isHome)) continue;
    return phrase;
  }

  if (targetState) {
    for (const match of title.matchAll(STATE_NAME_PATTERN)) {
      if (STATE_CODES[match[1]] !== targetState) return normalize(match[1]);
    }
    for (const match of title.matchAll(POSTAL_PATTERN)) {
      if (POSTAL_CODES.has(match[1]) && match[1] !== targetState) {
        return normalize(match[1]);
      }
    }
  }

  const normalizedTitle = normalize(title);
  const anchors = [
    ...variants(target.name),
    ...variants(target.city),
    ...variants(target.region),
  ]
    .flatMap((phrase) => phrase.split(" "))
    .filter((token) => token.length >= 4 && !GENERIC_WORDS.has(token));
  if (anchors.some((anchor) => containsPhrase(normalizedTitle, anchor))) {
    return null;
  }
  for (const match of title.matchAll(NAMED_BEACH_PATTERN)) {
    const name = normalize(match[1]);
    const beach = normalize(match[0]);
    if (name.split(" ").every((token) => GENERIC_WORDS.has(token))) continue;
    if (matched.has(name) || matched.has(beach)) continue;
    return beach;
  }

  return null;
}
