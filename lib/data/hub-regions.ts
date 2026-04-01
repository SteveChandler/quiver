/**
 * Hub Region Configuration
 *
 * Defines regional hub pages like /guides/surfing-southern-california
 * These aggregate multiple cities/states into surf-focused regional guides
 */

export interface HubRegion {
  slug: string;
  name: string;
  title: string;
  description: string;
  states: string[]; // State slugs to include (e.g., ["ca"])
  centerLat: number;
  centerLon: number; // NOTE: Use 'lon' not 'lng' per CLAUDE.md coordinate conventions
  zoom: number;
}

const HUB_REGIONS: Record<string, HubRegion> = {
  "southern-california": {
    slug: "southern-california",
    name: "Southern California",
    title: "Complete Guide to Surfing Southern California",
    description:
      "From Malibu to the Mexican border, Southern California offers world-class waves across 200 miles of coastline. Point breaks at Rincon and Malibu deliver long, peeling rides on south swells, while San Diego's reef breaks and beach breaks handle everything the Pacific throws at them.\n\nSummer brings consistent south swells and warm water (65-72°F), making it prime for longboarding and dawn patrol. Winter northwest groundswells push overhead surf to exposed breaks like Blacks Beach and Trestles. Water temps drop to the mid-50s but rarely require more than a 4/3mm. Offshore Santa Ana winds in fall create the cleanest conditions of the year.",
    states: ["ca"],
    centerLat: 33.5,
    centerLon: -117.8,
    zoom: 8,
  },
  "san-diego": {
    slug: "san-diego",
    name: "San Diego",
    title: "Complete Guide to Surfing San Diego",
    description:
      "San Diego delivers year-round surf across 70+ miles of coastline, from the kelp-lined reefs of La Jolla to the jetty breaks of Imperial Beach. The region's southwest-facing exposure catches every south swell that tracks through, while winter northwest groundswells light up the more exposed north county breaks.\n\nWater temps run 57-72°F, comfortable in a 3/2mm most of the year. Fall Santa Ana events push offshore winds across the county and bring the warmest water and cleanest surf of the season. The lineup culture ranges from mellow longboard points at Tourmaline to competitive shortboard reefs at Seaside.",
    states: ["ca"],
    centerLat: 32.85,
    centerLon: -117.25,
    zoom: 10,
  },
  "orange-county": {
    slug: "orange-county",
    name: "Orange County",
    title: "Complete Guide to Surfing Orange County",
    description:
      "Home to Trestles, Huntington Beach, and The Wedge, Orange County sits at the heart of California surf culture. Trestles' cobblestone points are among the best high-performance waves in the world, while HB's consistent beach break hosts the US Open of Surfing every summer.\n\nSouth swells light up Lower Trestles and San Clemente from April through October. Winter brings northwest energy to Huntington and Newport's jetty-enhanced peaks. The Wedge bodysurf break at Newport is a spectacle on south swells - not for the faint-hearted.",
    states: ["ca"],
    centerLat: 33.6,
    centerLon: -117.9,
    zoom: 10,
  },
  hawaii: {
    slug: "hawaii",
    name: "Hawaii",
    title: "Complete Guide to Surfing Hawaii",
    description:
      "The birthplace of surfing. Hawaii's North Shore delivers some of the heaviest waves on earth from November through February, while the south-facing shores of Waikiki and Ala Moana serve up gentle rollers for beginners year-round.\n\nWater temps stay between 73-80°F, so boardshorts are standard. The trade winds blow onshore most afternoons, making early mornings and Kona wind days the prime windows. Reef breaks dominate - booties are smart for urchin-heavy spots. Respect the locals and understand the lineup pecking order, especially at spots like Pipeline and Sunset Beach.",
    states: ["hi"],
    centerLat: 21.3,
    centerLon: -157.8,
    zoom: 7,
  },
  "los-angeles": {
    slug: "los-angeles",
    name: "Los Angeles",
    title: "Complete Guide to Surfing Los Angeles",
    description:
      "From Malibu's perfect points to Venice's beach breaks, Los Angeles offers diverse surf across 75 miles of coastline. Summer south swells light up Malibu First Point and El Porto, while winter northwest energy pushes overhead waves to exposed breaks in Palos Verdes and Manhattan Beach.\n\nWater temps range 55-70°F. A 3/2mm handles most of the year, with a 4/3mm for winter dawn patrols. LA's urban setting means parking battles and crowds, but midweek sessions and knowledge of secondary peaks reward the persistent.",
    states: ["ca"],
    centerLat: 33.95,
    centerLon: -118.45,
    zoom: 10,
  },
  "santa-cruz": {
    slug: "santa-cruz",
    name: "Santa Cruz",
    title: "Complete Guide to Surfing Santa Cruz",
    description:
      "The birthplace of mainland surfing. Santa Cruz delivers world-class point breaks like Steamer Lane and Pleasure Point alongside consistent beach breaks and sheltered coves. The region picks up every swell the North Pacific generates.\n\nWater temps run 50-60°F year-round - a 4/3mm is standard, and a 5/4mm with boots earns its keep in winter. Northwest swells are the bread and butter, with fall and winter delivering the biggest and most consistent surf. Kelp beds, rock reefs, and sea otters are part of the scenery.",
    states: ["ca"],
    centerLat: 36.97,
    centerLon: -122.03,
    zoom: 11,
  },
  "northern-california": {
    slug: "northern-california",
    name: "Northern California",
    title: "Complete Guide to Surfing Northern California",
    description:
      "From Half Moon Bay to the Oregon border, Northern California delivers some of the heaviest beach breaks and most dramatic coastline on the West Coast. Ocean Beach San Francisco is the region's flagship — a powerful, shifting peak that punishes weak paddlers and rewards commitment. Mavericks, just south of Half Moon Bay, is one of the premier big wave spots on the planet.\n\nThe water runs cold year-round — 48-58°F means a 4/3mm is the bare minimum and most locals wear a 5/4mm with boots from October through May. Powerful NW groundswells are the bread and butter, with fall and winter delivering the biggest and most consistent surf. Spring offers medium-sized swells with longer daylight.\n\nBeyond the heavy stuff, Pacifica's Linda Mar serves up approachable beach break for beginners, Stinson Beach catches south wrap, and Bolinas hides mellow reef breaks behind its famously unsigned roads. Kelp forests, sea otters, and the occasional great white are part of the scenery — this is raw, wild California surfing.",
    states: ["ca"],
    centerLat: 37.6,
    centerLon: -122.5,
    zoom: 8,
  },
  ventura: {
    slug: "ventura",
    name: "Ventura County",
    title: "Complete Guide to Surfing Ventura County",
    description:
      "From Rincon to County Line, Ventura County delivers some of California's most consistent waves. Rincon - 'Queen of the Coast' - is one of the best right-hand point breaks in the world when a winter west swell fills in.\n\nThe county faces south-to-southwest, picking up both summer south swells and winter northwest energy. Water temps range 54-68°F. Ventura Harbor's sandbars and Mondos' mellow longboard walls balance out the high-performance reef breaks scattered along the coast.",
    states: ["ca"],
    centerLat: 34.28,
    centerLon: -119.25,
    zoom: 10,
  },
  florida: {
    slug: "florida",
    name: "Florida",
    title: "Complete Guide to Surfing Florida",
    description:
      "Year-round warm water surfing on both coasts, with New Smyrna Beach, Sebastian Inlet, and Jacksonville delivering the most consistent waves on the Atlantic side. Florida waves are smaller and shorter-period than the West Coast, but hurricane season (June-November) brings overhead surf and hollow barrels.\n\nWater temps range 65-85°F - boardshorts work from May through October. The Gulf Coast picks up rare but clean south swells. East Coast breaks respond best to nor'easters and tropical systems tracking north.",
    states: ["fl"],
    centerLat: 28.5,
    centerLon: -80.6,
    zoom: 6,
  },
  "new-jersey": {
    slug: "new-jersey",
    name: "New Jersey",
    title: "Complete Guide to Surfing New Jersey",
    description:
      "The heart of East Coast surfing. New Jersey's 127 miles of beach break coastline light up on fall nor'easters and passing hurricane swells. Spots like Manasquan Inlet, Long Branch, and Belmar deliver punchy, hollow waves when the sandbars line up.\n\nSummer water temps reach 72-75°F, but winter drops to the high 30s - a 5/4mm with boots, gloves, and hood is mandatory December through March. Fall is prime season: warm water lingers while consistent north swells push through.",
    states: ["nj"],
    centerLat: 39.8,
    centerLon: -74.1,
    zoom: 8,
  },
  "outer-banks": {
    slug: "outer-banks",
    name: "Outer Banks",
    title: "Complete Guide to Surfing the Outer Banks",
    description:
      "North Carolina's barrier islands catch swell from every direction - northeast storms, southeast tropical swells, and even rare wraparound south energy. The Outer Banks offers some of the least crowded quality surf on the East Coast.\n\nWater temps range 48-80°F depending on season. Rodanthe, Buxton, and the Cape Hatteras jetties are the marquee spots. Fall hurricane season is the main event, but consistent nor'easter swells keep things rideable through winter.",
    states: ["nc"],
    centerLat: 35.75,
    centerLon: -75.55,
    zoom: 9,
  },
  "puerto-rico": {
    slug: "puerto-rico",
    name: "Puerto Rico",
    title: "Complete Guide to Surfing Puerto Rico",
    description:
      "World-class Caribbean surf with warm water year-round. Rincon's legendary points - Domes, Indicators, Maria's - fire from November through April on northwest groundswells. Isabela and Aguadilla offer more accessible beach breaks for intermediates.\n\nWater temps stay 78-84°F, making it a boardshorts-only destination. The west coast faces open Atlantic swell and delivers surprisingly powerful reef and point breaks. Crowds at top spots during winter season are real - midweek and dawn patrol help.",
    states: ["pr"],
    centerLat: 18.22,
    centerLon: -67.15,
    zoom: 9,
  },
  oregon: {
    slug: "oregon",
    name: "Oregon",
    title: "Complete Guide to Surfing Oregon",
    description:
      "Oregon's 362 miles of rugged coastline deliver some of the most powerful and least crowded surf in the continental US. Short Sands at Oswald West State Park is the jewel — a sheltered cove with a quality beach break surrounded by old-growth forest. Indian Beach, Otter Rock, and Pacific City's Cape Kiwanda offer everything from protected sandbars to exposed reef setups.\n\nThe water stays cold year-round — 48-55°F with minimal seasonal variation. A 5/4mm with boots and gloves is standard kit, and a hooded suit earns its keep from November through March. Powerful NW groundswells barrel down from Gulf of Alaska storms, and the exposed coast amplifies everything the North Pacific generates.\n\nWhat you trade in comfort you gain in solitude. Oregon's breaks see a fraction of the crowds that pack California lineups. Rocky approaches, strong currents, and heavy water keep the tourist count low. Fall and winter are prime season with the biggest and most consistent swells. Summer offers smaller, cleaner windows with longer daylight — the best time for intermediate surfers exploring the coast.",
    states: ["or"],
    centerLat: 44.6,
    centerLon: -124.1,
    zoom: 7,
  },
};

export const HUB_REGION_SLUGS = Object.keys(HUB_REGIONS);

export function getHubRegion(slug: string): HubRegion | null {
  return HUB_REGIONS[slug] || null;
}
