// tokens.js
// Canonical token definitions (ordered) + search helpers for suggestions.

export const TOKEN_ORDER = [
  // must be EXACT order requested:
  'krat',                 // €7.50
  'container',            // €100.00
  'box',                  // €80.00
  'rood',                 // €12.50
  'hoes',                 // €200.00
  'donkergroen',          // €4.26
  'cbl',                  // unknown
  'kleinblauw',           // €0.90
  'europallet',           // €22.50
  'kunststofpallet',      // €65.00
  'container_lekkerland', // €100.00
  'zuurkoolvat',          // €4.00
  'sigarettenbox',        // €25.00
  'bierkrat',             // €3.90
  'limkrat',              // €5.00
  'bierfles',             // €0.10
  'spakrat',              // €2.75
  'watercan',             // unknown
  'biervat',              // €30.00
  'koolzuurfles'          // €120.00 (true last item)
];

// NOTE:
// - id is stable internal key.
// - defaultRef is a sensible "shared" reference.
// - userRef is personal preference (customizable later).
// - aliases & keywords drive suggestions ("bier" -> bierkrat/bierfles/biervat).
export const DEFAULT_TOKENS = {
  krat: {
    id: 'krat',
    type: 'crate',
    name_nl: 'TotaalVERS Emballagekrat',
    value_eur: 7.50,
    defaultRef: 'k',
    userRef: 'g', // your personal letter
    aliases: ['k', 'g', 'krat'],
    keywords: ['emballage', 'krat', 'totaalvers']
  },

  container: {
    id: 'container',
    type: 'container',
    name_nl: 'TotaalVERS Rolcontainer',
    value_eur: 100.00,
    defaultRef: 'c',
    userRef: 'c',
    aliases: ['c', 'rc', 'cont', 'container'],
    keywords: ['rolcontainer', 'container', 'totaalvers']
  },

  box: {
    id: 'box',
    type: 'box',
    name_nl: 'Diepvriesbox',
    value_eur: 80.00,
    defaultRef: 'b',
    userRef: 'b',
    aliases: ['b', 'box'],
    keywords: ['diepvries', 'vries', 'box']
  },

  rood: {
    id: 'rood',
    type: 'crate',
    name_nl: 'Rode krat',
    value_eur: 12.50,
    defaultRef: 'r',
    userRef: 'r',
    aliases: ['r', 'rood'],
    keywords: ['rode', 'rood', 'krat']
  },

  hoes: {
    id: 'hoes',
    type: 'cover',
    name_nl: 'Diepvrieshoes',
    value_eur: 200.00,
    defaultRef: 'h',
    userRef: 'h',
    aliases: ['h', 'hoes'],
    keywords: ['diepvries', 'hoes', 'cover']
  },

  donkergroen: {
    id: 'donkergroen',
    type: 'crate',
    name_nl: 'EPS Klapkrat donkergroen',
    value_eur: 4.26,
    defaultRef: 'dg',
    userRef: 'dg',
    aliases: ['dg', 'donkergroen', 'donker', 'groen'],
    keywords: ['eps', 'klapkrat', 'donkergroen', 'donker', 'groen']
  },

  cbl: {
    id: 'cbl',
    type: 'crate',
    name_nl: 'Zwart CBL krat (hoog/middel)',
    value_eur: null,
    defaultRef: 'cbl',
    userRef: 'cbl',
    aliases: ['cbl'],
    keywords: ['cbl', 'zwart', 'krat', 'hoog', 'middel']
  },

  kleinblauw: {
    id: 'kleinblauw',
    type: 'crate',
    name_nl: 'Kleinblauw',
    value_eur: 0.90,
    defaultRef: 'bl',
    userRef: 'bl',
    aliases: ['bl', 'kb', 'kleinblauw'],
    keywords: ['klein', 'blauw', 'kleinblauw']
  },

  europallet: {
    id: 'europallet',
    type: 'pallet',
    name_nl: 'Europallet',
    value_eur: 22.50,
    defaultRef: 'ep',
    userRef: 'ep',
    aliases: ['ep', 'euro', 'europallet'],
    keywords: ['pallet', 'euro', 'europallet']
  },

  kunststofpallet: {
    id: 'kunststofpallet',
    type: 'pallet',
    name_nl: 'Kunststofpallet',
    value_eur: 65.00,
    defaultRef: 'kp',
    userRef: 'kp',
    aliases: ['kp', 'kunststof', 'kunststofpallet'],
    keywords: ['pallet', 'kunststof', 'plastic']
  },

  container_lekkerland: {
    id: 'container_lekkerland',
    type: 'container',
    name_nl: 'Rolcontainer - Lekkerland',
    value_eur: 100.00,
    defaultRef: 'cl',
    userRef: 'cl',
    aliases: ['cl', 'lekkerland', 'lek'],
    keywords: ['rolcontainer', 'container', 'lekkerland', 'lek']
  },

  zuurkoolvat: {
    id: 'zuurkoolvat',
    type: 'vat',
    name_nl: 'Zuurkoolvat',
    value_eur: 4.00,
    defaultRef: 'zv',
    userRef: 'zv',
    aliases: ['zv', 'zuurkool', 'vat'],
    keywords: ['zuurkool', 'vat']
  },

  sigarettenbox: {
    id: 'sigarettenbox',
    type: 'box',
    name_nl: 'Sigarettenbox A',
    value_eur: 25.00,
    defaultRef: 'sb',
    userRef: 'sb',
    aliases: ['sb', 'sig', 'sigaret', 'sigarettenbox'],
    keywords: ['sigaret', 'sigaretten', 'box']
  },

  bierkrat: {
    id: 'bierkrat',
    type: 'crate',
    name_nl: 'Statiegeld Bierkrat',
    value_eur: 3.90,
    defaultRef: 'bk',
    userRef: 'bk',
    aliases: ['bk', 'bierkrat'],
    keywords: ['bier', 'krat', 'statiegeld']
  },

  limkrat: {
    id: 'limkrat',
    type: 'crate',
    name_nl: 'Statiegeld Lim.krat',
    value_eur: 5.00,
    defaultRef: 'lk',
    userRef: 'lk',
    aliases: ['lk', 'lim', 'limkrat'],
    keywords: ['lim', 'fris', 'krat', 'statiegeld']
  },

  bierfles: {
    id: 'bierfles',
    type: 'bottle',
    name_nl: 'Bierfles 30 cl',
    value_eur: 0.10,
    defaultRef: 'bf',
    userRef: 'bf',
    aliases: ['bf', 'bierfles', 'fles'],
    keywords: ['bier', 'fles', '30', '30cl']
  },

  spakrat: {
    id: 'spakrat',
    type: 'crate',
    name_nl: 'Spa krat (6 flessen)',
    value_eur: 2.75,
    defaultRef: 'sp',
    userRef: 'sp',
    aliases: ['sp', 'spa'],
    keywords: ['spa', 'water', 'krat', '6']
  },

  watercan: {
    id: 'watercan',
    type: 'can',
    name_nl: 'Watercan 18.9L',
    value_eur: null,
    defaultRef: 'wc',
    userRef: 'wc',
    aliases: ['wc', 'watercan', 'can'],
    keywords: ['water', 'can', '18.9', '18.9l']
  },

  biervat: {
    id: 'biervat',
    type: 'vat',
    name_nl: 'Statiegeld bier vat',
    value_eur: 30.00,
    defaultRef: 'bv',
    userRef: 'bv',
    aliases: ['bv', 'biervat', 'vat'],
    keywords: ['bier', 'vat', 'statiegeld', 'keg']
  },

  koolzuurfles: {
    id: 'koolzuurfles',
    type: 'cylinder',
    name_nl: 'Koolzuurfles',
    value_eur: 120.00,
    defaultRef: 'kz',
    userRef: 'kz',
    aliases: ['kz', 'koolzuur', 'koolzuurfles'],
    keywords: ['koolzuur', 'fles', 'co2']
  }
};

