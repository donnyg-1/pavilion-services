// Address normalization for matching resident input against the community's address list.
// Built for Utah's grid addresses ("1234 N 500 E") as well as named streets.

const DIRECTIONS: Record<string, string> = {
  NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W",
  NORTHEAST: "NE", NORTHWEST: "NW", SOUTHEAST: "SE", SOUTHWEST: "SW",
};

// USPS standard suffix abbreviations (common subset).
const SUFFIXES: Record<string, string> = {
  STREET: "ST", STR: "ST",
  AVENUE: "AVE", AV: "AVE", AVN: "AVE",
  ROAD: "RD",
  DRIVE: "DR", DRV: "DR",
  LANE: "LN",
  COURT: "CT",
  CIRCLE: "CIR", CIRC: "CIR",
  BOULEVARD: "BLVD", BOUL: "BLVD",
  PLACE: "PL",
  PARKWAY: "PKWY", PKY: "PKWY",
  TERRACE: "TER",
  TRAIL: "TRL",
  COVE: "CV",
  HOLLOW: "HOLW",
  HIGHWAY: "HWY",
  CANYON: "CYN",
  PLAZA: "PLZ",
  SQUARE: "SQ",
  POINT: "PT",
  RIDGE: "RDG",
  CREEK: "CRK",
  VIEW: "VW",
  CROSSING: "XING",
  MEADOW: "MDW",
  MEADOWS: "MDWS",
  HEIGHTS: "HTS",
  GROVE: "GRV",
  HILL: "HL",
  HILLS: "HLS",
  PARK: "PARK",
  WAY: "WAY",
  LOOP: "LOOP",
  RUN: "RUN",
  ROW: "ROW",
};

const UNIT_WORDS = ["APARTMENT", "APT", "UNIT", "SUITE", "STE", "BUILDING", "BLDG", "LOT", "NO", "NUMBER"];
const STATE_WORDS = new Set(["UT", "UTAH"]);

export type NormalizedAddress = {
  /** Matching key: street + optional unit, e.g. "1234 N 500 E #12" */
  key: string;
  street: string;
  unit: string | null;
};

function cleanUnit(raw: string): string {
  return raw.replace(/[^A-Z0-9-]/g, "");
}

/**
 * Normalizes a street address (and optional separate unit) into a matching key.
 * Returns null when there's no house number, since we can't match those reliably.
 */
export function normalizeAddress(streetInput: string, unitInput?: string | null): NormalizedAddress | null {
  let s = (streetInput ?? "").toUpperCase();

  // Keep only the street line: drop ", City, UT 84043" and similar.
  s = s.split(",")[0];
  s = s.replace(/\b\d{5}(-\d{4})?\s*$/, ""); // trailing ZIP without a comma
  s = s.replace(/[.']/g, "").replace(/[^A-Z0-9#\- ]/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  let unit: string | null = unitInput ? cleanUnit(unitInput.toUpperCase().replace(/^(#|APT|UNIT|STE|SUITE|LOT)\s*/, "")) || null : null;

  // Pull a unit off the end: "#12", "APT 12", "UNIT B-3"
  const unitRe = new RegExp(`\\s+(?:#\\s*|(?:${UNIT_WORDS.join("|")})\\s+#?\\s*)([A-Z0-9-]+)$`);
  const m = s.match(unitRe);
  if (m) {
    unit = unit ?? cleanUnit(m[1]);
    s = s.slice(0, m.index).trim();
  }
  s = s.replace(/#/g, " ").replace(/\s+/g, " ").trim();

  let tokens = s.split(" ").filter(Boolean);

  // Drop a trailing state name with no comma: "123 MAIN ST LEHI UT" → we can't know the city, but drop "UT".
  while (tokens.length > 2 && STATE_WORDS.has(tokens[tokens.length - 1])) tokens.pop();

  tokens = tokens.map((t, i) => {
    if (DIRECTIONS[t]) return DIRECTIONS[t];
    if (i > 0 && SUFFIXES[t]) return SUFFIXES[t];
    // Ordinals on grid numbers: "500TH" → "500", "1ST" stays a street name only when alone.
    const ord = t.match(/^(\d+)(ST|ND|RD|TH)$/);
    if (ord && i > 0) return ord[1];
    return t;
  });

  if (tokens.length < 2 || !/^\d/.test(tokens[0])) return null;

  // Grid addresses: "1234 N 500 E ST" → drop the redundant suffix.
  if (tokens.length === 5 && /^\d/.test(tokens[0]) && /^[NSEW]$/.test(tokens[1]) && /^\d+$/.test(tokens[2]) && /^[NSEW]$/.test(tokens[3]) && tokens[4] === "ST") {
    tokens = tokens.slice(0, 4);
  }

  const street = tokens.join(" ");
  return { street, unit, key: unit ? `${street} #${unit}` : street };
}

/** Convenience: matching key or null. */
export function addressKey(streetInput: string, unitInput?: string | null): string | null {
  return normalizeAddress(streetInput, unitInput)?.key ?? null;
}

/** Sort key for vendor route exports: by street, then house number. */
export function routeSortKey(normalizedKey: string): [string, number] {
  const [num, ...rest] = normalizedKey.split(" ");
  return [rest.join(" "), parseInt(num, 10) || 0];
}

const EXPANSIONS: Record<string, string[]> = {};
for (const [word, abbr] of [...Object.entries(DIRECTIONS), ...Object.entries(SUFFIXES)]) {
  (EXPANSIONS[abbr] ??= [abbr]).push(word);
}

/**
 * Whether a half-typed address could be this address, for suggestions. Each typed word
 * must start the matching word of the key, either as abbreviated or spelled out:
 * "1300 nor" and "1300 n 5" both match "1300 N 500 E".
 */
export function matchesPartial(normalizedKey: string, input: string): boolean {
  const typed = (input ?? "").toUpperCase().split(",")[0].replace(/[.']/g, "").replace(/[^A-Z0-9# -]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (typed.length === 0) return false;
  const key = normalizedKey.split(" ");
  if (typed.length > key.length) return false;
  return typed.every((t, i) => {
    const k = key[i];
    const word = t.replace(/^(\d+)(ST|ND|RD|TH)$/, "$1");
    return (EXPANSIONS[k] ?? [k]).some((form) => form.startsWith(word));
  });
}
