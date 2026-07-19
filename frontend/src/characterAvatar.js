// avatar.js — maps a PersonaCard's `physical` description string to a
// DiceBear avataaars v9 URL. All option values are verified against the
// published schema: https://api.dicebear.com/9.x/avataaars/schema.json
//
// Strategy: pin ALL non-physical params to neutral defaults first, then
// override with anything we can infer from the physical description.
// This prevents DiceBear from randomising unset params (which causes
// flowers-in-hair, crying eyes, eating mouths, etc.).

const BASE = "https://api.dicebear.com/9.x/avataaars/svg";

// ── neutral defaults — always applied ────────────────────────────────────────
// Every param that isn't driven by physical text is locked to a sensible value
// so the seed can't randomise it into something absurd.
const DEFAULTS = {
  eyes: "default",
  eyebrows: "defaultNatural",
  mouth: "smile",
  nose: "default",
  hairColor: "2c1b18",         // near-black default — overridden if text matches
  skinColor: "ffdbb4",         // light/pale default — overridden if text matches
  clothing: "shirtCrewNeck",   // plain crew-neck — overridden if text matches
  clothingGraphic: "bear",     // only visible on graphicShirt
  topProbability: "100",       // always show hair/hat
  facialHairProbability: "0",  // suppress unless text says beard/moustache
  accessoriesProbability: "0", // suppress unless text says glasses/etc.
  style: "circle",             // circle crop looks cleaner in the chat UI
};

// Default hair style when physical text gives no style clue, keyed by gender.
const DEFAULT_TOP = {
  female: "longButNotTooLong",
  male: "shortFlat",
  nonbinary: "shortWaved",
  "": "shortFlat",             // unknown — neutral short
};

// ── option maps ──────────────────────────────────────────────────────────────
// Each entry: words to match (lowercase substrings) → valid schema value.
// More-specific phrases are listed before shorter ones so they win first.

const HAIR_COLOR_MAP = [
  { words: ["black hair", "dark hair", "dark-haired", "jet hair", "raven hair", "raven-black", "raven"], value: "2c1b18" },
  { words: ["blonde", "blond", "golden hair", "yellow hair", "fair hair"], value: "d6b370" },
  { words: ["red hair", "auburn hair", "ginger hair", "auburn", "ginger"], value: "c93305" },
  { words: ["brown hair", "brunette", "chestnut hair", "chestnut"], value: "a55728" },
  { words: ["grey hair", "gray hair", "silver hair", "white hair", "greying"], value: "e8e1e1" },
  { words: ["light hair", "pale hair", "platinum"], value: "ecdcbf" },
];

// Valid `top` values from the schema enum.
const HAIR_STYLE_MAP = [
  { words: ["hijab", "headscarf"], value: "hijab" },
  { words: ["turban"], value: "turban" },
  { words: ["bun", "updo", "pinned up", "hair up"], value: "bun" },
  { words: ["afro"], value: "fro" },
  { words: ["dread", "locs"], value: "dreads01" },
  { words: ["curly hair", "curls", "curly"], value: "curly" },
  { words: ["wavy hair", "wavy"], value: "shortWaved" },
  { words: ["frizzy", "frizz", "wild hair", "untidy hair", "dishevelled", "tousled", "unruly", "unkempt", "messy hair", "untidy"], value: "frizzle" },
  { words: ["shaggy", "shaggy hair"], value: "shaggy" },
  { words: ["long hair", "flowing hair", "loose hair", "long straight"], value: "longButNotTooLong" },
  { words: ["mia wallace", "blunt bob", "bob cut"], value: "miaWallace" },
  { words: ["bob hair", "short bob", "bob"], value: "bob" },
  { words: ["big hair", "voluminous hair", "voluminous"], value: "bigHair" },
  { words: ["buzz cut", "buzzcut", "shaved", "bald"], value: "theCaesar" },
  { words: ["short hair", "cropped hair", "cropped", "close-cut", "close cut"], value: "shortFlat" },
];

// skinColor takes a hex string from the DiceBear default palette.
const SKIN_COLOR_MAP = [
  { words: ["very pale", "porcelain", "paper-white", "chalk"], value: "ffdbb4" },
  { words: ["pale skin", "pale complexion", "pale face", "pale"], value: "ffdbb4" },
  { words: ["light skin", "fair skin", "fair complexion", "light complexion", "ivory"], value: "fd9841" },
  { words: ["medium skin", "tan ", "tawny", "warm skin", "olive skin", "olive"], value: "edb98a" },
  { words: ["brown skin", "dark skin", "dark complexion", "brown complexion"], value: "d08b5b" },
  { words: ["deep skin", "very dark skin", "ebony", "dark brown skin"], value: "614335" },
];