export function getTokenDefs() {
  // Later: move to IndexedDB, per-user profiles, import/export.
  // For now: allow localStorage overrides.
  const raw = localStorage.getItem('rogo_token_overrides');
  if (!raw) return structuredClone(DEFAULT_TOKENS);

  try {
    const overrides = JSON.parse(raw);
    const base = structuredClone(DEFAULT_TOKENS);

    for (const id of Object.keys(base)) {
      if (overrides[id]) base[id] = { ...base[id], ...overrides[id] };
    }
    return base;
  } catch {
    return structuredClone(DEFAULT_TOKENS);
  }
}

export function buildAliasMap(defs) {
  // Maps “what user types” -> internal token id
  const map = {};
  for (const id of Object.keys(defs)) {
    const d = defs[id];
    const aliases = new Set([
      id,
      d.defaultRef,
      d.userRef,
      ...(d.aliases || [])
    ].filter(Boolean).map(s => String(s).toLowerCase()));

    for (const a of aliases) map[a] = id;
  }
  return map;
}

export function displayKey(defs, id) {
  const d = defs[id];
  return (d?.userRef || d?.defaultRef || id).toLowerCase();
}

// --- Suggestion helpers ---

export function listTokensInOrder(defs) {
  return TOKEN_ORDER.filter(id => defs[id]);
}

export function allAliasesFor(defs, id) {
  const d = defs[id];
  const set = new Set(
    [id, d?.defaultRef, d?.userRef, ...(d?.aliases || [])]
      .filter(Boolean)
      .map(s => String(s).toLowerCase())
  );
  return Array.from(set);
}

function formatEuroNL(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  // 7.5 -> "€ 7,50"
  const fixed = value.toFixed(2);
  return `€ ${fixed.replace('.', ',')}`;
}

export function formatTokenOption(defs, id) {
  const d = defs[id];
  const aliases = allAliasesFor(defs, id);
  const price = formatEuroNL(d?.value_eur);
  return `${d?.name_nl ?? id} ${price} (${aliases.join('/')})`;
}

export function searchTokens(defs, rawQuery, limit = 6) {
  const q = String(rawQuery || '').trim().toLowerCase();
  if (!q) return [];

  const ordered = listTokensInOrder(defs);
  const hits = [];

  for (const id of ordered) {
    const d = defs[id];
    const aliases = allAliasesFor(defs, id);
    const name = (d?.name_nl || '').toLowerCase();
    const keywords = (d?.keywords || []).map(x => String(x).toLowerCase());

    const match =
      aliases.some(a => a.startsWith(q) || a.includes(q)) ||
      name.includes(q) ||
      keywords.some(k => k.startsWith(q) || k.includes(q));

    if (match) hits.push(id);
    if (hits.length >= limit) break;
  }

  return hits;
}