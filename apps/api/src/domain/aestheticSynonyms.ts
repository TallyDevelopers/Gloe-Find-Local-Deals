/**
 * Aesthetic-domain query expansion — the "this was built by someone who knows
 * the space" layer of search.
 *
 * Two layers work together to make search feel like DoorDash/Groupon:
 *
 *   1. SEMANTIC expansion (this file): "tox" → Botox + Dysport + Jeuveau + …
 *      A generic search engine has no idea "tox" means neuromodulator, that
 *      "skinny shot" means semaglutide, or that "fat freeze" is CoolSculpting.
 *      We hard-code that domain knowledge as trigger→expansion groups.
 *
 *   2. FUZZY matching (in SQL, pg_trgm `word_similarity`): "botx" ~ "botox",
 *      "filer" ~ "filler", "microneedeling" ~ "microneedling". Handles typos on
 *      whatever the user actually typed AND on the expansion terms below.
 *
 * `expandQuery` turns a raw string into the set of terms SQL should match
 * against deal titles, vendor names, category + subtype names. Expansion terms
 * are intentionally words that appear in our taxonomy so both substring and
 * trigram matching land.
 */

/** trigger phrases users actually type → terms we should search for. */
const SYNONYM_GROUPS: { triggers: string[]; expand: string[] }[] = [
  // ─── Neuromodulators ("tox") ───
  {
    triggers: ['tox', 'botox', 'baby botox', 'wrinkle', 'wrinkles', 'forehead lines', 'frown lines', 'crows feet', 'crow feet', 'eleven lines', '11 lines', 'anti aging', 'anti-aging', 'antiaging', 'neurotoxin', 'neuromodulator', 'glabellar', 'lip flip'],
    expand: ['botox', 'dysport', 'jeuveau', 'xeomin', 'daxxify'],
  },
  // ─── Dermal filler ───
  {
    triggers: ['filler', 'fillers', 'dermal filler', 'lip filler', 'lips', 'cheek filler', 'jawline', 'chin filler', 'under eye', 'tear trough', 'plump', 'volume', 'nasolabial', 'smile lines'],
    expand: ['dermal filler', 'juvederm', 'voluma', 'volbella', 'restylane', 'kysse', 'lyft', 'rha', 'sculptra'],
  },
  // ─── Weight loss / GLP-1 ───
  {
    triggers: ['weight loss', 'weightloss', 'lose weight', 'ozempic', 'wegovy', 'mounjaro', 'zepbound', 'glp', 'glp 1', 'glp-1', 'glp1', 'skinny shot', 'skinny jab', 'semaglutide', 'tirzepatide', 'fat loss', 'slim down', 'slimming'],
    expand: ['semaglutide', 'tirzepatide', 'weight loss', 'medical weight management'],
  },
  // ─── Fat reduction / body contouring ───
  {
    triggers: ['fat freeze', 'fat freezing', 'freeze fat', 'coolsculpt', 'coolsculpting', 'body contour', 'body contouring', 'fat reduction', 'sculpt body', 'love handles', 'belly fat', 'inch loss', 'cellulite'],
    expand: ['coolsculpting', 'body contouring'],
  },
  // ─── Laser hair removal ───
  {
    triggers: ['laser hair', 'hair removal', 'lhr', 'brazilian laser', 'unwanted hair', 'underarm laser', 'bikini laser'],
    expand: ['laser hair removal'],
  },
  // ─── Facials / glow ───
  {
    triggers: ['facial', 'facials', 'hydrafacial', 'hydra facial', 'glow facial', 'deep clean', 'clogged pores', 'pores', 'glowy skin', 'glow up', 'dull skin', 'dermaplaning'],
    expand: ['hydrafacial', 'facials', 'chemical peel'],
  },
  // ─── Microneedling / PRP / texture ───
  {
    triggers: ['microneedling', 'micro needling', 'vampire facial', 'collagen induction', 'prp', 'skin texture', 'acne scars', 'acne scarring', 'scars', 'large pores', 'rf microneedling'],
    expand: ['microneedling', 'morpheus8', 'rf microneedling'],
  },
  // ─── Skin tightening / Morpheus ───
  {
    triggers: ['skin tightening', 'tighten skin', 'tighten', 'morpheus', 'morpheus8', 'radiofrequency', 'sagging skin', 'firm skin', 'jowls', 'crepey'],
    expand: ['morpheus8', 'rf microneedling', 'skin tightening', 'halo'],
  },
  // ─── Lasers / resurfacing / pigment / redness ───
  {
    triggers: ['laser', 'laser facial', 'resurfacing', 'pigmentation', 'sun damage', 'sunspots', 'sun spots', 'dark spots', 'melasma', 'redness', 'rosacea', 'broken capillaries', 'photofacial', 'photo facial', 'bbl', 'ipl', 'halo laser', 'moxi'],
    expand: ['bbl', 'ipl', 'halo', 'moxi', 'laser skin'],
  },
  // ─── Chemical peels ───
  {
    triggers: ['peel', 'chemical peel', 'exfoliate', 'brighten skin', 'vi peel'],
    expand: ['chemical peel'],
  },
  // ─── IV / wellness drips / shots ───
  {
    triggers: ['iv', 'iv drip', 'iv therapy', 'iv hydration', 'hydration drip', 'drip', 'vitamin drip', 'myers', 'myers cocktail', 'nad', 'nad+', 'hangover', 'energy boost', 'immune', 'b12', 'vitamin shot', 'wellness shot', 'glutathione'],
    expand: ['iv hydration', 'myers cocktail', 'nad', 'b12', 'wellness shots'],
  },
  // ─── Hormones / HRT ───
  {
    triggers: ['hormone', 'hormones', 'hrt', 'bhrt', 'testosterone', 'trt', 'estrogen', 'menopause', 'low t', 'low testosterone', 'libido'],
    expand: ['hormone therapy'],
  },
  // ─── Lashes / brows ───
  {
    triggers: ['lashes', 'lash', 'eyelash', 'lash lift', 'lash extensions', 'latisse', 'brows', 'brow', 'eyebrow', 'brow lamination', 'lamination', 'microblading', 'henna brow'],
    expand: ['lash services', 'brow services', 'latisse'],
  },
  // ─── Teeth whitening ───
  {
    triggers: ['teeth whitening', 'whiten teeth', 'white teeth', 'teeth', 'whitening'],
    expand: ['teeth whitening'],
  },
  // ─── Spray tan ───
  {
    triggers: ['spray tan', 'spray tanning', 'tan', 'tanning', 'bronze', 'airbrush tan'],
    expand: ['spray tans'],
  },
  // ─── Waxing ───
  {
    triggers: ['wax', 'waxing', 'sugaring', 'brazilian wax', 'bikini wax', 'hair wax'],
    expand: ['waxing', 'sugaring'],
  },
  // ─── Eyelid lift ───
  {
    triggers: ['upneeq', 'droopy eyelid', 'eyelid lift', 'hooded eyes', 'ptosis'],
    expand: ['upneeq', 'eyelid'],
  },
];

