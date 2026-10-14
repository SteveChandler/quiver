import {
  findPhotoPlaceConflict,
  type PlaceCatalogEntry,
} from "@/scripts/lib/beach-photo-place-guard";

const catalog: PlaceCatalogEntry[] = [
  { name: "Blacks Beach", city: "San Diego", state: "CA", region: "San Diego" },
  { name: "La Jolla Shores", city: "La Jolla", state: "CA", region: "San Diego" },
  { name: "Ocean Beach", city: "San Diego", state: "CA", region: "San Diego" },
  { name: "Del Mar", city: "Del Mar", state: "CA", region: "San Diego" },
  { name: "Venice Beach", city: "Venice", state: "CA", region: "Los Angeles" },
  { name: "Huntington State Beach", city: "Huntington Beach", state: "CA", region: "Orange County" },
  { name: "Bolsa Chica", city: "Huntington Beach", state: "CA", region: "Orange County" },
  { name: "Corona del Mar", city: "Newport Beach", state: "CA", region: "Orange County" },
  { name: "Church", city: "San Clemente", state: "CA", region: "Orange County" },
  { name: "Ocean Beach SF – North", city: "San Francisco", state: "CA", region: "San Francisco" },
  { name: "Long Beach", city: "Long Beach", state: "NY", region: "Long Island" },
  { name: "Corolla", city: "Corolla", state: "NC", region: "Outer Banks" },
  { name: "Isla Verde", city: "Carolina", state: "PR", region: "San Juan Metro" },
  { name: "Ponce Inlet", city: "Ponce Inlet", state: "FL", region: "Central Florida", lat: 29.0806, lon: -80.9226 },
  { name: "New Smyrna Beach", city: "New Smyrna Beach", state: "FL", region: "Volusia County", lat: 29.0258, lon: -80.9270 },
  { name: "Flagler Beach", city: "Flagler Beach", state: "FL", region: "Central Florida", lat: 29.4750, lon: -81.1270 },
  { name: "Ocean Beach Pier", city: "San Diego", state: "CA", region: "San Diego" },
  { name: "Waikiki Beach", city: "Honolulu", state: "HI", region: "South Shore Oahu" },
];

const target = (name: string) => {
  const entry = catalog.find((place) => place.name === name);
  if (!entry) throw new Error(`no catalog entry for ${name}`);
  return entry;
};

describe("findPhotoPlaceConflict", () => {
  it("rejects the Venice Beach photo Openverse matched to Blacks Beach", () => {
    expect(
      findPhotoPlaceConflict(
        "Surfer in Venice Beach - Los Angeles, United States - Sport photography",
        target("Blacks Beach"),
        catalog,
      ),
    ).toBe("venice beach");
  });

  it("rejects a beach the catalog does not know when the title never names the target", () => {
    expect(
      findPhotoPlaceConflict("Lhok Nga Beach", target("Blacks Beach"), catalog),
    ).toBe("lhok nga beach");
  });

  it("does not read 'Black and white' as Blacks Beach", () => {
    expect(
      findPhotoPlaceConflict(
        "Walking in Venice beach - Los Angeles, United States - Black and white street photography",
        target("Blacks Beach"),
        catalog,
      ),
    ).toBe("venice beach");
  });

  it("passes a title that names no place", () => {
    expect(
      findPhotoPlaceConflict("kiter after work", target("Blacks Beach"), catalog),
    ).toBeNull();
  });

  it("allows a neighbouring beach in the same city", () => {
    expect(
      findPhotoPlaceConflict(
        "Bolsa Chica State Beach, Huntington Beach, California",
        target("Huntington State Beach"),
        catalog,
      ),
    ).toBeNull();
  });

  it("allows the region a beach sits in", () => {
    expect(
      findPhotoPlaceConflict("La Jolla, San Diego, CA", target("La Jolla Shores"), catalog),
    ).toBeNull();
    expect(
      findPhotoPlaceConflict("San Diego County", target("La Jolla Shores"), catalog),
    ).toBeNull();
  });

  it("allows a beach a few kilometres away in another catalog city", () => {
    expect(
      findPhotoPlaceConflict(
        "Ponce de Leon Inlet (New Smyrna Beach, Florida, USA) 1",
        target("Ponce Inlet"),
        catalog,
      ),
    ).toBeNull();
    expect(
      findPhotoPlaceConflict("New Smyrna Beach", target("Flagler Beach"), catalog),
    ).toBe("new smyrna beach");
  });

  it("rejects a named region the target is not in", () => {
    expect(
      findPhotoPlaceConflict("Sunset from Long Island", target("Ocean Beach Pier"), catalog),
    ).toBe("long island");
    expect(
      findPhotoPlaceConflict("Sunset from Long Island", target("Long Beach"), catalog),
    ).toBeNull();
  });

  it("does not read a colour before 'Beach' as a place", () => {
    expect(
      findPhotoPlaceConflict("Blue Beach Umbrellas", target("Waikiki Beach"), catalog),
    ).toBeNull();
  });

  it("rejects a same-named beach in another city", () => {
    expect(
      findPhotoPlaceConflict(
        "Girl drawing on sand. Ocean Beach, San Francisco",
        target("Ocean Beach"),
        catalog,
      ),
    ).toBe("san francisco");
  });

  it("allows a shared beach name when one catalog entry is the target's city", () => {
    expect(
      findPhotoPlaceConflict(
        "Ocean Beach",
        target("Ocean Beach SF – North"),
        catalog,
      ),
    ).toBeNull();
  });

  it("treats a place inside the target's own name as the target", () => {
    expect(
      findPhotoPlaceConflict(
        "View of Del Mar Beach in Corona del Mar, ca.1908",
        target("Corona del Mar"),
        catalog,
      ),
    ).toBeNull();
  });

  it("ignores single-word beach names that are ordinary words", () => {
    expect(
      findPhotoPlaceConflict("Church at sunset", target("Blacks Beach"), catalog),
    ).toBeNull();
  });

  it("does not read a state name as a same-named catalog city", () => {
    expect(
      findPhotoPlaceConflict(
        "Corolla, North Carolina view from the lighthouse",
        target("Corolla"),
        catalog,
      ),
    ).toBeNull();
  });

  it("rejects a title placed in another state", () => {
    expect(
      findPhotoPlaceConflict(
        "Sunrise Marriott's Ocean Pointe, Palm Beach Shores, Florida",
        target("Ocean Beach"),
        catalog,
      ),
    ).toBe("florida");
    expect(
      findPhotoPlaceConflict("Park Point, Duluth, MN", target("Long Beach"), catalog),
    ).toBe("mn");
  });

  it("still rejects a foreign beach without a catalog", () => {
    expect(
      findPhotoPlaceConflict(
        "Surfer in Venice Beach - Los Angeles, United States - Sport photography",
        { name: "Blacks Beach", city: "San Diego", state: "CA" },
      ),
    ).toBe("venice beach");
  });
});
