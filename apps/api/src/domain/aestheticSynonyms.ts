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
    expand: ['dermal filler', 'lip filler', 'cheek filler', 'juvederm', 'voluma', 'volbella', 'restylane', 'kysse', 'lyft', 'rha', 'sculptra', 'radiesse', 'versa', 'belotero', 'skinvive'],
  },
  // ─── Kybella / double chin ───
  {
    triggers: ['kybella', 'double chin', 'chin fat', 'submental'],
    expand: ['kybella'],
  },
  // ─── Threads ───
  {
    triggers: ['thread lift', 'threads', 'pdo', 'pdo threads'],
    expand: ['pdo thread lift'],
  },
  // ─── Filler dissolving ───
  {
    triggers: ['dissolve filler', 'dissolve my filler', 'filler dissolving', 'hyaluronidase', 'hylenex', 'filler removal'],
    expand: ['filler dissolving'],
  },
  // ─── Weight loss / GLP-1 ───
  {
    triggers: ['weight loss', 'weightloss', 'lose weight', 'ozempic', 'wegovy', 'mounjaro', 'zepbound', 'glp', 'glp 1', 'glp-1', 'glp1', 'skinny shot', 'skinny jab', 'semaglutide', 'tirzepatide', 'fat loss', 'slim down', 'slimming', 'lipo shot', 'lipotropic', 'mic b12', 'phentermine'],
    expand: ['semaglutide', 'tirzepatide', 'weight loss', 'medical weight management', 'lipotropic', 'weight loss program', 'phentermine'],
  },
  // ─── Fat reduction / body contouring ───
  {
    triggers: ['fat freeze', 'fat freezing', 'freeze fat', 'coolsculpt', 'coolsculpting', 'body contour', 'body contouring', 'fat reduction', 'sculpt body', 'love handles', 'belly fat', 'inch loss', 'cellulite', 'emsculpt', 'trusculpt', 'sculpsure', 'build muscle', 'muscle toning'],
    expand: ['coolsculpting', 'body contouring', 'emsculpt', 'trusculpt', 'sculpsure', 'cellulite treatment', 'body skin tightening'],
  },
  // ─── Pelvic floor / Emsella ───
  {
    triggers: ['emsella', 'pelvic floor', 'incontinence'],
    expand: ['emsella'],
  },
  // ─── Lymphatic massage ───
  {
    triggers: ['lymphatic', 'lymphatic drainage', 'drainage massage'],
    expand: ['lymphatic drainage massage'],
  },
  // ─── Laser hair removal ───
  {
    triggers: ['laser hair', 'hair removal', 'lhr', 'brazilian laser', 'unwanted hair', 'underarm laser', 'bikini laser'],
    expand: ['laser hair removal'],
  },
  // ─── Facials / glow ───
  {
    triggers: ['facial', 'facials', 'hydrafacial', 'hydra facial', 'glow facial', 'deep clean', 'clogged pores', 'pores', 'glowy skin', 'glow up', 'dull skin', 'dermaplaning', 'diamondglow', 'diamond glow', 'oxygen facial', 'geneo', 'glo2facial'],
    expand: ['hydrafacial', 'facials', 'chemical peel', 'dermaplaning', 'diamondglow', 'oxygen facial', 'glo2facial', 'signature facial'],
  },
  // ─── Microneedling / PRP / texture ───
  {
    triggers: ['microneedling', 'micro needling', 'vampire facial', 'collagen induction', 'prp', 'skin texture', 'acne scars', 'acne scarring', 'scars', 'large pores', 'rf microneedling', 'vivace', 'potenza', 'exosome', 'exosomes'],
    expand: ['microneedling', 'morpheus8', 'rf microneedling', 'vivace', 'potenza', 'prp facial', 'exosome'],
  },
  // ─── Skin tightening / Morpheus ───
  {
    triggers: ['skin tightening', 'tighten skin', 'tighten', 'morpheus', 'morpheus8', 'radiofrequency', 'sagging skin', 'firm skin', 'jowls', 'crepey'],
    expand: ['morpheus8', 'rf microneedling', 'skin tightening', 'halo'],
  },
  // ─── Lasers / resurfacing / pigment / redness ───
  {
    triggers: ['laser', 'laser facial', 'resurfacing', 'pigmentation', 'sun damage', 'sunspots', 'sun spots', 'dark spots', 'melasma', 'redness', 'rosacea', 'broken capillaries', 'photofacial', 'photo facial', 'bbl', 'ipl', 'halo laser', 'moxi', 'fraxel', 'co2 laser', 'coolpeel', 'pico', 'picosure', 'clear and brilliant', 'laser genesis', 'vbeam', 'aerolase'],
    expand: ['bbl', 'ipl', 'halo', 'moxi', 'laser skin', 'fraxel', 'co2 laser', 'pico laser', 'clear + brilliant', 'laser genesis', 'vbeam', 'erbium', 'aerolase'],
  },
  // ─── Tattoo removal ───
  {
    triggers: ['tattoo removal', 'remove tattoo', 'tattoo'],
    expand: ['laser tattoo removal'],
  },
  // ─── Chemical peels ───
  {
    triggers: ['peel', 'chemical peel', 'exfoliate', 'brighten skin', 'vi peel', 'jessner', 'biorepeel', 'perfect derma'],
    expand: ['chemical peel', 'vi peel', 'jessner peel', 'biorepeel', 'perfect derma peel', 'microdermabrasion'],
  },
  // ─── IV / wellness drips / shots ───
  {
    triggers: ['iv', 'iv drip', 'iv therapy', 'iv hydration', 'hydration drip', 'drip', 'vitamin drip', 'myers', 'myers cocktail', 'nad', 'nad+', 'hangover', 'energy boost', 'immune', 'b12', 'vitamin shot', 'wellness shot', 'glutathione', 'vitamin c', 'vitamin d', 'glow drip', 'beauty drip'],
    expand: ['iv hydration', 'myers cocktail', 'nad', 'b12', 'wellness shots', 'glutathione', 'vitamin c', 'immunity iv', 'beauty', 'energy iv', 'hangover recovery', 'athletic recovery', 'vitamin d'],
  },
  // ─── Hormones / HRT ───
  {
    triggers: ['hormone', 'hormones', 'hrt', 'bhrt', 'testosterone', 'trt', 'estrogen', 'menopause', 'low t', 'low testosterone', 'libido', 'pellet', 'pellets'],
    expand: ['hormone therapy', 'testosterone therapy', 'hormone pellet', 'hormone consult'],
  },
  // ─── Peptides ───
  {
    triggers: ['peptide', 'peptides', 'sermorelin', 'cjc', 'cjc 1295', 'bpc', 'bpc 157', 'ipamorelin'],
    expand: ['peptide therapy', 'sermorelin', 'bpc-157'],
  },
  // ─── Lashes / brows ───
  {
    triggers: ['lashes', 'lash', 'eyelash', 'lash lift', 'lash extensions', 'lash fill', 'latisse', 'brows', 'brow', 'eyebrow', 'brow lamination', 'lamination', 'microblading', 'nano brows', 'nanoblading', 'powder brows', 'ombre brows', 'henna brow', 'permanent makeup', 'permanent eyeliner'],
    expand: ['lash services', 'brow services', 'latisse', 'lash extensions', 'lash fill', 'lash lift', 'brow lamination', 'brow shaping', 'microblading', 'powder', 'permanent eyeliner'],
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

/* ============================================================
 * Title → treatment detection (the reverse of expandQuery).
 *
 * Given a deal title a vendor typed ("Botox — first-timer special"), figure
 * out which treatment subtype it is ("Botox") so we can auto-tag the deal with
 * near-zero vendor effort. Powers the "Treatment: Botox · change" chip in the
 * post-deal form and the one-time backfill of existing deals.
 * ============================================================ */

/** Aliases keyed by lowercased subtype display name → phrases that imply it. */
const SUBTYPE_ALIASES: Record<string, string[]> = {
  'botox': ['botox'],
  'daxxify': ['daxxify', 'daxi'],
  'dermal filler': ['dermal filler', 'filler', 'fillers'],
  'lip filler': ['lip filler'],
  'cheek filler': ['cheek filler'],
  'chin & jawline filler': ['jawline filler', 'chin filler', 'jawline'],
  'under-eye / tear trough filler': ['under eye filler', 'tear trough'],
  'lip flip': ['lip flip'],
  'masseter botox (tmj / slimming)': ['masseter', 'tmj botox', 'jaw botox', 'jaw slimming'],
  'botox for sweating (hyperhidrosis)': ['hyperhidrosis', 'sweating', 'sweat botox'],
  'trap / “barbie” botox': ['trap botox', 'barbie botox', 'traptox'],
  'kybella (double chin)': ['kybella', 'double chin'],
  'radiesse': ['radiesse'],
  'restylane-l': ['restylane l'],
  'restylane defyne': ['defyne', 'restylane defyne'],
  'restylane refyne': ['refyne', 'restylane refyne'],
  'rha 2': ['rha 2'],
  'rha 4': ['rha 4'],
  'revanesse versa': ['versa', 'revanesse'],
  'belotero': ['belotero'],
  'skinvive': ['skinvive'],
  'prf / ez gel': ['prf', 'ez gel', 'ezgel'],
  'pdo thread lift': ['pdo', 'thread lift', 'threads'],
  'filler dissolving (hyaluronidase)': ['filler dissolving', 'dissolve filler', 'hyaluronidase', 'hylenex'],
  'dysport': ['dysport'],
  'jeuveau': ['jeuveau', 'newtox'],
  'juvederm volbella': ['volbella', 'juvederm volbella'],
  'juvederm voluma': ['voluma', 'juvederm voluma'],
  'restylane kysse': ['kysse', 'restylane kysse'],
  'restylane lyft': ['lyft', 'restylane lyft'],
  'rha 3': ['rha', 'rha 3'],
  'sculptra': ['sculptra'],
  'xeomin': ['xeomin'],
  'chemical peel': ['chemical peel', 'peel'],
  'facials / hydrafacial': ['hydrafacial', 'facial', 'facials'],
  'dermaplaning': ['dermaplaning', 'dermaplane'],
  'signature / custom facial': ['signature facial', 'custom facial'],
  'diamondglow': ['diamondglow', 'diamond glow'],
  'glo2facial (geneo)': ['glo2facial', 'geneo'],
  'oxygen facial': ['oxygen facial'],
  'prp facial (vampire facial)': ['prp facial', 'vampire facial'],
  'vi peel': ['vi peel'],
  'the perfect derma peel': ['perfect derma'],
  'biorepeel': ['biorepeel', 'bio repeel'],
  'jessner peel': ['jessner'],
  'microdermabrasion': ['microdermabrasion'],
  'vivace rf microneedling': ['vivace'],
  'potenza rf microneedling': ['potenza'],
  'exosome therapy (add-on)': ['exosome', 'exosomes'],
  'led light therapy': ['led light', 'led therapy', 'red light therapy'],
  'plasma fibroblast / jet plasma': ['plasma fibroblast', 'jet plasma', 'fibroblast'],
  'acne treatment facial': ['acne facial', 'acne treatment'],
  'back facial': ['back facial'],
  'hydrafacial': ['hydrafacial'],
  'microneedling': ['microneedling', 'micro needling', 'collagen induction'],
  'microneedling + prp': ['microneedling prp', 'microneedling + prp'],
  'morpheus8 rf': ['morpheus8', 'morpheus 8', 'morpheus'],
  'rf microneedling / skin tightening': ['rf microneedling', 'skin tightening', 'radiofrequency microneedling'],
  'bbl / ipl': ['bbl', 'ipl', 'photofacial', 'photo facial'],
  'halo': ['halo'],
  'ipl / laser skin treatments': ['ipl', 'laser skin'],
  'moxi': ['moxi'],
  'laser hair removal': ['laser hair removal', 'laser hair', 'lhr'],
  'body contouring': ['body contouring', 'body contour', 'body sculpting'],
  'coolsculpting': ['coolsculpting', 'coolsculpt', 'fat freeze', 'fat freezing'],
  'b12 / wellness shots': ['b12', 'b-12', 'vitamin shot', 'wellness shot'],
  'hormone therapy': ['hormone therapy', 'hormone', 'hrt', 'bhrt', 'testosterone', 'trt'],
  'iv hydration': ['iv hydration', 'iv drip', 'iv therapy', 'iv'],
  'medical weight management consultation': ['weight management', 'weight loss consultation', 'weight loss consult'],
  'myers cocktail iv': ['myers cocktail', 'myers'],
  'nad+ iv': ['nad+', 'nad'],
  'semaglutide': ['semaglutide', 'ozempic', 'wegovy', 'skinny shot'],
  'tirzepatide': ['tirzepatide', 'mounjaro', 'zepbound', 'weight loss'],
  'brow services': ['brow', 'brows', 'eyebrow', 'microblading', 'brow lamination'],
  'lash services': ['lash', 'lashes', 'lash lift', 'lash extensions'],
  'spray tans': ['spray tan', 'spray tanning', 'airbrush tan'],
  'teeth whitening': ['teeth whitening', 'whitening'],
  'waxing / sugaring': ['waxing', 'wax', 'sugaring', 'brazilian wax'],
  'latisse (lashes)': ['latisse'],
  'upneeq (eyelid lift)': ['upneeq', 'eyelid lift'],
  // Laser
  'co2 laser resurfacing (coolpeel)': ['co2', 'co2 laser', 'coolpeel'],
  'fraxel': ['fraxel'],
  'clear + brilliant': ['clear brilliant', 'clear and brilliant'],
  'erbium laser resurfacing': ['erbium'],
  'pico laser (picosure)': ['pico', 'picosure', 'pico laser'],
  'laser genesis': ['laser genesis'],
  'vbeam / vascular laser': ['vbeam', 'vascular laser'],
  'aerolase': ['aerolase'],
  'laser tattoo removal': ['tattoo removal', 'tattoo'],
  // Weight loss
  'lipotropic / mic-b12 shot': ['lipotropic', 'lipo shot', 'mic b12'],
  'medical weight loss program': ['weight loss program'],
  'body composition scan (inbody)': ['inbody', 'body composition'],
  'appetite suppressant (phentermine)': ['phentermine'],
  // Body & contouring
  'emsculpt neo': ['emsculpt'],
  'trusculpt': ['trusculpt'],
  'sculpsure': ['sculpsure'],
  'cellulite treatment (avéli / qwo)': ['cellulite', 'aveli', 'qwo'],
  'body skin tightening (rf / ultrasound)': ['body tightening', 'body skin tightening'],
  'emsella (pelvic floor)': ['emsella', 'pelvic floor'],
  'lymphatic drainage massage': ['lymphatic', 'lymphatic drainage'],
  // IV & shots
  'glutathione iv / push': ['glutathione'],
  'high-dose vitamin c iv': ['vitamin c'],
  'immunity iv': ['immunity iv', 'immune drip'],
  'beauty / glow iv': ['beauty iv', 'glow iv', 'glow drip'],
  'energy iv': ['energy iv'],
  'hangover recovery iv': ['hangover'],
  'athletic recovery iv': ['recovery iv', 'athletic recovery'],
  'nad+ injection': ['nad shot', 'nad injection'],
  'glutathione shot': ['glutathione shot'],
  'vitamin d shot': ['vitamin d'],
  // Hormones & peptides
  'hormone therapy — women (bhrt)': ['bhrt'],
  'testosterone therapy — men (trt)': ['trt', 'testosterone'],
  'hormone pellet therapy': ['pellet', 'pellets', 'hormone pellet'],
  'peptide therapy': ['peptide', 'peptides'],
  'sermorelin / cjc-1295': ['sermorelin', 'cjc'],
  'bpc-157': ['bpc 157', 'bpc'],
  'hormone consult + labs': ['hormone consult'],
  // Lashes, brows & permanent makeup
  'lash extensions (full set)': ['lash extensions', 'eyelash extensions'],
  'lash fill': ['lash fill'],
  'lash lift & tint': ['lash lift', 'lift and tint'],
  'brow lamination': ['brow lamination', 'lamination'],
  'brow shaping & tint': ['brow tint', 'brow shaping'],
  'microblading / nano brows': ['microblading', 'nano brows', 'nanoblading'],
  'powder / ombré brows': ['powder brows', 'ombre brows'],
  'permanent eyeliner': ['permanent eyeliner', 'permanent makeup'],
};

/** Brand/product aliases — a match on one of these is high-confidence (auto-select). */
const BRAND_ALIASES = new Set([
  'botox', 'daxxify', 'daxi', 'dysport', 'jeuveau', 'newtox', 'volbella', 'voluma',
  'kysse', 'lyft', 'rha', 'sculptra', 'xeomin', 'morpheus8', 'morpheus', 'hydrafacial',
  'coolsculpting', 'coolsculpt', 'semaglutide', 'ozempic', 'wegovy', 'tirzepatide',
  'mounjaro', 'zepbound', 'latisse', 'upneeq', 'halo', 'moxi', 'bbl', 'nad', 'nad+',
  'kybella', 'radiesse', 'defyne', 'refyne', 'versa', 'revanesse', 'belotero', 'skinvive',
  'diamondglow', 'glo2facial', 'geneo', 'vi peel', 'biorepeel', 'jessner', 'vivace', 'potenza',
  'fraxel', 'coolpeel', 'picosure', 'vbeam', 'aerolase', 'emsculpt', 'trusculpt', 'sculpsure',
  'emsella', 'aveli', 'qwo', 'phentermine', 'sermorelin', 'dermaplaning', 'microblading',
]);

export interface SubtypeRef {
  slug: string;
  displayName: string;
  /** Used to disambiguate (e.g. "Laser Hair Removal" lives under both Body and Laser). */
  categorySlug?: string | null;
}

export interface DetectedTreatment {
  subtypeSlug: string;
  displayName: string;
  /** 'high' ⇒ a brand/product name was found (safe to auto-select). 'medium' ⇒ a
   *  generic term ("filler", "facial") matched — suggest, but let the vendor confirm. */
  confidence: 'high' | 'medium';
}

/**
 * Detect the treatment subtype implied by a piece of text (usually the deal
 * title). When `categorySlug` is given, only subtypes in that category are
 * considered — which resolves the handful of names that exist under two
 * categories. Returns the most specific match, or null if nothing lands.
 */
export function detectTreatment(
  text: string,
  subtypes: SubtypeRef[],
  categorySlug?: string | null,
): DetectedTreatment | null {
  const norm = ` ${normalizeQuery(text)} `;
  if (norm.trim().length < 2) return null;

  const pool = categorySlug
    ? subtypes.filter((s) => !s.categorySlug || s.categorySlug === categorySlug)
    : subtypes;

  let best: { subtypeSlug: string; displayName: string; score: number; confident: boolean } | null = null;

  for (const s of pool) {
    const aliases = SUBTYPE_ALIASES[s.displayName.toLowerCase()] ?? [s.displayName.toLowerCase()];
    for (const alias of aliases) {
      // Whole-word match: normalizeQuery already turned punctuation into spaces,
      // so space-padding gives a clean word boundary ("iv" won't hit "festive").
      if (!norm.includes(` ${alias} `)) continue;
      const confident = BRAND_ALIASES.has(alias);
      const score = alias.length;
      const beats =
        !best ||
        (confident && !best.confident) ||
        (confident === best.confident && score > best.score);
      if (beats) best = { subtypeSlug: s.slug, displayName: s.displayName, score, confident };
    }
  }

  if (!best) return null;
  return { subtypeSlug: best.subtypeSlug, displayName: best.displayName, confidence: best.confident ? 'high' : 'medium' };
}