// Valid `facialHair` values from schema.
const FACIAL_HAIR_MAP = [
  { words: ["long beard", "thick beard", "heavy beard", "full beard", "majestic beard"], value: "beardMajestic" },
  { words: ["beard", "bearded", "stubble"], value: "beardMedium" },
  { words: ["light beard", "thin beard", "shadow"], value: "beardLight" },
  { words: ["moustache", "mustache"], value: "moustacheFancy" },
  { words: ["magnum", "handlebar"], value: "moustacheMagnum" },
];

// Valid `accessories` values from schema.
const ACCESSORIES_MAP = [
  { words: ["round glasses", "round spectacles", "circular glasses", "circle glasses"], value: "round" },
  { words: ["glasses", "spectacles", "wire-rimmed", "eyeglasses", "reading glasses"], value: "kurt" },
  { words: ["sunglasses"], value: "sunglasses" },
  { words: ["prescription glasses"], value: "prescription02" },
  { words: ["eyepatch", "eye patch"], value: "eyepatch" },
];

// Valid `clothing` values from schema.
const CLOTHING_MAP = [
  { words: ["uniform", "military uniform", "blazer and shirt"], value: "blazerAndShirt" },
  { words: ["suit", "formal wear", "blazer", "gentleman", "imposing bearing"], value: "blazerAndSweater" },
  { words: ["collar and sweater", "collar sweater"], value: "collarAndSweater" },
  { words: ["dress", "gown", "skirt", "scoop neck"], value: "shirtScoopNeck" },
  { words: ["hoodie", "sweatshirt"], value: "hoodie" },
  { words: ["overalls", "dungarees"], value: "overall" },
  { words: ["graphic shirt", "t-shirt", "tshirt", "graphic tee"], value: "graphicShirt" },
  { words: ["crew neck", "crewneck", "jumper", "sweater"], value: "shirtCrewNeck" },
  { words: ["v-neck", "v neck", "vneck"], value: "shirtVNeck" },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function lc(text) {
  return (text || "").toLowerCase();
}

function pick(map, text) {
  const t = lc(text);
  for (const { words, value } of map) {
    if (words.some((w) => t.includes(w))) return value;
  }
  return null;
}

// ── main export ───────────────────────────────────────────────────────────────

/**
 * Build a DiceBear avataaars v9 SVG URL from a PersonaCard's physical field.
 *
 * @param {string} physical  - The `physical` field of a PersonaCard.
 * @param {string} seed      - Stable seed (use character id).
 * @param {string} gender    - 'male', 'female', 'nonbinary', or ''.
 * @returns {string}  Full URL suitable for an <img src>.
 */
export function buildAvatarUrl(physical, seed, gender = "") {
  // Start with all defaults so nothing is left to the seed's randomness.
  // Use a gender-appropriate default hair style as the baseline top.
  const genderKey = (gender || "").toLowerCase();
  const defaultTop = DEFAULT_TOP[genderKey] ?? DEFAULT_TOP[""];
  const params = new URLSearchParams({ seed: seed || "character", top: defaultTop, ...DEFAULTS });

  const hairColor = pick(HAIR_COLOR_MAP, physical);
  if (hairColor) params.set("hairColor", hairColor);

  // Physical text overrides the gender-default top if it says something specific.
  const hairStyle = pick(HAIR_STYLE_MAP, physical);
  if (hairStyle) params.set("top", hairStyle);

  const skin = pick(SKIN_COLOR_MAP, physical);
  if (skin) params.set("skinColor", skin);

  const facialHair = pick(FACIAL_HAIR_MAP, physical);
  if (facialHair) {
    params.set("facialHair", facialHair);
    params.set("facialHairProbability", "100");
  }

  const accessory = pick(ACCESSORIES_MAP, physical);
  if (accessory) {
    params.set("accessories", accessory);
    params.set("accessoriesProbability", "100");
  }

  const clothing = pick(CLOTHING_MAP, physical);
  if (clothing) params.set("clothing", clothing);

  return `${BASE}?${params.toString()}`;
}