/** Lowercase, strip punctuation to spaces, collapse whitespace. */
export function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, ' ') // keep + (NAD+, GLP+); everything else → space
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ExpandedQuery {
  /** Normalized whole query (e.g. "lip filler"). Empty string if the input was blank. */
  normalized: string;
  /** All terms SQL should match against (raw query + tokens + synonym expansions), deduped. */
  terms: string[];
  /** How many synonym groups fired — >0 means we semantically understood the query. */
  matchedGroups: number;
}

/**
 * Expand a raw query into the term set used for matching. Always includes the
 * normalized query and its individual word tokens (so fuzzy/substring still
 * works on novel input), plus any synonym-group expansions that fired.
 */
export function expandQuery(raw: string): ExpandedQuery {
  const normalized = normalizeQuery(raw);
  if (!normalized) return { normalized: '', terms: [], matchedGroups: 0 };

  const terms = new Set<string>();
  terms.add(normalized);
  for (const tok of normalized.split(' ')) {
    if (tok.length >= 2) terms.add(tok);
  }

  let matchedGroups = 0;
  for (const group of SYNONYM_GROUPS) {
    // A group fires if the user's query contains a known trigger, or the query
    // is a meaningful prefix/substring of one (so "micron" reaches
    // "microneedling"). Typo tolerance on the trigger itself is handled later by
    // trigram matching against the expansion terms in SQL.
    const fired = group.triggers.some(
      (t) => normalized.includes(t) || (normalized.length >= 4 && t.includes(normalized)),
    );
    if (fired) {
      matchedGroups++;
      for (const e of group.expand) terms.add(e);
    }
  }

  return { normalized, terms: [...terms], matchedGroups };
}
